import { MissionStatus, UserRole } from "@prisma/client";
import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { HttpError } from "../../http/errors";
import { validateBody, validateParams } from "../../http/middleware/validate";
import { prisma } from "../../lib/prisma";
import { requireRequestUserId, requireUserAuthentication, requireUserRole } from "../shared/request-user";

const missionIdSchema = z.object({ id: z.string().uuid() }).strict();
const missionUpdateSchema = z.object({
  status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "DISPUTED"]),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
}).strict();

const listMissions: RequestHandler = async (request, response) => {
  const userId = requireRequestUserId(request);
  const missions = await prisma.mission.findMany({
    where: { OR: [{ clientId: userId }, { providerProfile: { userId } }] },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    include: {
      quote: { select: { amount: true, currency: true, message: true } },
      serviceRequest: { select: { id: true, reference: true, title: true, city: true } },
      providerProfile: { select: { id: true, businessName: true, slug: true } },
    },
  });
  response.status(200).json({ data: missions });
};

const getMission: RequestHandler<z.output<typeof missionIdSchema>> = async (request, response) => {
  const userId = requireRequestUserId(request);
  const { id } = request.params as z.output<typeof missionIdSchema>;
  const mission = await prisma.mission.findUnique({
    where: { id },
    include: {
      quote: { select: { id: true, amount: true, currency: true, message: true, estimatedDurationDays: true } },
      serviceRequest: { select: { id: true, reference: true, title: true, description: true, city: true, neighborhood: true, requestedStartsAt: true } },
      providerProfile: { select: { id: true, userId: true, businessName: true, slug: true } },
    },
  });
  if (!mission) throw new HttpError(404, "MISSION_NOT_FOUND", "La mission n’existe pas.");
  if (mission.clientId !== userId && mission.providerProfile.userId !== userId) throw new HttpError(403, "ACCESS_DENIED", "Vous ne pouvez pas consulter cette mission.");
  response.status(200).json({ data: mission });
};

