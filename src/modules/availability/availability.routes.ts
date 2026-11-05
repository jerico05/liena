import { UserRole } from "@prisma/client";
import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { HttpError } from "../../http/errors";
import { validateBody, validateParams } from "../../http/middleware/validate";
import { prisma } from "../../lib/prisma";
import { requireRequestUserId, requireUserAuthentication, requireUserRole } from "../shared/request-user";

const slotSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startsAt: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/),
  endsAt: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/),
}).strict();
const exceptionSchema = z.object({
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  reason: z.string().trim().max(500).optional(),
}).strict();
const idSchema = z.object({ id: z.string().uuid() }).strict();

async function getProviderProfileId(userId: string): Promise<string> {
  const profile = await prisma.providerProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) throw new HttpError(403, "PROVIDER_PROFILE_REQUIRED", "Aucun profil prestataire n’est associé à ce compte.");
  return profile.id;
}

const listAvailability: RequestHandler = async (request, response) => {
  const userId = requireRequestUserId(request);
  requireUserRole(request, UserRole.PROVIDER);
  const providerProfileId = await getProviderProfileId(userId);
  const [slots, exceptions] = await Promise.all([
    prisma.availabilitySlot.findMany({ where: { providerProfileId }, orderBy: [{ dayOfWeek: "asc" }, { startsAt: "asc" }] }),
    prisma.availabilityException.findMany({ where: { providerProfileId, endsAt: { gte: new Date() } }, orderBy: [{ startsAt: "asc" }, { id: "asc" }] }),
  ]);
  response.status(200).json({ data: { slots, exceptions } });
};

const createSlot: RequestHandler = async (request, response) => {
  const userId = requireRequestUserId(request);
  requireUserRole(request, UserRole.PROVIDER);
  const providerProfileId = await getProviderProfileId(userId);
  const payload = request.body as z.output<typeof slotSchema>;
  if (payload.startsAt >= payload.endsAt) throw new HttpError(400, "INVALID_TIME_RANGE", "L’heure de début doit précéder l’heure de fin.");
  const slot = await prisma.availabilitySlot.create({
    data: {
      providerProfileId,
      dayOfWeek: payload.dayOfWeek,
      startsAt: new Date(`1970-01-01T${payload.startsAt}Z`),
      endsAt: new Date(`1970-01-01T${payload.endsAt}Z`),
    },
  });
  response.status(201).json({ data: slot });
};

const deleteSlot: RequestHandler<z.output<typeof idSchema>> = async (request, response) => {
  const userId = requireRequestUserId(request);
  requireUserRole(request, UserRole.PROVIDER);
  const providerProfileId = await getProviderProfileId(userId);
  const { id } = request.params as z.output<typeof idSchema>;
  const result = await prisma.availabilitySlot.deleteMany({ where: { id, providerProfileId } });
  if (!result.count) throw new HttpError(404, "AVAILABILITY_SLOT_NOT_FOUND", "Ce créneau n’existe pas.");
  response.status(200).json({ data: { deleted: true } });
};

const createException: RequestHandler = async (request, response) => {
  const userId = requireRequestUserId(request);
  requireUserRole(request, UserRole.PROVIDER);
  const providerProfileId = await getProviderProfileId(userId);
  const payload = request.body as z.output<typeof exceptionSchema>;
  if (payload.startsAt <= new Date() || payload.startsAt >= payload.endsAt) {
    throw new HttpError(400, "INVALID_TIME_RANGE", "L’indisponibilité doit être future et sa fin postérieure au début.");
  }
  const exception = await prisma.availabilityException.create({
    data: { providerProfileId, startsAt: payload.startsAt, endsAt: payload.endsAt, reason: payload.reason ?? null },
  });
  response.status(201).json({ data: exception });
};

const deleteException: RequestHandler<z.output<typeof idSchema>> = async (request, response) => {
  const userId = requireRequestUserId(request);
  requireUserRole(request, UserRole.PROVIDER);
  const providerProfileId = await getProviderProfileId(userId);
  const { id } = request.params as z.output<typeof idSchema>;
  const result = await prisma.availabilityException.deleteMany({ where: { id, providerProfileId } });
  if (!result.count) throw new HttpError(404, "AVAILABILITY_EXCEPTION_NOT_FOUND", "Cette indisponibilité n’existe pas.");
  response.status(200).json({ data: { deleted: true } });
};

export const availabilityRouter = Router();
availabilityRouter.use(requireUserAuthentication);
availabilityRouter.get("/", listAvailability);
availabilityRouter.post("/slots", validateBody(slotSchema), createSlot);
availabilityRouter.delete("/slots/:id", validateParams(idSchema), deleteSlot);
availabilityRouter.post("/exceptions", validateBody(exceptionSchema), createException);
availabilityRouter.delete("/exceptions/:id", validateParams(idSchema), deleteException);