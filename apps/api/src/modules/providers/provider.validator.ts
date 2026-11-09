import { z } from "zod";

const categoryIdSchema = z.coerce.number().int().positive();
const indicativePriceSchema = z
  .string()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, "Use a non-negative amount with up to two decimals")
  .optional();

export const publicListQuerySchema = z
  .object({
    q: z.string().trim().max(100).optional().transform((value) => value || undefined),
    zone: z.string().trim().max(160).optional().transform((value) => value || undefined),
    categoryId: categoryIdSchema.optional(),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const providerIdParamsSchema = z
  .object({ id: z.string().regex(/^[1-9]\d*$/) })
  .strict();

export const providerProfileCreateSchema = z
  .object({
    displayName: z.string().trim().min(2).max(160),
    categoryId: categoryIdSchema,
    services: z.string().trim().min(1).max(2_000),
    zone: z.string().trim().min(1).max(160),
    description: z.string().trim().max(10_000),
    contact: z.string().trim().min(3).max(200),
    indicativePrice: indicativePriceSchema,
  })
  .strict();

export const providerProfileUpdateSchema = providerProfileCreateSchema.partial().strict();

export type PublicListQuery = z.output<typeof publicListQuerySchema>;
export type ProviderProfileCreate = z.output<typeof providerProfileCreateSchema>;
export type ProviderProfileUpdate = z.output<typeof providerProfileUpdateSchema>;
