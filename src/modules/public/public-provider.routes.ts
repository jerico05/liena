import { Prisma, ProviderStatus, ServiceStatus, UserRole, UserStatus } from "@prisma/client";
import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { HttpError } from "../../http/errors";
import { validateBody, validateParams } from "../../http/middleware/validate";
import { prisma } from "../../lib/prisma";
import {
  requireRequestUserId,
  requireUserAuthentication,
  requireUserRole,
} from "../shared/request-user";

const providerRegistrationSchema = z
  .object({
    professionCategoryId: z.string().uuid(),
    locationZoneId: z.string().uuid().optional(),
    businessName: z.string().trim().min(2).max(160),
    description: z.string().trim().max(2000).optional(),
    city: z.string().trim().min(2).max(120).optional(),
    neighborhood: z.string().trim().max(120).optional(),
    countryCode: z.string().trim().length(2).default("TG"),
  })
  .strict()
  .refine((value) => Boolean(value.locationZoneId || value.city), { message: "Une zone ou une ville est requise.", path: ["city"] });

const providerSlugParamsSchema = z.object({ slug: z.string().trim().min(1).max(120) }).strict();
const providerServiceParamsSchema = z.object({ slug: z.string().trim().min(1).max(120), serviceId: z.string().uuid() }).strict();

const createServiceSchema = z
  .object({
    categoryId: z.string().uuid(),
    title: z.string().trim().min(3).max(160),
    description: z.string().trim().min(20).max(5000),
    pricingType: z.enum(["FIXED", "HOURLY", "DAILY", "QUOTE"]).default("FIXED"),
    price: z.coerce.number().min(0).max(1_000_000_000).optional(),
    currency: z.string().trim().length(3).default("XOF"),
    durationMinutes: z.coerce.number().int().min(15).max(10080).optional(),
    city: z.string().trim().max(120).optional(),
    neighborhood: z.string().trim().max(120).optional(),
    countryCode: z.string().trim().length(2).optional(),
    isRemote: z.boolean().default(false),
  })
  .strict();

const updateServiceSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  description: z.string().trim().min(20).max(5000).optional(),
  pricingType: z.enum(["FIXED", "HOURLY", "DAILY", "QUOTE"]).optional(),
  price: z.coerce.number().min(0).max(1_000_000_000).nullable().optional(),
  durationMinutes: z.coerce.number().int().min(15).max(10080).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  neighborhood: z.string().trim().max(120).nullable().optional(),
  status: z.enum(["PUBLISHED", "PAUSED", "ARCHIVED"]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "At least one field is required.");
const updateProviderProfileSchema = z.object({
  locationZoneId: z.string().uuid().nullable().optional(),
  businessName: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  city: z.string().trim().min(2).max(120).optional(),
  neighborhood: z.string().trim().max(120).nullable().optional(),
  countryCode: z.string().trim().length(2).optional(),
}).strict().refine((value) => Object.keys(value).length > 0);

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "prestataire";
}

async function ensureUniqueSlug(base: string, field: "slug", model: "providerProfile" | "service") {
  let candidate = slugify(base);
  let suffix = 1;

  while (true) {
    const existing =
      model === "providerProfile"
        ? await prisma.providerProfile.findUnique({ where: { slug: candidate } })
        : await prisma.service.findFirst({
            where: { slug: candidate },
          });

    if (!existing) {
      return candidate;
    }

    candidate = `${slugify(base)}-${suffix}`;
    suffix += 1;
  }
}

