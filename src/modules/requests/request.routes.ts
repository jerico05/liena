import { ProviderStatus, ServiceRequestStatus, UserRole, UserStatus } from "@prisma/client";
import { Router, type RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { HttpError } from "../../http/errors";
import { validateBody, validateParams } from "../../http/middleware/validate";
import { prisma } from "../../lib/prisma";
import { requireRequestUserId, requireUserAuthentication, requireUserRole } from "../shared/request-user";

const requestIdSchema = z.object({ id: z.string().uuid() }).strict();
const createRequestSchema = z.object({
  categoryId: z.string().uuid(),
  locationZoneId: z.string().uuid().optional(),
  title: z.string().trim().min(5).max(160),
  description: z.string().trim().min(20).max(5000),
  countryCode: z.string().trim().length(2).default("TG"),
  city: z.string().trim().min(2).max(120).optional(),
  neighborhood: z.string().trim().max(120).optional(),
  requestedStartsAt: z.coerce.date().optional(),
}).strict().refine((value) => Boolean(value.locationZoneId || value.city), { message: "Une zone ou une ville est requise.", path: ["city"] });

function makeReference(prefix: string): string {
  return `LIENA-${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

const createRequest: RequestHandler = async (request, response) => {
  const clientId = requireRequestUserId(request);
  requireUserRole(request, UserRole.CLIENT);
  const payload = request.body as z.output<typeof createRequestSchema>;
  const category = await prisma.category.findFirst({
    where: {
      id: payload.categoryId,
      isActive: true,
      parentId: { not: null },
      parent: { is: { isActive: true } },
      children: { none: { isActive: true } },
    },
    select: { id: true },
  });
  if (!category) {
    throw new HttpError(400, "INVALID_PROFESSION", "Choisissez un métier actif du catalogue.");
  }
  const zone = payload.locationZoneId
    ? await prisma.locationZone.findFirst({ where: { id: payload.locationZoneId, isActive: true } })
    : null;
  if (payload.locationZoneId && !zone) throw new HttpError(400, "LOCATION_ZONE_INACTIVE", "Choisissez une zone géographique active.");
  const city = zone?.city ?? payload.city!;

  const created = await prisma.$transaction(async (transaction) => {
    const serviceRequest = await transaction.serviceRequest.create({
      data: {
        reference: makeReference("DEM"),
        clientId,
        categoryId: category.id,
        locationZoneId: zone?.id ?? null,
        title: payload.title,
        description: payload.description,
        countryCode: zone?.countryCode ?? payload.countryCode.toUpperCase(),
        city,
        neighborhood: zone ? zone.neighborhood || null : payload.neighborhood ?? null,
        requestedStartsAt: payload.requestedStartsAt ?? null,
      },
    });
    const providers = await transaction.providerProfile.findMany({
      where: {
        professionCategoryId: category.id,
        status: ProviderStatus.VERIFIED,
        ...(zone ? { locationZoneId: zone.id } : { city: { equals: city, mode: "insensitive" } }),
        user: { status: UserStatus.ACTIVE, deletedAt: null },
      },
      select: { userId: true },
    });
    if (providers.length) {
      await transaction.notification.createMany({
        data: providers.map((provider) => ({
          userId: provider.userId,
          type: "REQUEST" as const,
          title: "Nouvelle demande de prestation",
          body: payload.title,
          data: { requestId: serviceRequest.id },
        })),
      });
    }
    return serviceRequest;
  });

  response.status(201).json({ data: created });
};

const listMyRequests: RequestHandler = async (request, response) => {
  const clientId = requireRequestUserId(request);
  requireUserRole(request, UserRole.CLIENT);
  const requests = await prisma.serviceRequest.findMany({
    where: { clientId },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    include: {
      category: { select: { id: true, name: true, slug: true } },
      _count: { select: { quotes: true } },
      acceptedQuote: { select: { id: true, amount: true, currency: true, providerProfileId: true } },
    },
  });
  response.status(200).json({ data: requests });
};

const listAvailableRequests: RequestHandler = async (request, response) => {
  const userId = requireRequestUserId(request);
  requireUserRole(request, UserRole.PROVIDER);
  const profile = await prisma.providerProfile.findFirst({
    where: { userId, status: ProviderStatus.VERIFIED, user: { status: UserStatus.ACTIVE } },
    select: { professionCategoryId: true, city: true, locationZoneId: true },
  });
  if (!profile?.professionCategoryId) {
    throw new HttpError(403, "PROVIDER_NOT_VERIFIED", "Un profil prestataire vérifié est requis.");
  }
  const requests = await prisma.serviceRequest.findMany({
    where: {
      status: ServiceRequestStatus.OPEN,
      categoryId: profile.professionCategoryId,
      ...(profile.locationZoneId ? { locationZoneId: profile.locationZoneId } : { city: { equals: profile.city, mode: "insensitive" } }),
      ...(profile.locationZoneId ? { locationZone: { is: { isActive: true } } } : {}),
      quotes: { none: { providerProfile: { userId } } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    include: {
      category: { select: { id: true, name: true, slug: true } },
      _count: { select: { quotes: true } },
    },
  });
  response.status(200).json({ data: requests });
};

const getRequest: RequestHandler<z.output<typeof requestIdSchema>> = async (request, response) => {
  const userId = requireRequestUserId(request);
  const { id } = request.params as z.output<typeof requestIdSchema>;
  const serviceRequest = await prisma.serviceRequest.findUnique({
    where: { id },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      _count: { select: { quotes: true } },
      acceptedQuote: { select: { id: true, amount: true, currency: true, providerProfileId: true } },
    },
  });
  if (!serviceRequest) {
    throw new HttpError(404, "REQUEST_NOT_FOUND", "La demande n’existe pas.");
  }
  if (serviceRequest.clientId !== userId) {
    const eligibleProfile = await prisma.providerProfile.findFirst({
      where: {
        userId,
        professionCategoryId: serviceRequest.categoryId,
        city: { equals: serviceRequest.city, mode: "insensitive" },
        status: ProviderStatus.VERIFIED,
        user: { status: UserStatus.ACTIVE },
      },
      select: { id: true },
    });
    if (!eligibleProfile || serviceRequest.status !== ServiceRequestStatus.OPEN) {
      throw new HttpError(403, "ACCESS_DENIED", "Vous ne pouvez pas consulter cette demande.");
    }
  }
  response.status(200).json({ data: serviceRequest });
};

const cancelRequest: RequestHandler<z.output<typeof requestIdSchema>> = async (request, response) => {
  const clientId = requireRequestUserId(request);
  requireUserRole(request, UserRole.CLIENT);
  const { id } = request.params as z.output<typeof requestIdSchema>;
  const result = await prisma.serviceRequest.updateMany({
    where: { id, clientId, status: ServiceRequestStatus.OPEN },
    data: { status: ServiceRequestStatus.CANCELLED },
  });
  if (!result.count) {
    const exists = await prisma.serviceRequest.findUnique({ where: { id }, select: { clientId: true } });
    if (!exists) throw new HttpError(404, "REQUEST_NOT_FOUND", "La demande n’existe pas.");
    if (exists.clientId !== clientId) throw new HttpError(403, "ACCESS_DENIED", "Vous ne pouvez pas annuler cette demande.");
    throw new HttpError(409, "REQUEST_NOT_OPEN", "Seule une demande ouverte peut être annulée.");
  }
  response.status(200).json({ data: { id, status: ServiceRequestStatus.CANCELLED } });
};

export const requestRouter = Router();
requestRouter.use(requireUserAuthentication);
requestRouter.get("/available", listAvailableRequests);
requestRouter.get("/", listMyRequests);
requestRouter.post("/", validateBody(createRequestSchema), createRequest);
requestRouter.get("/:id", validateParams(requestIdSchema), getRequest);
requestRouter.patch("/:id/cancel", validateParams(requestIdSchema), cancelRequest);