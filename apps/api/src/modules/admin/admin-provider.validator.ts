import { z } from "zod";

export const providerStatusSchema = z.enum([
  "DRAFT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
  "ARCHIVED",
]);

export const providerListQuerySchema = z
  .object({
    status: providerStatusSchema.optional(),
    q: z
      .string()
      .trim()
      .max(100)
      .optional()
      .transform((value) => value || undefined),
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export type ProviderListQuery = z.output<typeof providerListQuerySchema>;

/** Identifiants numériques en base ; identifiants `prov-mock-*` en mode démo. */
export const providerIdParamsSchema = z
  .object({
    id: z.union([z.string().regex(/^[1-9]\d*$/), z.string().regex(/^prov-mock-\d{3}$/)]),
  })
  .strict();

export const providerReviewSchema = z
  .object({
    decision: z.enum(["VERIFY", "REJECT"]),
    notes: z
      .string()
      .trim()
      .max(2_000)
      .optional()
      .transform((value) => value || undefined),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.decision === "REJECT" && (!value.notes || value.notes.length < 3)) {
      context.addIssue({
        code: "custom",
        path: ["notes"],
        message: "Indiquez le motif du refus.",
      });
    }
  });

export type ProviderReviewInput = z.output<typeof providerReviewSchema>;
