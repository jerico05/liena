import { z } from "zod";

export const requestCreateSchema = z
  .object({
    providerProfileId: z.coerce.number().int().positive(),
    description: z.string().trim().min(10).max(10_000),
    zone: z.string().trim().max(160).optional(),
  })
  .strict();

export type RequestCreate = z.output<typeof requestCreateSchema>;

export const requestIdParamsSchema = z
  .object({ id: z.string().regex(/^[1-9]\d*$/) })
  .strict();
export type RequestIdParams = z.output<typeof requestIdParamsSchema>;
