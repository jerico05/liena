import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { HttpError } from "../../http/errors";
import { validateBody, validateParams } from "../../http/middleware/validate";
import { prisma } from "../../lib/prisma";
import { requireRequestUserId, requireUserAuthentication } from "../shared/request-user";

const addressIdSchema = z.object({ id: z.string().uuid() }).strict();
const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  phone: z.string().trim().min(8).max(20).nullable().optional(),
  avatarUrl: z.string().url().max(2048).nullable().optional(),
}).strict().refine((value) => Object.keys(value).length > 0);
const addressObjectSchema = z.object({
  label: z.string().trim().max(80).optional(),
  recipient: z.string().trim().max(160).optional(),
  phone: z.string().trim().min(8).max(20).optional(),
  countryCode: z.string().trim().length(2).default("TG"),
  city: z.string().trim().min(2).max(120),
  neighborhood: z.string().trim().max(120).optional(),
  street: z.string().trim().max(200).optional(),
  details: z.string().trim().max(1000).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  isDefault: z.boolean().default(false),
}).strict();
const coordinatesArePaired = (value: { latitude?: number; longitude?: number }) =>
  (value.latitude === undefined) === (value.longitude === undefined);
const coordinatePairIssue = {
  message: "Latitude et longitude doivent être fournies ensemble.",
  path: ["latitude"],
} as const;
const addressSchema = addressObjectSchema.refine(coordinatesArePaired, coordinatePairIssue);
const updateAddressSchema = addressObjectSchema.partial()
  .extend({ countryCode: z.string().trim().length(2).optional() })
  .strict()
  .refine((value) => Object.keys(value).length > 0)
  .refine(coordinatesArePaired, coordinatePairIssue);

const getMyProfile: RequestHandler = async (request, response) => {
  const userId = requireRequestUserId(request);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true, roles: true, status: true, emailVerifiedAt: true, phoneVerifiedAt: true, createdAt: true },
  });
  if (!user) throw new HttpError(404, "USER_NOT_FOUND", "Le compte n’existe pas.");
  response.status(200).json({ data: user });
};

const updateMyProfile: RequestHandler = async (request, response) => {
  const userId = requireRequestUserId(request);
  const payload = request.body as z.output<typeof updateProfileSchema>;
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(payload.firstName !== undefined ? { firstName: payload.firstName } : {}),
      ...(payload.lastName !== undefined ? { lastName: payload.lastName } : {}),
      ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
      ...(payload.avatarUrl !== undefined ? { avatarUrl: payload.avatarUrl } : {}),
    },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatarUrl: true, updatedAt: true },
  });
  response.status(200).json({ data: user });
};

const listAddresses: RequestHandler = async (request, response) => {
  const userId = requireRequestUserId(request);
  const addresses = await prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }, { id: "asc" }] });
  response.status(200).json({ data: addresses });
};

const createAddress: RequestHandler = async (request, response) => {
  const userId = requireRequestUserId(request);
  const payload = request.body as z.output<typeof addressSchema>;
  const address = await prisma.$transaction(async (transaction) => {
    if (payload.isDefault) await transaction.address.updateMany({ where: { userId }, data: { isDefault: false } });
    return transaction.address.create({
      data: {
        userId,
        label: payload.label ?? null,
        recipient: payload.recipient ?? null,
        phone: payload.phone ?? null,
        countryCode: payload.countryCode.toUpperCase(),
        city: payload.city,
        neighborhood: payload.neighborhood ?? null,
        street: payload.street ?? null,
        details: payload.details ?? null,
        latitude: payload.latitude ?? null,
        longitude: payload.longitude ?? null,
        isDefault: payload.isDefault,
      },
    });
  });
  response.status(201).json({ data: address });
};

const updateAddress: RequestHandler<z.output<typeof addressIdSchema>> = async (request, response) => {
  const userId = requireRequestUserId(request);
  const { id } = request.params as z.output<typeof addressIdSchema>;
  const payload = request.body as z.output<typeof updateAddressSchema>;
  if ((payload.latitude === undefined) !== (payload.longitude === undefined)) {
    throw new HttpError(400, "INVALID_COORDINATES", "Latitude et longitude doivent être modifiées ensemble.");
  }
  const current = await prisma.address.findFirst({ where: { id, userId }, select: { id: true } });
  if (!current) throw new HttpError(404, "ADDRESS_NOT_FOUND", "L’adresse n’existe pas.");
  const address = await prisma.$transaction(async (transaction) => {
    if (payload.isDefault) await transaction.address.updateMany({ where: { userId, id: { not: id } }, data: { isDefault: false } });
    return transaction.address.update({
      where: { id },
      data: {
        ...(payload.label !== undefined ? { label: payload.label } : {}),
        ...(payload.recipient !== undefined ? { recipient: payload.recipient } : {}),
        ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
        ...(payload.countryCode !== undefined ? { countryCode: payload.countryCode.toUpperCase() } : {}),
        ...(payload.city !== undefined ? { city: payload.city } : {}),
        ...(payload.neighborhood !== undefined ? { neighborhood: payload.neighborhood } : {}),
        ...(payload.street !== undefined ? { street: payload.street } : {}),
        ...(payload.details !== undefined ? { details: payload.details } : {}),
        ...(payload.latitude !== undefined ? { latitude: payload.latitude } : {}),
        ...(payload.longitude !== undefined ? { longitude: payload.longitude } : {}),
        ...(payload.isDefault !== undefined ? { isDefault: payload.isDefault } : {}),
      },
    });
  });
  response.status(200).json({ data: address });
};

const deleteAddress: RequestHandler<z.output<typeof addressIdSchema>> = async (request, response) => {
  const userId = requireRequestUserId(request);
  const { id } = request.params as z.output<typeof addressIdSchema>;
  const result = await prisma.address.deleteMany({ where: { id, userId } });
  if (!result.count) throw new HttpError(404, "ADDRESS_NOT_FOUND", "L’adresse n’existe pas.");
  response.status(200).json({ data: { deleted: true } });
};

export const userRouter = Router();
userRouter.use(requireUserAuthentication);
userRouter.get("/me", getMyProfile);
userRouter.patch("/me", validateBody(updateProfileSchema), updateMyProfile);
userRouter.get("/me/addresses", listAddresses);
userRouter.post("/me/addresses", validateBody(addressSchema), createAddress);
userRouter.patch("/me/addresses/:id", validateParams(addressIdSchema), validateBody(updateAddressSchema), updateAddress);
userRouter.delete("/me/addresses/:id", validateParams(addressIdSchema), deleteAddress);