const updateMissionStatus: RequestHandler<z.output<typeof missionIdSchema>> = async (request, response) => {
  const userId = requireRequestUserId(request);
  const { id } = request.params as z.output<typeof missionIdSchema>;
  const { status, startsAt, endsAt } = request.body as z.output<typeof missionUpdateSchema>;
  const mission = await prisma.mission.findUnique({
    where: { id },
    select: { id: true, clientId: true, providerProfile: { select: { id: true, userId: true, timeZone: true } }, status: true },
  });
  if (!mission) throw new HttpError(404, "MISSION_NOT_FOUND", "La mission n’existe pas.");
  const isClient = mission.clientId === userId;
  const isProvider = mission.providerProfile.userId === userId;
  if (!isClient && !isProvider) throw new HttpError(403, "ACCESS_DENIED", "Vous ne pouvez pas modifier cette mission.");
  if ((status === "SCHEDULED" || status === "IN_PROGRESS" || status === "COMPLETED") && !isProvider) {
    throw new HttpError(403, "ACCESS_DENIED", "Seul le prestataire peut faire avancer cette mission.");
  }
  if ((status === "SCHEDULED" || status === "IN_PROGRESS" || status === "COMPLETED") && isProvider) {
    requireUserRole(request, UserRole.PROVIDER);
  }
  if ((status === "DISPUTED" || status === "CANCELLED") && !isClient && !isProvider) {
    throw new HttpError(403, "ACCESS_DENIED", "Seuls les participants peuvent modifier cette mission.");
  }
  const transitionAllowed =
    (mission.status === MissionStatus.CONFIRMED && (status === "SCHEDULED" || status === "CANCELLED")) ||
    (mission.status === MissionStatus.SCHEDULED && (status === "IN_PROGRESS" || status === "CANCELLED")) ||
    (mission.status === MissionStatus.IN_PROGRESS && (status === "COMPLETED" || status === "DISPUTED")) ||
    (mission.status === MissionStatus.DISPUTED && (status === "COMPLETED" || status === "CANCELLED"));
  if (!transitionAllowed) throw new HttpError(409, "MISSION_TRANSITION_INVALID", "Cette transition de mission n’est pas autorisée.");
  if ((startsAt || endsAt) && status !== "SCHEDULED") throw new HttpError(400, "MISSION_TIME_NOT_EDITABLE", "Le créneau ne peut être modifié que lors de la planification.");
  if (status === "SCHEDULED" && (!startsAt || !endsAt || startsAt <= new Date() || startsAt >= endsAt)) {
    throw new HttpError(400, "MISSION_TIME_REQUIRED", "Une période future valide est requise pour planifier la mission.");
  }

  const updated = await prisma.$transaction(async (transaction) => {
    if (status === "SCHEDULED" && startsAt && endsAt) {
      const availability = await transaction.$queryRaw<Array<{ available: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM "availability_slots" slot
          WHERE slot."provider_profile_id" = ${mission.providerProfile.id}::uuid
            AND slot."day_of_week" = EXTRACT(DOW FROM timezone(${mission.providerProfile.timeZone}, ${startsAt}::timestamptz))::int
            AND slot."starts_at" <= timezone(${mission.providerProfile.timeZone}, ${startsAt}::timestamptz)::time
            AND slot."ends_at" >= timezone(${mission.providerProfile.timeZone}, ${endsAt}::timestamptz)::time
            AND timezone(${mission.providerProfile.timeZone}, ${startsAt}::timestamptz)::date = timezone(${mission.providerProfile.timeZone}, ${endsAt}::timestamptz)::date
        )
        AND NOT EXISTS (
          SELECT 1 FROM "availability_exceptions" exception
          WHERE exception."provider_profile_id" = ${mission.providerProfile.id}::uuid
            AND exception."starts_at" < ${endsAt}::timestamptz AND exception."ends_at" > ${startsAt}::timestamptz
        )
        AND NOT EXISTS (
          SELECT 1 FROM "missions" other
          WHERE other."provider_profile_id" = ${mission.providerProfile.id}::uuid
            AND other."id" <> ${id}::uuid AND other."status" IN ('SCHEDULED', 'IN_PROGRESS', 'DISPUTED')
            AND other."starts_at" < ${endsAt}::timestamptz AND other."ends_at" > ${startsAt}::timestamptz
        )
        AND NOT EXISTS (
          SELECT 1 FROM "bookings" booking
          WHERE booking."provider_profile_id" = ${mission.providerProfile.id}::uuid
            AND booking."status" IN ('ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'DISPUTED')
            AND booking."starts_at" < ${endsAt}::timestamptz AND booking."ends_at" > ${startsAt}::timestamptz
        ) AS available
      `;
      if (!availability[0]?.available) throw new HttpError(409, "PROVIDER_NOT_AVAILABLE", "Le créneau demandé ne respecte pas les disponibilités du prestataire.");
    }
    const result = await transaction.mission.updateMany({
      where: { id, status: mission.status },
      data: {
        status,
        ...(status === "SCHEDULED" ? { startsAt, endsAt } : {}),
        ...(status === "IN_PROGRESS" ? { startedAt: new Date() } : {}),
        ...(status === "COMPLETED" ? { completedAt: new Date() } : {}),
        ...(status === "CANCELLED" ? { cancelledAt: new Date(), startedAt: null } : {}),
      },
    });
    if (!result.count) throw new HttpError(409, "MISSION_CHANGED", "La mission a été modifiée simultanément.");
    await transaction.notification.createMany({
      data: [
        { userId: mission.clientId, type: "MISSION", title: "Mise à jour de mission", body: `Statut : ${status}.`, data: { missionId: id, status } },
        { userId: mission.providerProfile.userId, type: "MISSION", title: "Mise à jour de mission", body: `Statut : ${status}.`, data: { missionId: id, status } },
      ],
    });
    return transaction.mission.findUniqueOrThrow({ where: { id } });
  });
  response.status(200).json({ data: updated });
};

export const missionRouter = Router();
missionRouter.use(requireUserAuthentication);
missionRouter.get("/", listMissions);
missionRouter.get("/:id", validateParams(missionIdSchema), getMission);
missionRouter.patch("/:id/status", validateParams(missionIdSchema), validateBody(missionUpdateSchema), updateMissionStatus);