const createProviderRegistration: RequestHandler = async (request, response) => {
  const userId = requireRequestUserId(request);
  requireUserRole(request, UserRole.CLIENT);
  const body = request.body as z.output<typeof providerRegistrationSchema>;

  const existingProfile = await prisma.providerProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (existingProfile) {
    throw new HttpError(409, "PROVIDER_PROFILE_ALREADY_EXISTS", "Une demande prestataire existe déjà pour ce compte.");
  }

  const profession = await prisma.category.findFirst({
    where: {
      id: body.professionCategoryId,
      isActive: true,
      parentId: { not: null },
      parent: { is: { isActive: true } },
      children: { none: { isActive: true } },
    },
    select: { id: true },
  });
  if (!profession) {
    throw new HttpError(400, "INVALID_PROFESSION", "Choisissez un métier actif du catalogue.");
  }

  const zone = body.locationZoneId
    ? await prisma.locationZone.findFirst({ where: { id: body.locationZoneId, isActive: true } })
    : body.city
      ? await prisma.locationZone.findFirst({
          where: {
            isActive: true,
            countryCode: body.countryCode.toUpperCase(),
            city: { equals: body.city, mode: "insensitive" },
            neighborhood: { equals: body.neighborhood ?? "", mode: "insensitive" },
          },
        })
      : null;
  if (body.locationZoneId && !zone) throw new HttpError(400, "LOCATION_ZONE_INACTIVE", "Choisissez une zone géographique active.");

  const providerProfileSlug = await ensureUniqueSlug(body.businessName, "slug", "providerProfile");

  const registration = await prisma.$transaction(async (transaction) => {
    const providerProfile = await transaction.providerProfile.create({
      data: {
        userId,
        professionCategoryId: profession.id,
        locationZoneId: zone?.id ?? null,
        businessName: body.businessName,
        slug: providerProfileSlug,
        description: body.description ?? null,
        status: ProviderStatus.PENDING,
        countryCode: zone?.countryCode ?? body.countryCode.toUpperCase(),
        city: zone?.city ?? body.city!,
        neighborhood: zone ? zone.neighborhood || null : body.neighborhood ?? null,
      },
      select: { id: true, slug: true, status: true, businessName: true },
    });

    await transaction.user.update({
      where: { id: userId },
      data: { roles: { set: [...new Set([...(request.user?.roles ?? []), UserRole.PROVIDER])] } },
    });

    return providerProfile;
  });

  response.status(201).json({
    data: {
      userId,
      providerProfileId: registration.id,
      status: registration.status,
      slug: registration.slug,
      businessName: registration.businessName,
    },
  });
};

const getOwnProviderProfile: RequestHandler = async (request, response) => {
  const userId = requireRequestUserId(request);
  const profile = await prisma.providerProfile.findUnique({
    where: { userId },
    select: {
      id: true, businessName: true, slug: true, description: true, status: true,
      countryCode: true, city: true, neighborhood: true, verifiedAt: true, createdAt: true, updatedAt: true,
      profession: { select: { id: true, name: true, slug: true, parent: { select: { id: true, name: true, slug: true } } } },
    },
  });
  if (!profile) throw new HttpError(404, "PROVIDER_PROFILE_NOT_FOUND", "Aucun profil prestataire n’est associé à ce compte.");
  response.status(200).json({ data: profile });
};

const updateOwnProviderProfile: RequestHandler = async (request, response) => {
  const userId = requireRequestUserId(request);
  const payload = request.body as z.output<typeof updateProviderProfileSchema>;
  const zone = payload.locationZoneId
    ? await prisma.locationZone.findFirst({ where: { id: payload.locationZoneId, isActive: true } })
    : null;
  if (payload.locationZoneId && !zone) throw new HttpError(400, "LOCATION_ZONE_INACTIVE", "Choisissez une zone géographique active.");
  const profile = await prisma.providerProfile.findUnique({ where: { userId }, select: { id: true } });
  if (!profile) throw new HttpError(404, "PROVIDER_PROFILE_NOT_FOUND", "Aucun profil prestataire n’est associé à ce compte.");
  const updated = await prisma.providerProfile.update({
    where: { id: profile.id },
    data: {
      ...(payload.locationZoneId !== undefined ? { locationZoneId: zone?.id ?? null } : {}),
      ...(payload.locationZoneId === undefined && (payload.city !== undefined || payload.neighborhood !== undefined || payload.countryCode !== undefined) ? { locationZoneId: null } : {}),
      ...(payload.businessName !== undefined ? { businessName: payload.businessName } : {}),
      ...(payload.description !== undefined ? { description: payload.description } : {}),
      ...(payload.city !== undefined ? { city: payload.city } : {}),
      ...(payload.neighborhood !== undefined ? { neighborhood: payload.neighborhood } : {}),
      ...(payload.countryCode !== undefined ? { countryCode: payload.countryCode.toUpperCase() } : {}),
      ...(zone ? { countryCode: zone.countryCode, city: zone.city, neighborhood: zone.neighborhood || null } : {}),
      ...(payload.locationZoneId === null ? { locationZoneId: null } : {}),
    },
    select: { id: true, businessName: true, slug: true, description: true, status: true, countryCode: true, city: true, neighborhood: true, professionCategoryId: true, updatedAt: true },
  });
  response.status(200).json({ data: updated });
};

const listProviderServices: RequestHandler = async (request, response) => {
  const { slug } = request.params as z.output<typeof providerSlugParamsSchema>;
  const provider = await prisma.providerProfile.findUnique({
    where: { slug },
    select: {
      id: true,
      businessName: true,
      status: true,
      user: { select: { status: true } },
    },
  });

  if (!provider || provider.status !== ProviderStatus.VERIFIED || provider.user.status !== UserStatus.ACTIVE) {
    throw new HttpError(404, "PROVIDER_NOT_FOUND", "Ce prestataire est introuvable ou n’est pas disponible.");
  }

  const services = await prisma.service.findMany({
    where: {
      providerProfileId: provider.id,
      status: ServiceStatus.PUBLISHED,
      deletedAt: null,
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      pricingType: true,
      price: true,
      currency: true,
      durationMinutes: true,
      city: true,
      neighborhood: true,
      category: { select: { id: true, name: true, slug: true } },
    },
  });

  response.status(200).json({ data: services });
};

