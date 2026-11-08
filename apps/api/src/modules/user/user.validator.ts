import { z } from "zod";

export const publicListQuerySchema = z.object({
  q: z.string().trim().max(100).optional().transform((value) => value || undefined),
  city: z.string().trim().max(120).optional().transform((value) => value || undefined),
  neighborhood: z.string().trim().max(120).optional().transform((value) => value || undefined),
  categoryId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
}).strict();

export const slugParamsSchema = z.object({ slug: z.string().trim().min(1).max(160) }).strict();

export const providerProfileCreateSchema = z.object({
  businessName: z.string().trim().min(2).max(160),
  description: z.string().trim().max(10_000).optional(),
  professionCategoryId: z.string().uuid().optional(),
  countryCode: z.string().trim().length(2).toUpperCase().default("TG"),
  city: z.string().trim().min(1).max(120),
  neighborhood: z.string().trim().max(120).optional(),
  timeZone: z.string().trim().min(1).max(80).default("Africa/Lome"),
}).strict();

export const providerProfileUpdateSchema = providerProfileCreateSchema.partial().strict();

export type PublicListQuery = z.output<typeof publicListQuerySchema>;
export type ProviderProfileCreate = z.output<typeof providerProfileCreateSchema>;
export type ProviderProfileUpdate = z.output<typeof providerProfileUpdateSchema>;
