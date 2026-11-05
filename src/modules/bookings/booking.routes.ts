import { BookingStatus, ProviderStatus, ServiceStatus, UserRole, UserStatus } from "@prisma/client";
import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { HttpError } from "../../http/errors";
import { validateBody, validateParams } from "../../http/middleware/validate";
import { prisma } from "../../lib/prisma";
import { requireRequestUserId, requireUserAuthentication, requireUserRole } from "../shared/request-user";

const bookingIdSchema = z.object({ id: z.string().uuid() }).strict();

const createBookingSchema = z
  .object({
    providerProfileId: z.string().uuid(),
    serviceId: z.string().uuid(),
    addressId: z.string().uuid().optional(),
    requestedStartsAt: z.coerce.date(),
    description: z.string().trim().max(2000).optional(),
  })
  .strict();

const bookingStatusSchema = z
  .object({
    status: z.enum(["ACCEPTED", "REJECTED", "CANCELLED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "DISPUTED"]),
    startsAt: z.coerce.date().optional(),
    endsAt: z.coerce.date().optional(),
    agreedPrice: z.coerce.number().min(0).max(1_000_000_000).optional(),
    cancellationReason: z.string().trim().max(500).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

const listBookingsQuerySchema = z.object({ status: z.enum(["PENDING", "ACCEPTED", "REJECTED", "CANCELLED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "DISPUTED"]).optional() }).strict();

function makeBookingReference(): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `LIENA-${stamp}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

const listBookings: RequestHandler = async (request, response) => {
  const userId = requireRequestUserId(request);
  const parsedQuery = listBookingsQuerySchema.safeParse(request.query);
  if (!parsedQuery.success) throw new HttpError(400, "VALIDATION_ERROR", "Le filtre de statut est invalide.");
  const query = parsedQuery.data;

  const bookings = await prisma.booking.findMany({
    where: {
      OR: [{ clientId: userId }, { providerProfile: { userId } }],
      ...(query.status ? { status: query.status as BookingStatus } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      reference: true,
      status: true,
      requestedStartsAt: true,
      startsAt: true,
      endsAt: true,
      agreedPrice: true,
      currency: true,
      createdAt: true,
      service: { select: { id: true, title: true, slug: true } },
      providerProfile: { select: { id: true, businessName: true, slug: true } },
    },
  });

  response.status(200).json({ data: bookings });
};

const createBooking: RequestHandler = async (request, response) => {
  const userId = requireRequestUserId(request);
  requireUserRole(request, UserRole.CLIENT);
  const payload = request.body as z.output<typeof createBookingSchema>;

  const service = await prisma.service.findUnique({
    where: { id: payload.serviceId },
    include: {
      providerProfile: {
        select: {
          id: true,
          businessName: true,
          slug: true,
          status: true,
          user: { select: { id: true, status: true } },
        },
      },
      category: { select: { id: true, name: true } },
    },
  });

  if (!service) {
    throw new HttpError(404, "SERVICE_NOT_FOUND", "La prestation demandée est introuvable.");
  }

  if (service.status !== ServiceStatus.PUBLISHED || service.deletedAt !== null) {
    throw new HttpError(409, "SERVICE_UNAVAILABLE", "Cette prestation n’est pas disponible pour réservation.");
  }

  if (service.providerProfile.id !== payload.providerProfileId) {
    throw new HttpError(409, "INVALID_PROVIDER", "La prestation ne correspond pas au prestataire sélectionné.");
  }
  if (service.providerProfile.user.id === userId) {
    throw new HttpError(409, "OWN_SERVICE_BOOKING", "Vous ne pouvez pas réserver votre propre prestation.");
  }

  if (service.providerProfile.status !== ProviderStatus.VERIFIED || service.providerProfile.user.status !== UserStatus.ACTIVE) {
    throw new HttpError(409, "PROVIDER_UNAVAILABLE", "Ce prestataire ne peut pas recevoir de réservation pour l’instant.");
  }

  if (payload.addressId) {
    const address = await prisma.address.findFirst({
      where: { id: payload.addressId, userId },
      select: { id: true },
    });

    if (!address) {
      throw new HttpError(403, "ADDRESS_FORBIDDEN", "L’adresse sélectionnée n’est pas associée à ce compte.");
    }
  }

  const booking = await prisma.$transaction(async (transaction) => {
    const created = await transaction.booking.create({
      data: {
        reference: makeBookingReference(),
        clientId: userId,
        providerProfileId: payload.providerProfileId,
        serviceId: payload.serviceId,
        addressId: payload.addressId ?? null,
        requestedStartsAt: payload.requestedStartsAt,
        description: payload.description ?? null,
        pricingTypeSnapshot: service.pricingType,
        listedPriceSnapshot: service.price,
        serviceCurrencySnapshot: service.currency,
        durationMinutesSnapshot: service.durationMinutes,
        serviceTitleSnapshot: service.title,
        serviceDescriptionSnapshot: service.description,
        providerNameSnapshot: service.providerProfile.businessName,
        categoryNameSnapshot: service.category.name,
      },
      select: {
        id: true,
        reference: true,
        status: true,
        requestedStartsAt: true,
        createdAt: true,
      },
    });

    const conversation = await transaction.conversation.findFirst({
      where: { clientId: userId, providerProfileId: payload.providerProfileId },
      select: { id: true },
    });

    if (!conversation) {
      const createdConversation = await transaction.conversation.create({
        data: {
          clientId: userId,
          providerProfileId: payload.providerProfileId,
          bookingId: created.id,
        },
        select: { id: true },
      });
      await transaction.conversationParticipant.createMany({
        data: [
          { conversationId: createdConversation.id, userId },
          { conversationId: createdConversation.id, userId: service.providerProfile.user.id },
        ],
        skipDuplicates: true,
      });
    } else {
      await transaction.conversationParticipant.createMany({
        data: [
          { conversationId: conversation.id, userId },
          { conversationId: conversation.id, userId: service.providerProfile.user.id },
        ],
        skipDuplicates: true,
      });
    }

    return created;
  });

  response.status(201).json({ data: booking });
};

const getBooking: RequestHandler<z.output<typeof bookingIdSchema>> = async (request, response) => {
  const userId = requireRequestUserId(request);
  const { id } = request.params as z.output<typeof bookingIdSchema>;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      service: { select: { id: true, title: true, slug: true } },
      providerProfile: { select: { id: true, businessName: true, slug: true, userId: true } },
      client: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  if (!booking) {
    throw new HttpError(404, "BOOKING_NOT_FOUND", "La réservation n’existe pas.");
  }

  if (booking.clientId !== userId && booking.providerProfile.userId !== userId) {
    throw new HttpError(403, "ACCESS_DENIED", "Vous n’êtes pas autorisé à consulter cette réservation.");
  }

  response.status(200).json({ data: booking });
};

const updateBookingStatus: RequestHandler<z.output<typeof bookingIdSchema>> = async (request, response) => {
  const userId = requireRequestUserId(request);
  const { id } = request.params as z.output<typeof bookingIdSchema>;
  const payload = request.body as z.output<typeof bookingStatusSchema>;

  const booking = await prisma.booking.findUnique({
    where: { id },
    select: {
      id: true,
      clientId: true,
      providerProfile: { select: { id: true, userId: true, timeZone: true } },
      status: true,
      agreedPrice: true,
      startsAt: true,
      endsAt: true,
      requestedStartsAt: true,
      currency: true,
    },
  });

  if (!booking) {
    throw new HttpError(404, "BOOKING_NOT_FOUND", "La réservation n’existe pas.");
  }

  if (booking.clientId !== userId && booking.providerProfile.userId !== userId) {
    throw new HttpError(403, "ACCESS_DENIED", "Vous n’êtes pas autorisé à modifier cette réservation.");
  }

  const isClient = booking.clientId === userId;
  const isProvider = booking.providerProfile.userId === userId;
  if (isClient) requireUserRole(request, UserRole.CLIENT);
  if (isProvider) requireUserRole(request, UserRole.PROVIDER);
  const permittedByActor = isClient
    ? payload.status === "CANCELLED" && ["PENDING", "ACCEPTED", "SCHEDULED"].includes(booking.status)
    : (booking.status === "PENDING" && ["ACCEPTED", "REJECTED", "CANCELLED"].includes(payload.status)) ||
      (booking.status === "ACCEPTED" && ["SCHEDULED", "CANCELLED"].includes(payload.status)) ||
      (booking.status === "SCHEDULED" && ["IN_PROGRESS", "CANCELLED"].includes(payload.status)) ||
      (booking.status === "IN_PROGRESS" && ["COMPLETED", "DISPUTED"].includes(payload.status)) ||
      (booking.status === "DISPUTED" && ["COMPLETED", "CANCELLED"].includes(payload.status));
  if (!permittedByActor) {
    throw new HttpError(409, "BOOKING_TRANSITION_INVALID", "Cette transition n’est pas autorisée pour votre rôle ou le statut actuel.");
  }

  if (isClient && (payload.agreedPrice !== undefined || payload.startsAt || payload.endsAt)) {
    throw new HttpError(403, "ACCESS_DENIED", "Le client peut annuler mais ne peut pas modifier les conditions de la réservation.");
  }

  if (payload.status === "ACCEPTED" && payload.agreedPrice === undefined && booking.agreedPrice == null) {
    throw new HttpError(400, "PRICE_REQUIRED", "Un prix convenu est requis pour accepter cette réservation.");
  }

  const startsAt = payload.startsAt ?? booking.startsAt;
  const endsAt = payload.endsAt ?? booking.endsAt;
  if (["ACCEPTED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "DISPUTED"].includes(payload.status)) {
    if (!startsAt || !endsAt || startsAt >= endsAt) {
      throw new HttpError(400, "BOOKING_TIME_REQUIRED", "Un intervalle valide est requis pour confirmer la réservation.");
    }
  }

  const statusNote = payload.note ?? (payload.status === "REJECTED" ? "Refusée par le prestataire." : payload.cancellationReason ?? "");

  const updatedBooking = await prisma.$transaction(async (transaction) => {
    if (["ACCEPTED", "SCHEDULED"].includes(payload.status) && startsAt && endsAt) {
      const availability = await transaction.$queryRaw<Array<{ available: boolean }>>`
        SELECT
          EXISTS (
            SELECT 1 FROM "availability_slots" slot
            WHERE slot."provider_profile_id" = ${booking.providerProfile.id}::uuid
              AND slot."day_of_week" = EXTRACT(DOW FROM timezone(${booking.providerProfile.timeZone}, ${startsAt}::timestamptz))::int
              AND slot."starts_at" <= timezone(${booking.providerProfile.timeZone}, ${startsAt}::timestamptz)::time
              AND slot."ends_at" >= timezone(${booking.providerProfile.timeZone}, ${endsAt}::timestamptz)::time
              AND timezone(${booking.providerProfile.timeZone}, ${startsAt}::timestamptz)::date = timezone(${booking.providerProfile.timeZone}, ${endsAt}::timestamptz)::date
          )
          AND NOT EXISTS (
            SELECT 1 FROM "availability_exceptions" exception
            WHERE exception."provider_profile_id" = ${booking.providerProfile.id}::uuid
              AND exception."starts_at" < ${endsAt}::timestamptz
              AND exception."ends_at" > ${startsAt}::timestamptz
          )
          AND NOT EXISTS (
            SELECT 1 FROM "bookings" other
            WHERE other."provider_profile_id" = ${booking.providerProfile.id}::uuid
              AND other."id" <> ${id}::uuid
              AND other."status" IN ('ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'DISPUTED')
              AND other."starts_at" < ${endsAt}::timestamptz
              AND other."ends_at" > ${startsAt}::timestamptz
          ) AS available
      `;
      if (!availability[0]?.available) {
        throw new HttpError(409, "PROVIDER_NOT_AVAILABLE", "Le créneau demandé ne respecte pas les disponibilités du prestataire.");
      }
    }
    await transaction.$executeRaw`SELECT set_config('app.actor_id', ${userId}, true)`;
    await transaction.$executeRaw`SELECT set_config('app.status_note', ${statusNote}, true)`;
    const updateResult = await transaction.booking.updateMany({
      where: { id, status: booking.status },
      data: {
        status: payload.status,
        ...(payload.agreedPrice !== undefined ? { agreedPrice: payload.agreedPrice.toFixed(2) } : {}),
        ...(startsAt ? { startsAt } : {}),
        ...(endsAt ? { endsAt } : {}),
        ...(payload.status === "CANCELLED" ? { cancelledAt: new Date(), startedAt: null, ...(payload.cancellationReason ? { cancellationReason: payload.cancellationReason } : {}) } : {}),
        ...(payload.status === "IN_PROGRESS" ? { startedAt: new Date() } : {}),
        ...(payload.status === "COMPLETED" ? { completedAt: new Date() } : {}),
      },
    });
    if (!updateResult.count) throw new HttpError(409, "BOOKING_CHANGED", "La réservation a changé simultanément. Rechargez-la puis réessayez.");
    return transaction.booking.findUniqueOrThrow({ where: { id } });
  });

  response.status(200).json({ data: updatedBooking });
};

export const bookingRouter = Router();
bookingRouter.use(requireUserAuthentication);
bookingRouter.get("/", listBookings);
bookingRouter.post("/", validateBody(createBookingSchema), createBooking);
bookingRouter.get("/:id", validateParams(bookingIdSchema), getBooking);
bookingRouter.patch("/:id/status", validateParams(bookingIdSchema), validateBody(bookingStatusSchema), updateBookingStatus);