const listOwnProviderServices: RequestHandler = async (request, response) => {
  const userId = requireRequestUserId(request);
  const { slug } = request.params as z.output<typeof providerSlugParamsSchema>;
  const provider = await prisma.providerProfile.findFirst({ where: { slug, userId }, select: { id: true } });
  if (!provider) throw new HttpError(404, "PROVIDER_PROFILE_NOT_FOUND", "Votre profil prestataire est introuvable.");
  const services = await prisma.service.findMany({
    where: { providerProfileId: provider.id, deletedAt: null },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: { id: true, title: true, slug: true, status: true, pricingType: true, price: true, currency: true, category: { select: { id: true, name: true, slug: true } }, createdAt: true, updatedAt: true },
  });
  response.status(200).json({ data: services });
};

const createProviderService: RequestHandler = async (request, response) => {
  const userId = requireRequestUserId(request);
  requireUserRole(request, UserRole.PROVIDER);
  const { slug } = request.params as z.output<typeof providerSlugParamsSchema>;
  const payload = request.body as z.output<typeof createServiceSchema>;

  const providerProfile = await prisma.providerProfile.findFirst({
    where: {
      slug,
      userId,
      status: ProviderStatus.VERIFIED,
      user: { status: UserStatus.ACTIVE },
    },
    select: { id: true, professionCategoryId: true },
  });

  if (!providerProfile) {
    throw new HttpError(403, "ACCESS_DENIED", "Vous ne pouvez pas créer de service pour ce profil.");
  }

  if (providerProfile.professionCategoryId !== payload.categoryId) {
    throw new HttpError(409, "PROFESSION_CATEGORY_MISMATCH", "La prestation doit appartenir au métier choisi pour ce profil.");
  }

  if (payload.pricingType !== "QUOTE" && payload.price === undefined) {
    throw new HttpError(400, "INVALID_PRICE", "Un prix est requis pour ce type de tarification.");
  }

  const slugCandidate = await ensureUniqueSlug(payload.title, "slug", "service");
  const service = await prisma.service.create({
    data: {
      providerProfileId: providerProfile.id,
      categoryId: payload.categoryId,
      title: payload.title,
      slug: slugCandidate,
      description: payload.description,
      pricingType: payload.pricingType,
      price: payload.price !== undefined ? payload.price.toString() : null,
      currency: payload.currency,
      durationMinutes: payload.durationMinutes ?? null,
      status: ServiceStatus.DRAFT,
      isRemote: payload.isRemote,
      countryCode: payload.countryCode ?? null,
      city: payload.city ?? null,
      neighborhood: payload.neighborhood ?? null,
    },
    select: {
      id: true,
      slug: true,
      title: true,
      pricingType: true,
      status: true,
    },
  });

  response.status(201).json({ data: service });
};

