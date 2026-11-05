import { Router, type RequestHandler } from "express";
import { ProviderStatus, ServiceStatus, UserRole, UserStatus } from "@prisma/client";
import { z } from "zod";
import { HttpError } from "../../http/errors";
import { validateParams } from "../../http/middleware/validate";
import { prisma } from "../../lib/prisma";
import { requireRequestUserId, requireUserAuthentication, requireUserRole } from "../shared/request-user";

const favoriteProviderSchema = z.object({ providerProfileId: z.string().uuid() }).strict();
const favoriteServiceSchema = z.object({ serviceId: z.string().uuid() }).strict();

const listFavorites: RequestHandler = async (request, response) => {
  const userId = requireRequestUserId(request);
  requireUserRole(request, UserRole.CLIENT);

  const favorites = await prisma.favorite.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    include: {
      providerProfile: { select: { id: true, businessName: true, slug: true } },
      service: { select: { id: true, title: true, slug: true, category: { select: { name: true } } } },
    },
  });

  response.status(200).json({ data: favorites });
};

const createProviderFavorite: RequestHandler<z.output<typeof favoriteProviderSchema>> = async (
  request,
  response,
) => {
  const userId = requireRequestUserId(request);
  requireUserRole(request, UserRole.CLIENT);
  const { providerProfileId } = request.params as z.output<typeof favoriteProviderSchema>;

  const profile = await prisma.providerProfile.findFirst({
    where: { id: providerProfileId, status: ProviderStatus.VERIFIED, user: { status: UserStatus.ACTIVE, deletedAt: null } },
    select: { id: true },
  });

  if (!profile) {
    throw new HttpError(404, "PROVIDER_NOT_FOUND", "Le prestataire ciblé est introuvable.");
  }

  const favorite = await prisma.favorite.upsert({
    where: { userId_providerProfileId: { userId, providerProfileId } },
    update: {},
    create: { userId, providerProfileId },
    include: { providerProfile: { select: { id: true, businessName: true, slug: true } } },
  });

  response.status(201).json({ data: favorite });
};

const createServiceFavorite: RequestHandler<z.output<typeof favoriteServiceSchema>> = async (
  request,
  response,
) => {
  const userId = requireRequestUserId(request);
  requireUserRole(request, UserRole.CLIENT);
  const { serviceId } = request.params as z.output<typeof favoriteServiceSchema>;

  const service = await prisma.service.findFirst({
    where: {
      id: serviceId,
      status: ServiceStatus.PUBLISHED,
      deletedAt: null,
      category: { isActive: true },
      providerProfile: { status: ProviderStatus.VERIFIED, user: { status: UserStatus.ACTIVE, deletedAt: null } },
    },
    select: { id: true },
  });

  if (!service) {
    throw new HttpError(404, "SERVICE_NOT_FOUND", "La prestation ciblée est introuvable.");
  }

  const favorite = await prisma.favorite.upsert({
    where: { userId_serviceId: { userId, serviceId } },
    update: {},
    create: { userId, serviceId },
    include: { service: { select: { id: true, title: true, slug: true } } },
  });

  response.status(201).json({ data: favorite });
};

const deleteProviderFavorite: RequestHandler<z.output<typeof favoriteProviderSchema>> = async (
  request,
  response,
) => {
  const userId = requireRequestUserId(request);
  requireUserRole(request, UserRole.CLIENT);
  const { providerProfileId } = request.params as z.output<typeof favoriteProviderSchema>;

  await prisma.favorite.deleteMany({
    where: { userId, providerProfileId },
  });

  response.status(200).json({ data: { deleted: true } });
};

const deleteServiceFavorite: RequestHandler<z.output<typeof favoriteServiceSchema>> = async (
  request,
  response,
) => {
  const userId = requireRequestUserId(request);
  requireUserRole(request, UserRole.CLIENT);
  const { serviceId } = request.params as z.output<typeof favoriteServiceSchema>;

  await prisma.favorite.deleteMany({
    where: { userId, serviceId },
  });

  response.status(200).json({ data: { deleted: true } });
};

export const favoriteRouter = Router();
favoriteRouter.use(requireUserAuthentication);
favoriteRouter.get("/", listFavorites);
favoriteRouter.post("/providers/:providerProfileId", validateParams(favoriteProviderSchema), createProviderFavorite);
favoriteRouter.delete("/providers/:providerProfileId", validateParams(favoriteProviderSchema), deleteProviderFavorite);
favoriteRouter.post("/services/:serviceId", validateParams(favoriteServiceSchema), createServiceFavorite);
favoriteRouter.delete("/services/:serviceId", validateParams(favoriteServiceSchema), deleteServiceFavorite);
