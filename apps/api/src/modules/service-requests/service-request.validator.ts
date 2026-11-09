import { z } from "zod";

export const requestCreateSchema = z.object({
  providerProfileId: z.string().uuid(),
  categoryId: z.string().uuid(),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(10_000),
  countryCode: z.string().trim().length(2).toUpperCase().default("TG"),
  city: z.string().trim().min(1).max(120),
  neighborhood: z.string().trim().max(120).optional(),
  requestedStartsAt: z.coerce.date().optional(),
}).strict();

export type RequestCreate = z.output<typeof requestCreateSchema>;

export const requestIdParamsSchema = z.object({ id: z.string().uuid() });
export type RequestIdParams = z.output<typeof requestIdParamsSchema>;
