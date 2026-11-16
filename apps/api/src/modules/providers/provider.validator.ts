import { z } from "zod";
import {
  geoLocationSchema,
  portfolioMediaRefSchema,
  providerApplicationSchema,
  providerOnboardingFormSchema,
  type GeoLocation,
  type ProviderApplication,
} from "@liena/shared-schemas";

const categoryIdSchema = z.coerce.number().int().positive();

export const publicListQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional().transform((value) => value || undefined),
    zone: z.string().trim().max(160).optional().transform((value) => value || undefined),
    categoryId: categoryIdSchema.optional(),
    service: z.string().trim().min(1).max(120).optional().transform((value) => value || undefined),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
    clientLat: z.coerce.number().min(-90).max(90).optional(),
    clientLon: z.coerce.number().min(-180).max(180).optional(),
  })
  .strict()
  .refine(
    (value) =>
      (value.clientLat === undefined && value.clientLon === undefined) ||
      (value.clientLat !== undefined && value.clientLon !== undefined),
    { message: "clientLat and clientLon must be provided together." },
  );

export const providerIdParamsSchema = z
  .object({ id: z.string().regex(/^[1-9]\d*$/) })
  .strict();

export const providerLocationSchema = geoLocationSchema;
export const providerMediaRefSchema = portfolioMediaRefSchema;
export const providerProfileCreateSchema = providerOnboardingFormSchema;
export const providerProfileApplicationSchema = providerApplicationSchema;
export const providerProfileUpdateSchema = providerProfileCreateSchema.partial().strict();

export type PublicListQuery = z.output<typeof publicListQuerySchema>;
export type ProviderProfileCreate = z.output<typeof providerProfileCreateSchema>;
export type ProviderProfileUpdate = z.output<typeof providerProfileUpdateSchema>;
export type ProviderProfileApplication = ProviderApplication;
export type ProviderProfileInsert = ProviderProfileCreate & {
  location?: GeoLocation;
  mediaRefs?: z.output<typeof portfolioMediaRefSchema>[];
};
export type ProviderLocation = GeoLocation;
export type ProviderMediaRef = z.output<typeof portfolioMediaRefSchema>;