const updateProviderService: RequestHandler<z.output<typeof providerServiceParamsSchema>> = async (request, response) => {
  const userId = requireRequestUserId(request);
  requireUserRole(request, UserRole.PROVIDER);
  const { slug, serviceId } = request.params as z.output<typeof providerServiceParamsSchema>;
  const payload = request.body as z.output<typeof updateServiceSchema>;
  const profile = await prisma.providerProfile.findFirst({
    where: { slug, userId },
    select: { id: true, professionCategoryId: true, status: true },
  });
  if (!profile) throw new HttpError(404, "PROVIDER_PROFILE_NOT_FOUND", "Votre profil prestataire est introuvable.");
  const service = await prisma.service.findFirst({
    where: { id: serviceId, providerProfileId: profile.id, deletedAt: null },
    select: { id: true, status: true, pricingType: true, price: true, categoryId: true },
  });
  if (!service) throw new HttpError(404, "SERVICE_NOT_FOUND", "La prestation n’existe pas.");
  const allowedStatuses: Record<string, string[]> = {
    DRAFT: ["PUBLISHED", "ARCHIVED"],
    PUBLISHED: ["PAUSED", "ARCHIVED"],
    PAUSED: ["PUBLISHED", "ARCHIVED"],
    ARCHIVED: [],
  };
  if (payload.status && !allowedStatuses[service.status].includes(payload.status)) {
    throw new HttpError(409, "SERVICE_TRANSITION_INVALID", "Cette transition de prestation n’est pas autorisée.");
  }
  const pricingType = payload.pricingType ?? service.pricingType;
  const price = payload.pricingType === "QUOTE" && payload.price === undefined
    ? null
    : payload.price === undefined ? service.price : payload.price;
  if (pricingType !== "QUOTE" && price === null) throw new HttpError(400, "INVALID_PRICE", "Un prix est requis pour ce type de tarification.");
  if (pricingType === "QUOTE" && payload.price !== undefined && payload.price !== null) throw new HttpError(400, "INVALID_PRICE", "Une prestation sur devis ne peut pas avoir de prix fixe.");
  if (payload.status === "PUBLISHED" && profile.status !== ProviderStatus.VERIFIED) {
    throw new HttpError(409, "PROVIDER_NOT_VERIFIED", "Le profil doit être vérifié avant de publier une prestation.");
  }
  if (payload.status === "PUBLISHED") {
    const category = await prisma.category.findFirst({ where: { id: service.categoryId, isActive: true }, select: { id: true } });
    if (!category) throw new HttpError(409, "CATEGORY_INACTIVE", "Une catégorie active est requise pour publier cette prestation.");
  }
  const updateData = {
    ...(payload.title !== undefined ? { title: payload.title } : {}),
    ...(payload.description !== undefined ? { description: payload.description } : {}),
    ...(payload.pricingType !== undefined ? { pricingType: payload.pricingType } : {}),
    ...(payload.price !== undefined || payload.pricingType === "QUOTE" ? { price: price === null ? null : price.toFixed(2) } : {}),
    ...(payload.durationMinutes !== undefined ? { durationMinutes: payload.durationMinutes } : {}),
    ...(payload.city !== undefined ? { city: payload.city } : {}),
    ...(payload.neighborhood !== undefined ? { neighborhood: payload.neighborhood } : {}),
    ...(payload.status !== undefined ? { status: payload.status as ServiceStatus, ...(payload.status === "ARCHIVED" ? { deletedAt: new Date() } : {}) } : {}),
  };
  const result = await prisma.service.updateMany({ where: { id: serviceId, providerProfileId: profile.id, status: service.status, deletedAt: null }, data: updateData });
  if (!result.count) throw new HttpError(409, "SERVICE_CHANGED", "La prestation a été modifiée simultanément. Rechargez-la puis réessayez.");
  const updated = await prisma.service.findUniqueOrThrow({ where: { id: serviceId } });
  response.status(200).json({ data: updated });
};

const deleteProviderService: RequestHandler<z.output<typeof providerServiceParamsSchema>> = async (request, response) => {
  const userId = requireRequestUserId(request);
  requireUserRole(request, UserRole.PROVIDER);
  const { slug, serviceId } = request.params as z.output<typeof providerServiceParamsSchema>;
  const profile = await prisma.providerProfile.findFirst({ where: { slug, userId }, select: { id: true } });
  if (!profile) throw new HttpError(404, "PROVIDER_PROFILE_NOT_FOUND", "Votre profil prestataire est introuvable.");
  const result = await prisma.service.updateMany({
    where: { id: serviceId, providerProfileId: profile.id, deletedAt: null },
    data: { status: ServiceStatus.ARCHIVED, deletedAt: new Date() },
  });
  if (!result.count) throw new HttpError(404, "SERVICE_NOT_FOUND", "La prestation n’existe pas.");
  response.status(200).json({ data: { id: serviceId, deleted: true } });
};

export const publicProviderRouter = Router();
publicProviderRouter.get("/me/profile", requireUserAuthentication, getOwnProviderProfile);
publicProviderRouter.patch("/me/profile", requireUserAuthentication, validateBody(updateProviderProfileSchema), updateOwnProviderProfile);
publicProviderRouter.post("/register", requireUserAuthentication, validateBody(providerRegistrationSchema), createProviderRegistration);
publicProviderRouter.get("/:slug/services/manage", requireUserAuthentication, validateParams(providerSlugParamsSchema), listOwnProviderServices);
publicProviderRouter.get("/:slug/services", validateParams(providerSlugParamsSchema), listProviderServices);
publicProviderRouter.post(
  "/:slug/services",
  requireUserAuthentication,
  validateParams(providerSlugParamsSchema),
  validateBody(createServiceSchema),
  createProviderService,
);
publicProviderRouter.patch(
  "/:slug/services/:serviceId",
  requireUserAuthentication,
  validateParams(providerServiceParamsSchema),
  validateBody(updateServiceSchema),
  updateProviderService,
);
publicProviderRouter.delete(
  "/:slug/services/:serviceId",
  requireUserAuthentication,
  validateParams(providerServiceParamsSchema),
  deleteProviderService,
);
