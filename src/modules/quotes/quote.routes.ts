import { ProviderStatus, QuoteStatus, ServiceRequestStatus, UserRole, UserStatus } from "@prisma/client";
import { Router, type RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { HttpError } from "../../http/errors";
import { validateBody, validateParams } from "../../http/middleware/validate";
import { prisma } from "../../lib/prisma";
import { requireRequestUserId, requireUserAuthentication, requireUserRole } from "../shared/request-user";

const requestIdSchema = z.object({ requestId: z.string().uuid() }).strict();
const quoteIdSchema = z.object({ id: z.string().uuid() }).strict();
const createQuoteSchema = z.object({
  amount: z.coerce.number().min(0).max(1_000_000_000),
  currency: z.string().trim().length(3).default("XOF"),
  message: z.string().trim().min(10).max(3000),
  estimatedDurationDays: z.coerce.number().int().positive().max(365).optional(),
  validUntil: z.coerce.date().optional(),
}).strict();

const listRequestQuotes: RequestHandler<z.output<typeof requestIdSchema>> = async (request, response) => {
  const clientId = requireRequestUserId(request);
  requireUserRole(request, UserRole.CLIENT);
  const { requestId } = request.params as z.output<typeof requestIdSchema>;
  const serviceRequest = await prisma.serviceRequest.findUnique({ where: { id: requestId }, select: { clientId: true } });
  if (!serviceRequest) throw new HttpError(404, "REQUEST_NOT_FOUND", "La demande n’existe pas.");
  if (serviceRequest.clientId !== clientId) throw new HttpError(403, "ACCESS_DENIED", "Vous ne pouvez pas consulter ces devis.");
  const quotes = await prisma.quote.findMany({
    where: { serviceRequestId: requestId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { providerProfile: { select: { id: true, businessName: true, slug: true, city: true } } },
  });
  response.status(200).json({ data: quotes });
};

const listMyQuotes: RequestHandler = async (request, response) => {
  const userId = requireRequestUserId(request);
  requireUserRole(request, UserRole.PROVIDER);
  const profile = await prisma.providerProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) throw new HttpError(403, "PROVIDER_PROFILE_REQUIRED", "Aucun profil prestataire n’est associé à ce compte.");
  const quotes = await prisma.quote.findMany({
    where: { providerProfileId: profile.id },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    include: { serviceRequest: { select: { id: true, reference: true, title: true, city: true, status: true } } },
  });
  response.status(200).json({ data: quotes });
};

const createQuote: RequestHandler<z.output<typeof requestIdSchema>> = async (request, response) => {
  const userId = requireRequestUserId(request);
  requireUserRole(request, UserRole.PROVIDER);
  const { requestId } = request.params as z.output<typeof requestIdSchema>;
  const payload = request.body as z.output<typeof createQuoteSchema>;
  const profile = await prisma.providerProfile.findFirst({
    where: {
      userId,
      status: ProviderStatus.VERIFIED,
      user: { status: UserStatus.ACTIVE },
      OR: [{ locationZoneId: null }, { locationZone: { is: { isActive: true } } }],
    },
    select: { id: true, professionCategoryId: true, city: true, locationZoneId: true },
  });
  if (!profile?.professionCategoryId) throw new HttpError(403, "PROVIDER_NOT_VERIFIED", "Un profil prestataire vérifié est requis.");
  const serviceRequest = await prisma.serviceRequest.findUnique({ where: { id: requestId } });
  if (!serviceRequest) throw new HttpError(404, "REQUEST_NOT_FOUND", "La demande n’existe pas.");
  if (serviceRequest.status !== ServiceRequestStatus.OPEN) throw new HttpError(409, "REQUEST_NOT_OPEN", "Cette demande n’accepte plus de devis.");
  const matchesZone = profile.locationZoneId && serviceRequest.locationZoneId
    ? profile.locationZoneId === serviceRequest.locationZoneId
    : serviceRequest.city.toLocaleLowerCase() === profile.city.toLocaleLowerCase();
  if (serviceRequest.categoryId !== profile.professionCategoryId || !matchesZone) {
    throw new HttpError(403, "REQUEST_NOT_AVAILABLE", "Cette demande ne correspond pas à votre métier ou à votre zone.");
  }
  if (payload.validUntil && payload.validUntil <= new Date()) throw new HttpError(400, "INVALID_QUOTE_EXPIRY", "La date de validité doit être future.");
  const quote = await prisma.$transaction(async (transaction) => {
    const created = await transaction.quote.create({
      data: {
        serviceRequestId: requestId,
        providerProfileId: profile.id,
        amount: payload.amount.toFixed(2),
        currency: payload.currency.toUpperCase(),
        message: payload.message,
        estimatedDurationDays: payload.estimatedDurationDays ?? null,
        validUntil: payload.validUntil ?? null,
      },
    });
    await transaction.notification.create({
      data: {
        userId: serviceRequest.clientId,
        type: "QUOTE",
        title: "Nouveau devis reçu",
        body: `Un prestataire a répondu à votre demande « ${serviceRequest.title} ».`,
        data: { requestId, quoteId: created.id },
      },
    });
    return created;
  });
  response.status(201).json({ data: quote });
};

const withdrawQuote: RequestHandler<z.output<typeof quoteIdSchema>> = async (request, response) => {
  const userId = requireRequestUserId(request);
  requireUserRole(request, UserRole.PROVIDER);
  const { id } = request.params as z.output<typeof quoteIdSchema>;
  const result = await prisma.quote.updateMany({
    where: { id, status: QuoteStatus.PENDING, providerProfile: { userId } },
    data: { status: QuoteStatus.WITHDRAWN },
  });
  if (!result.count) throw new HttpError(404, "QUOTE_NOT_WITHDRAWABLE", "Devis introuvable ou non retirable.");
  response.status(200).json({ data: { id, status: QuoteStatus.WITHDRAWN } });
};

const declineQuote: RequestHandler<z.output<typeof quoteIdSchema>> = async (request, response) => {
  const clientId = requireRequestUserId(request);
  requireUserRole(request, UserRole.CLIENT);
  const { id } = request.params as z.output<typeof quoteIdSchema>;
  const quote = await prisma.quote.findUnique({ where: { id }, select: { id: true, serviceRequestId: true, serviceRequest: { select: { clientId: true, status: true } } } });
  if (!quote) throw new HttpError(404, "QUOTE_NOT_FOUND", "Le devis n’existe pas.");
  if (quote.serviceRequest.clientId !== clientId) throw new HttpError(403, "ACCESS_DENIED", "Vous ne pouvez pas modifier ce devis.");
  const result = await prisma.quote.updateMany({ where: { id, status: QuoteStatus.PENDING }, data: { status: QuoteStatus.DECLINED } });
  if (!result.count) throw new HttpError(409, "QUOTE_NOT_PENDING", "Seul un devis en attente peut être refusé.");
  response.status(200).json({ data: { id, status: QuoteStatus.DECLINED } });
};

const acceptQuote: RequestHandler<z.output<typeof quoteIdSchema>> = async (request, response) => {
  const clientId = requireRequestUserId(request);
  requireUserRole(request, UserRole.CLIENT);
  const { id } = request.params as z.output<typeof quoteIdSchema>;
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { serviceRequest: true, providerProfile: { select: { userId: true } } },
  });
  if (!quote) throw new HttpError(404, "QUOTE_NOT_FOUND", "Le devis n’existe pas.");
  if (quote.serviceRequest.clientId !== clientId) throw new HttpError(403, "ACCESS_DENIED", "Vous ne pouvez pas accepter ce devis.");
  if (quote.validUntil && quote.validUntil <= new Date()) throw new HttpError(409, "QUOTE_EXPIRED", "Ce devis a expiré.");

  try {
    const mission = await prisma.$transaction(async (transaction) => {
      const requestUpdate = await transaction.serviceRequest.updateMany({
        where: { id: quote.serviceRequestId, clientId, status: ServiceRequestStatus.OPEN, acceptedQuoteId: null },
        data: { status: ServiceRequestStatus.ACCEPTED, acceptedQuoteId: quote.id },
      });
      if (!requestUpdate.count) throw new HttpError(409, "REQUEST_QUOTE_ALREADY_ACCEPTED", "Un devis a déjà été accepté ou la demande n’est plus ouverte.");
      const quoteUpdate = await transaction.quote.updateMany({ where: { id: quote.id, status: QuoteStatus.PENDING }, data: { status: QuoteStatus.ACCEPTED } });
      if (!quoteUpdate.count) throw new HttpError(409, "QUOTE_NOT_PENDING", "Ce devis n’est plus en attente.");
      await transaction.quote.updateMany({
        where: { serviceRequestId: quote.serviceRequestId, id: { not: quote.id }, status: QuoteStatus.PENDING },
        data: { status: QuoteStatus.DECLINED },
      });
      const created = await transaction.mission.create({
        data: {
          reference: `LIENA-MIS-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`,
          serviceRequestId: quote.serviceRequestId,
          quoteId: quote.id,
          clientId,
          providerProfileId: quote.providerProfileId,
          status: "CONFIRMED",
        },
        include: { quote: { select: { amount: true, currency: true } } },
      });
      const conversation = await transaction.conversation.upsert({
        where: { clientId_providerProfileId: { clientId, providerProfileId: quote.providerProfileId } },
        create: { clientId, providerProfileId: quote.providerProfileId },
        update: {},
        select: { id: true },
      });
      await transaction.conversationParticipant.createMany({
        data: [
          { conversationId: conversation.id, userId: clientId },
          { conversationId: conversation.id, userId: quote.providerProfile.userId },
        ],
        skipDuplicates: true,
      });
      await transaction.notification.createMany({
        data: [
          { userId: clientId, type: "MISSION", title: "Mission confirmée", body: "Votre devis a été accepté et la mission est créée.", data: { missionId: created.id } },
          { userId: quote.providerProfile.userId, type: "MISSION", title: "Votre devis a été accepté", body: "Une mission a été créée à partir de votre devis.", data: { missionId: created.id } },
        ],
      });
      return created;
    }, { isolationLevel: "Serializable" });
    response.status(201).json({ data: mission });
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
      throw new HttpError(409, "REQUEST_QUOTE_ALREADY_ACCEPTED", "Un devis a été accepté simultanément pour cette demande.");
    }
    throw error;
  }
};

export const quoteRouter = Router();
quoteRouter.use(requireUserAuthentication);
quoteRouter.get("/mine", listMyQuotes);
quoteRouter.get("/requests/:requestId", validateParams(requestIdSchema), listRequestQuotes);
quoteRouter.post("/requests/:requestId", validateParams(requestIdSchema), validateBody(createQuoteSchema), createQuote);
quoteRouter.post("/:id/accept", validateParams(quoteIdSchema), acceptQuote);
quoteRouter.post("/:id/decline", validateParams(quoteIdSchema), declineQuote);
quoteRouter.post("/:id/withdraw", validateParams(quoteIdSchema), withdrawQuote);