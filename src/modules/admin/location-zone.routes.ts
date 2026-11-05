import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { HttpError } from "../../http/errors";
import { validateBody, validateParams } from "../../http/middleware/validate";
import { prisma } from "../../lib/prisma";
import { requireAdmin } from "../admin-auth/security";

const idParamsSchema = z.object({ id: z.string().uuid() }).strict();
const listQuerySchema = z.object({
  countryCode: z.string().trim().length(2).optional(),
  city: z.string().trim().min(1).max(120).optional(),
  active: z.enum(["true", "false"]).optional(),
}).strict();
const publicListQuerySchema = z.object({
  countryCode: z.string().trim().length(2).optional(),
  city: z.string().trim().min(1).max(120).optional(),
}).strict();
const createZoneSchema = z.object({
  countryCode: z.string().trim().length(2).default("TG"),
  city: z.string().trim().min(2).max(120),
  neighborhood: z.string().trim().max(120).optional(),
  isActive: z.boolean().default(true),
}).strict();
const updateZoneSchema = z.object({
  countryCode: z.string().trim().length(2).optional(),
  city: z.string().trim().min(2).max(120).optional(),
  neighborhood: z.string().trim().max(120).optional(),
  isActive: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

const listZones: RequestHandler = async (request, response) => {
  const parsed = listQuerySchema.safeParse(request.query);
  if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "Les filtres de zone sont invalides.");
  const zones = await prisma.locationZone.findMany({
    where: {
      ...(parsed.data.countryCode ? { countryCode: parsed.data.countryCode.toUpperCase() } : {}),
      ...(parsed.data.city ? { city: { contains: parsed.data.city, mode: "insensitive" } } : {}),
      ...(parsed.data.active ? { isActive: parsed.data.active === "true" } : {}),
    },
    orderBy: [{ countryCode: "asc" }, { city: "asc" }, { neighborhood: "asc" }],
    include: { _count: { select: { providerProfiles: true, serviceRequests: true } } },
  });
  response.status(200).json({ data: zones });
};

const createZone: RequestHandler = async (request, response) => {
  const payload = request.body as z.output<typeof createZoneSchema>;
  const zone = await prisma.locationZone.create({
    data: {
      countryCode: payload.countryCode.toUpperCase(),
      city: payload.city,
      neighborhood: payload.neighborhood ?? "",
      isActive: payload.isActive,
    },
  });
  response.status(201).json({ data: zone });
};

const updateZone: RequestHandler<z.output<typeof idParamsSchema>> = async (request, response) => {
  const { id } = request.params as z.output<typeof idParamsSchema>;
  const payload = request.body as z.output<typeof updateZoneSchema>;
  const zone = await prisma.locationZone.update({
    where: { id },
    data: {
      ...(payload.countryCode !== undefined ? { countryCode: payload.countryCode.toUpperCase() } : {}),
      ...(payload.city !== undefined ? { city: payload.city } : {}),
      ...(payload.neighborhood !== undefined ? { neighborhood: payload.neighborhood } : {}),
      ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
    },
  });
  response.status(200).json({ data: zone });
};

const deactivateZone: RequestHandler<z.output<typeof idParamsSchema>> = async (request, response) => {
  const { id } = request.params as z.output<typeof idParamsSchema>;
  const result = await prisma.locationZone.updateMany({ where: { id, isActive: true }, data: { isActive: false } });
  if (!result.count) {
    const zone = await prisma.locationZone.findUnique({ where: { id }, select: { id: true } });
    if (!zone) throw new HttpError(404, "LOCATION_ZONE_NOT_FOUND", "La zone n’existe pas.");
  }
  const zone = await prisma.locationZone.findUniqueOrThrow({ where: { id } });
  response.status(200).json({ data: zone });
};

export const locationZoneRouter = Router();
locationZoneRouter.use(requireAdmin);
locationZoneRouter.get("/", listZones);
locationZoneRouter.post("/", validateBody(createZoneSchema), createZone);
locationZoneRouter.patch("/:id", validateParams(idParamsSchema), validateBody(updateZoneSchema), updateZone);
locationZoneRouter.delete("/:id", validateParams(idParamsSchema), deactivateZone);

export const publicLocationZoneRouter = Router();
publicLocationZoneRouter.get("/", async (request, response) => {
  const parsed = publicListQuerySchema.safeParse(request.query);
  if (!parsed.success) throw new HttpError(400, "VALIDATION_ERROR", "Les filtres de zone sont invalides.");
  const zones = await prisma.locationZone.findMany({
    where: {
      isActive: true,
      ...(parsed.data.countryCode ? { countryCode: parsed.data.countryCode.toUpperCase() } : {}),
      ...(parsed.data.city ? { city: { contains: parsed.data.city, mode: "insensitive" } } : {}),
    },
    orderBy: [{ countryCode: "asc" }, { city: "asc" }, { neighborhood: "asc" }],
    select: { id: true, countryCode: true, city: true, neighborhood: true },
  });
  response.status(200).json({ data: zones });
});