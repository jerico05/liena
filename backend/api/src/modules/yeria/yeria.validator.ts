import { z } from "zod";

export const categoryIdParamsSchema = z.object({ categoryId: z.coerce.number().int().positive() }).strict();

export const providerIdParamsSchema = z.object({ id: z.string().regex(/^[1-9]\d*$/) }).strict();

const clientGeoRefine = (value: { clientLat?: number; clientLon?: number }) =>
  (value.clientLat === undefined && value.clientLon === undefined) ||
  (value.clientLat !== undefined && value.clientLon !== undefined);

const searchQueryBaseSchema = z.object({
  q: z.string().trim().max(100).optional().transform((value) => value || undefined),
  zone: z.string().trim().max(160).optional().transform((value) => value || undefined),
  categoryId: z.coerce.number().int().positive().optional(),
  service: z.string().trim().min(1).max(120).optional().transform((value) => value || undefined),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(24),
  clientLat: z.coerce.number().min(-90).max(90).optional(),
  clientLon: z.coerce.number().min(-180).max(180).optional(),
});

export const searchResultsQuerySchema = searchQueryBaseSchema.strict().refine(clientGeoRefine, {
  message: "clientLat and clientLon must be provided together.",
});

export const searchServicesQuerySchema = searchQueryBaseSchema
  .pick({ q: true, zone: true, categoryId: true, clientLat: true, clientLon: true })
  .strict()
  .refine(clientGeoRefine, {
    message: "clientLat and clientLon must be provided together.",
  });

export const categoryProvidersQuerySchema = searchQueryBaseSchema
  .pick({ service: true, page: true, pageSize: true })
  .strict();

const mapQueryBaseSchema = z.object({
  clientLat: z.coerce.number().min(-90).max(90).optional(),
  clientLon: z.coerce.number().min(-180).max(180).optional(),
});

export const mapQuerySchema = mapQueryBaseSchema.strict().refine(clientGeoRefine, {
  message: "clientLat and clientLon must be provided together.",
});