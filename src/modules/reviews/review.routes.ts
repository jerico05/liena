import { Router, type RequestHandler } from "express";
import { ReviewStatus, UserRole } from "@prisma/client";
import { z } from "zod";
import { HttpError } from "../../http/errors";
import { validateBody, validateParams } from "../../http/middleware/validate";
import { prisma } from "../../lib/prisma";
import { requireRequestUserId, requireUserAuthentication, requireUserRole } from "../shared/request-user";

const providerProfileIdSchema = z.object({ providerProfileId: z.string().uuid() }).strict();
const bookingIdSchema = z.object({ id: z.string().uuid() }).strict();
const reviewResponseParamsSchema = z.object({ providerProfileId: z.string().uuid(), id: z.string().uuid() }).strict();

const createReviewSchema = z
  .object({
    rating: z.coerce.number().int().min(1).max(5),
    comment: z.string().trim().max(2000).optional(),
  })
  .strict();
const reviewResponseSchema = z.object({ response: z.string().trim().min(1).max(2000) }).strict();

const listProviderReviews: RequestHandler<z.output<typeof providerProfileIdSchema>> = async (
  request,
  response,
) => {
  const { providerProfileId } = request.params as z.output<typeof providerProfileIdSchema>;

  const reviews = await prisma.review.findMany({
    where: { providerProfileId, status: ReviewStatus.PUBLISHED },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      rating: true,
      comment: true,
      response: true,
      createdAt: true,
      author: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  response.status(200).json({ data: reviews });
};

const createBookingReview: RequestHandler<z.output<typeof bookingIdSchema>> = async (
  request,
  response,
) => {
  const userId = requireRequestUserId(request);
  requireUserRole(request, UserRole.CLIENT);
  const { id } = request.params as z.output<typeof bookingIdSchema>;
  const payload = request.body as z.output<typeof createReviewSchema>;

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      clientId: true,
      providerProfileId: true,
      status: true,
      review: { select: { id: true } },
    },
  });

  if (!booking) {
    throw new HttpError(404, "BOOKING_NOT_FOUND", "La réservation n’existe pas.");
  }

  if (booking.clientId !== userId) {
    throw new HttpError(403, "ACCESS_DENIED", "Seul le client peut noter une réservation.");
  }

  if (booking.status !== "COMPLETED") {
    throw new HttpError(400, "BOOKING_NOT_COMPLETED", "Une note ne peut être ajoutée qu’après la fin de la prestation.");
  }

  if (booking.review) {
    throw new HttpError(409, "REVIEW_ALREADY_EXISTS", "Une note a déjà été publiée pour cette réservation.");
  }

  const review = await prisma.review.create({
    data: {
      bookingId: booking.id,
      authorId: userId,
      providerProfileId: booking.providerProfileId,
      rating: payload.rating,
      comment: payload.comment ?? null,
    },
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      providerProfileId: true,
    },
  });

  response.status(201).json({ data: review });
};

const createMissionReview: RequestHandler<z.output<typeof bookingIdSchema>> = async (request, response) => {
  const userId = requireRequestUserId(request);
  requireUserRole(request, UserRole.CLIENT);
  const { id } = request.params as z.output<typeof bookingIdSchema>;
  const payload = request.body as z.output<typeof createReviewSchema>;
  const mission = await prisma.mission.findUnique({
    where: { id },
    select: { id: true, clientId: true, providerProfileId: true, status: true, review: { select: { id: true } } },
  });
  if (!mission) throw new HttpError(404, "MISSION_NOT_FOUND", "La mission n’existe pas.");
  if (mission.clientId !== userId) throw new HttpError(403, "ACCESS_DENIED", "Seul le client de la mission peut publier un avis.");
  if (mission.status !== "COMPLETED") throw new HttpError(400, "MISSION_NOT_COMPLETED", "Un avis est possible uniquement après la mission.");
  if (mission.review) throw new HttpError(409, "REVIEW_ALREADY_EXISTS", "Un avis existe déjà pour cette mission.");
  const review = await prisma.review.create({
    data: {
      missionId: mission.id,
      authorId: userId,
      providerProfileId: mission.providerProfileId,
      rating: payload.rating,
      comment: payload.comment ?? null,
    },
    select: { id: true, rating: true, comment: true, createdAt: true, providerProfileId: true, missionId: true },
  });
  response.status(201).json({ data: review });
};

const respondToReview: RequestHandler<z.output<typeof reviewResponseParamsSchema>> = async (request, response) => {
  const userId = requireRequestUserId(request);
  requireUserRole(request, UserRole.PROVIDER);
  const { providerProfileId, id } = request.params as z.output<typeof reviewResponseParamsSchema>;
  const { response: message } = request.body as z.output<typeof reviewResponseSchema>;
  const profile = await prisma.providerProfile.findFirst({ where: { id: providerProfileId, userId }, select: { id: true } });
  if (!profile) throw new HttpError(403, "ACCESS_DENIED", "Vous ne pouvez répondre qu’aux avis de votre profil.");
  const review = await prisma.review.findFirst({ where: { id, providerProfileId, status: ReviewStatus.PUBLISHED }, select: { id: true } });
  if (!review) throw new HttpError(404, "REVIEW_NOT_FOUND", "L’avis n’existe pas ou n’est pas publié.");
  const updated = await prisma.review.update({
    where: { id },
    data: { response: message, respondedAt: new Date() },
    select: { id: true, response: true, respondedAt: true },
  });
  response.status(200).json({ data: updated });
};

export const reviewRouter = Router();
reviewRouter.get("/providers/:providerProfileId", validateParams(providerProfileIdSchema), listProviderReviews);
reviewRouter.post("/bookings/:id", requireUserAuthentication, validateParams(bookingIdSchema), validateBody(createReviewSchema), createBookingReview);
reviewRouter.post("/missions/:id", requireUserAuthentication, validateParams(bookingIdSchema), validateBody(createReviewSchema), createMissionReview);
reviewRouter.patch("/providers/:providerProfileId/reviews/:id/response", requireUserAuthentication, validateParams(reviewResponseParamsSchema), validateBody(reviewResponseSchema), respondToReview);
