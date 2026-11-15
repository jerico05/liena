import { z } from "zod";

export { dedupeServiceLabels, parseServiceOfferings } from "./service-catalog";
export { formatDistanceKm, haversineDistanceKm } from "./geo";

/** IDs de champs FormView — à garder alignés avec `provider_profiles` et `service_requests`. */
export const PROVIDER_ONBOARDING_FIELDS = {
  displayName: "displayName",
  categoryId: "categoryId",
  services: "services",
  zone: "zone",
  description: "description",
  contact: "contact",
  indicativePrice: "indicativePrice",
  portfolioPhotos: "portfolioPhotos",
  location: "location",
} as const;

export const SERVICE_REQUEST_FIELDS = {
  providerProfileId: "providerProfileId",
  description: "description",
  zone: "zone",
  clientContact: "clientContact",
  location: "location",
} as const;

export const SEARCH_FORM_FIELDS = {
  zone: "zone",
  categoryId: "categoryId",
  location: "location",
} as const;

export const MAP_FORM_FIELDS = {
  location: "location",
} as const;

const categoryIdSchema = z.coerce.number().int().positive();

const geoLocationObjectSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().optional(),
});

/** Accepte un objet GPS ou une chaîne JSON envoyée par Yeria / REST. */
export const geoLocationSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === "") return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      return {
        lat: parsed.lat ?? parsed.latitude,
        lon: parsed.lon ?? parsed.longitude,
        accuracy: parsed.accuracy ?? parsed.acc,
      };
    } catch {
      return value;
    }
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    return {
      lat: record.lat ?? record.latitude,
      lon: record.lon ?? record.longitude,
      accuracy: record.accuracy ?? record.acc,
    };
  }
  return value;
}, geoLocationObjectSchema);

/** Formulaire recherche client Yeria. */
export const searchFormSchema = z
  .object({
    [SEARCH_FORM_FIELDS.zone]: z
      .string()
      .trim()
      .max(160)
      .optional()
      .transform((value) => value || undefined),
    [SEARCH_FORM_FIELDS.categoryId]: categoryIdSchema,
    [SEARCH_FORM_FIELDS.location]: geoLocationSchema,
  })
  .strict();

export type SearchFormPayload = z.output<typeof searchFormSchema>;

/** Formulaire d’accès à la carte Yeria. */
export const mapFormSchema = z
  .object({
    [MAP_FORM_FIELDS.location]: geoLocationSchema,
  })
  .strict();

export type MapFormPayload = z.output<typeof mapFormSchema>;

export const portfolioMediaRefSchema = z.object({
  url: z.string().url(),
  publicId: z.string().min(1).max(300),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

const indicativePriceSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
}, z
  .string()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, "Use a non-negative amount with up to two decimals")
  .optional());

const contactSchema = z.string().trim().min(3).max(200);

/** Champs texte du formulaire prestataire → colonnes `provider_profiles` (hors photos / GPS). */
export const providerOnboardingFormSchema = z
  .object({
    [PROVIDER_ONBOARDING_FIELDS.displayName]: z.string().trim().min(2).max(160),
    [PROVIDER_ONBOARDING_FIELDS.categoryId]: categoryIdSchema,
    [PROVIDER_ONBOARDING_FIELDS.services]: z.string().trim().min(1).max(2_000),
    [PROVIDER_ONBOARDING_FIELDS.zone]: z.string().trim().min(1).max(160),
    [PROVIDER_ONBOARDING_FIELDS.description]: z.string().trim().max(10_000),
    [PROVIDER_ONBOARDING_FIELDS.contact]: contactSchema,
    [PROVIDER_ONBOARDING_FIELDS.indicativePrice]: indicativePriceSchema,
  })
  .strict();

/** Candidature complète (formulaire + upload Cloudinary + GPS). */
export const providerApplicationSchema = providerOnboardingFormSchema
  .extend({
    location: geoLocationSchema,
    mediaRefs: z.array(portfolioMediaRefSchema).min(1).max(8),
  })
  .strict();

/** Formulaire demande client → table `service_requests`. */
export const serviceRequestFormSchema = z
  .object({
    [SERVICE_REQUEST_FIELDS.description]: z.string().trim().min(10).max(10_000),
    [SERVICE_REQUEST_FIELDS.zone]: z
      .string()
      .trim()
      .max(160)
      .optional()
      .transform((value) => value || undefined),
    [SERVICE_REQUEST_FIELDS.clientContact]: contactSchema,
    /** Colonnes `location_lat`, `location_lon`, `location_accuracy` */
    [SERVICE_REQUEST_FIELDS.location]: geoLocationSchema,
  })
  .strict();

/** API REST `POST /api/v1/requests`. */
export const serviceRequestCreateSchema = serviceRequestFormSchema.extend({
  providerProfileId: categoryIdSchema,
});

export type GeoLocation = z.output<typeof geoLocationSchema>;
export type ProviderOnboardingForm = z.output<typeof providerOnboardingFormSchema>;
export type ProviderApplication = z.output<typeof providerApplicationSchema>;
export type ServiceRequestForm = z.output<typeof serviceRequestFormSchema>;
export type ServiceRequestCreate = z.output<typeof serviceRequestCreateSchema>;

/** Extrait les champs texte d’une soumission multipart Yeria (sans GPS / photos). */
export function parseServiceRequestFields(
  body: Record<string, unknown>,
  location: GeoLocation | null,
) {
  const fields = SERVICE_REQUEST_FIELDS;
  if (!location) {
    return { success: false as const, error: "LOCATION_REQUIRED" };
  }
  const parsed = serviceRequestFormSchema.safeParse({
    [fields.description]: body[fields.description],
    [fields.zone]: body[fields.zone],
    [fields.clientContact]: body[fields.clientContact],
    [fields.location]: location,
  });
  return parsed.success ? { success: true as const, data: parsed.data } : { success: false as const, error: "VALIDATION" as const, issues: parsed.error.issues };
}

export function parseMapFormFields(body: Record<string, unknown>, location: GeoLocation | null) {
  const fields = MAP_FORM_FIELDS;
  if (!location) {
    return { success: false as const, error: "LOCATION_REQUIRED" as const };
  }
  const parsed = mapFormSchema.safeParse({
    [fields.location]: location,
  });
  return parsed.success
    ? { success: true as const, data: parsed.data }
    : { success: false as const, error: "VALIDATION" as const, issues: parsed.error.issues };
}

export function parseSearchFormFields(body: Record<string, unknown>, location: GeoLocation | null) {
  const fields = SEARCH_FORM_FIELDS;
  if (!location) {
    return { success: false as const, error: "LOCATION_REQUIRED" as const };
  }
  const parsed = searchFormSchema.safeParse({
    [fields.zone]: body[fields.zone],
    [fields.categoryId]: body[fields.categoryId],
    [fields.location]: location,
  });
  return parsed.success
    ? { success: true as const, data: parsed.data }
    : { success: false as const, error: "VALIDATION" as const, issues: parsed.error.issues };
}

export function parseProviderOnboardingFields(body: Record<string, unknown>) {
  const fields = PROVIDER_ONBOARDING_FIELDS;
  return providerOnboardingFormSchema.safeParse({
    [fields.displayName]: body[fields.displayName],
    [fields.categoryId]: body[fields.categoryId],
    [fields.services]: body[fields.services],
    [fields.zone]: body[fields.zone],
    [fields.description]: body[fields.description],
    [fields.contact]: body[fields.contact],
    [fields.indicativePrice]: body[fields.indicativePrice],
  });
}
