import {
  buildCategoriesGridView,
  buildEmptyCatalogView,
  buildNoProvidersForTradeView,
  buildHomeView,
  buildProviderDetailView,
  buildProviderManageView,
  buildProviderOnboardingView,
  buildProviderRequestsView,
  buildProviderResultsView,
  buildProviderStatusView,
  buildMapAccessFormView,
  buildProvidersMapView,
  buildSearchFormView,
  buildServicesGridView,
  buildServiceRequestFormView,
  SCREENS,
  withQuery,
  type PublicProviderDetail,
} from "@liena/mobile";
import { YeriaUI } from "@numerum-tech/yeriasdk";
import * as categoryService from "../categories/category.service";
import * as providerRepository from "../providers/provider.repository";
import * as providerService from "../providers/provider.service";
import { parseGpsField, resolveOnboardingMedia } from "../providers/provider-media";
import { providerProfileApplicationSchema } from "../providers/provider.validator";
import type { Express } from "express";
import { HttpError } from "../../middlewares/errorHandler";
import * as requestService from "../service-requests/service-request.service";
import {
  MAP_FORM_FIELDS,
  parseMapFormFields,
  parseProviderOnboardingFields,
  parseSearchFormFields,
  parseServiceRequestFields,
  SEARCH_FORM_FIELDS,
  SERVICE_REQUEST_FIELDS,
} from "@liena/shared-schemas";

export function homeScreen() {
  return buildHomeView();
}

export async function categoriesScreen() {
  const categories = await categoryService.listCategories();
  return buildCategoriesGridView(categories.map((row) => ({ id: row.id, label: row.label })));
}

export async function categoryServicesScreen(categoryId: number) {
  const category = (await categoryService.listCategories()).find((item) => item.id === categoryId);
  if (!category) {
    return buildEmptyCatalogView({
      viewId: "liena-category-services-empty",
      title: "Métier introuvable",
      body: "Ce métier n’est plus disponible.",
      backLabel: "Retour aux métiers",
      backUrl: SCREENS.categories,
    });
  }

  const { pagination } = await providerService.listProviders({
    categoryId,
    page: 1,
    pageSize: 1,
    q: undefined,
    zone: undefined,
    service: undefined,
  });
  if (pagination.total === 0) {
    return buildNoProvidersForTradeView(category.label, SCREENS.categories);
  }

  let services = await providerService.listDistinctServices({ categoryId });
  if (services.length === 0) {
    services = ["Voir les prestataires"];
  }

  return buildServicesGridView({
    viewId: "liena-category-services",
    title: category.label,
    intro: "Choisis un service pour voir les prestataires et les contacter",
    emptyTargetUrl: SCREENS.categories,
    services: services.map((label, index) => ({
      code: `service-${index + 1}`,
      label,
      description: label,
    })),
  });
}

export async function categoryProvidersScreen(
  categoryId: number,
  options: { service?: string; page?: number; pageSize?: number } = {},
) {
  const category = (await categoryService.listCategories()).find((item) => item.id === categoryId);
  const { data } = await providerService.listProviders({
    categoryId,
    service: options.service,
    page: options.page ?? 1,
    pageSize: options.pageSize ?? 24,
    q: undefined,
    zone: undefined,
  });

  const serviceLabel = options.service;
  if (data.length === 0) {
    return buildNoProvidersForTradeView(category?.label ?? "ce métier", SCREENS.categoryServices(categoryId));
  }

  return buildProviderResultsView(data, {
    title: serviceLabel ?? category?.label ?? "Prestataires",
    intro: serviceLabel
      ? `${serviceLabel} — ${category?.label ?? "prestataires du métier"}`
      : category
        ? `Prestataires — ${category.label}`
        : "Prestataires du métier",
    emptyMessage: serviceLabel
      ? `Aucun prestataire pour « ${serviceLabel} » pour l’instant.`
      : "Aucun prestataire pour ce métier pour l’instant.",
    emptyBackUrl: SCREENS.categoryServices(categoryId),
  });
}

export async function searchServicesScreen(query: {
  zone?: string;
  q?: string;
  categoryId?: number;
  clientLat?: number;
  clientLon?: number;
}) {
  const services = await providerService.listDistinctServices({
    zone: query.zone,
    q: query.q,
    categoryId: query.categoryId,
  });
  if (services.length === 0) {
    const criteria = [query.zone, query.q].filter(Boolean).join(" · ");
    return buildEmptyCatalogView({
      viewId: "liena-search-services-empty",
      title: "Aucun service pour l’instant",
      body: criteria
        ? `Aucun service ni prestataire ne correspond à « ${criteria} » pour le moment.`
        : "Aucun service ni prestataire n’est disponible pour le moment.",
      backLabel: "Modifier la recherche",
      backUrl: SCREENS.search,
    });
  }

  return buildServicesGridView({
    viewId: "liena-search-services",
    title: "Services trouvés",
    intro: [query.zone, query.q].filter(Boolean).join(" · ") || "Choisis un service",
    emptyTargetUrl: SCREENS.search,
    services: services.map((label, index) => ({
      code: `service-${index + 1}`,
      label,
      description: query.zone ? `Autour de ${query.zone}` : undefined,
    })),
  });
}

export async function searchScreen() {
  const categories = await categoryService.listCategories();
  return buildSearchFormView(
    categories.map((row) => ({ value: String(row.id), label: row.label })),
  );
}

export async function searchResultsScreen(query: {
  q?: string;
  zone?: string;
  categoryId?: number;
  service?: string;
  page?: number;
  pageSize?: number;
  clientLat?: number;
  clientLon?: number;
}) {
  const categories = await categoryService.listCategories();
  const categoryLabel = query.categoryId
    ? categories.find((item) => item.id === query.categoryId)?.label
    : undefined;

  const { data } = await providerService.listProviders({
    q: query.categoryId ? undefined : query.q,
    zone: query.zone,
    categoryId: query.categoryId,
    service: query.service,
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 24,
    clientLat: query.clientLat,
    clientLon: query.clientLon,
  });

  if (data.length === 0 && categoryLabel) {
    return buildNoProvidersForTradeView(categoryLabel, SCREENS.search);
  }

  const intro = [
    categoryLabel,
    query.zone ? `Secteur ${query.zone}` : undefined,
    query.clientLat !== undefined ? "Du plus proche au plus loin" : undefined,
    query.service,
  ]
    .filter(Boolean)
    .join(" · ");

  return buildProviderResultsView(data, {
    title: categoryLabel ?? query.service ?? "Prestataires",
    intro: intro || "Résultats de recherche",
    emptyMessage: categoryLabel
      ? `Aucun prestataire « ${categoryLabel} » ne correspond à ta zone pour le moment.`
      : "Aucun prestataire ne correspond à cette recherche pour l’instant.",
    emptyBackUrl: SCREENS.search,
  });
}

export async function providerDetailScreen(id: string) {
  const provider = await providerService.getProvider(id);
  return buildProviderDetailView(provider as PublicProviderDetail);
}

export async function serviceRequestFormScreen(providerId: string) {
  const provider = await providerService.getProvider(providerId);
  return buildServiceRequestFormView(provider.id, provider.displayName);
}

export async function serviceRequestSubmit(
  clientYeriaSub: string,
  providerId: string,
  body: Record<string, unknown>,
) {
  const providerProfileId = Number(providerId);
  if (!Number.isSafeInteger(providerProfileId) || providerProfileId < 1) {
    throw new HttpError(400, "VALIDATION_ERROR", "Prestataire invalide.");
  }

  const location = parseGpsField(body[SERVICE_REQUEST_FIELDS.location]);
  if (!location) {
    throw new HttpError(
      400,
      "LOCATION_REQUIRED",
      "Active la localisation et autorise l’accès GPS pour enregistrer le lieu de la demande.",
    );
  }

  const parsed = parseServiceRequestFields(body, location);
  if (!parsed.success) {
    if (parsed.error === "LOCATION_REQUIRED") {
      throw new HttpError(400, "LOCATION_REQUIRED", "La position GPS est obligatoire.");
    }
    throw new HttpError(400, "VALIDATION_ERROR", "Les informations de la demande sont incomplètes.");
  }

  const hiddenId = body.providerProfileId !== undefined ? Number(body.providerProfileId) : providerProfileId;
  if (Number.isFinite(hiddenId) && hiddenId !== providerProfileId) {
    throw new HttpError(400, "VALIDATION_ERROR", "Prestataire incohérent.");
  }

  await requestService.createRequest(clientYeriaSub, {
    providerProfileId,
    ...parsed.data,
  });

  return YeriaUI.createMessageView("liena-service-request-sent", "Demande envoyée")
    .setIntro("Merci !")
    .setBody("Le prestataire a reçu ta demande. Il pourra l’accepter ou la refuser depuis son espace.")
    .setSeverity("success")
    .addAction("Retour à l’accueil", { go: "/screens/home" });
}

export function mapAccessScreen() {
  return buildMapAccessFormView();
}

export async function providersMapScreen(clientLat: number, clientLon: number) {
  const providers = await providerService.listMapProviders();
  return buildProvidersMapView({
    clientLocation: { lat: clientLat, lon: clientLon },
    providers,
  });
}

export async function mapSubmit(body: Record<string, unknown>) {
  const location = parseGpsField(body[MAP_FORM_FIELDS.location]);
  if (!location) {
    throw new HttpError(
      400,
      "LOCATION_REQUIRED",
      "Active la localisation et autorise l’accès GPS pour afficher la carte.",
    );
  }
  const parsed = parseMapFormFields(body, location);
  if (!parsed.success) {
    throw new HttpError(400, "VALIDATION_ERROR", "Impossible de lire ta position GPS.");
  }
  return providersMapScreen(location.lat, location.lon);
}

export async function providerOnboardingScreen() {
  const categories = await categoryService.listCategories();
  return buildProviderOnboardingView(categories.map((row) => ({ value: String(row.id), label: row.label })));
}

/**
 * Entrée « Devenir prestataire » : formulaire, suivi de statut ou espace prestataire selon le profil.
 */
export async function resolveBecomeProviderScreen(yeriaSub?: string) {
  if (!yeriaSub) return providerOnboardingScreen();

  const existing = await providerRepository.findProfileByYeriaSub(yeriaSub);
  if (!existing || existing.status === "DRAFT") return providerOnboardingScreen();

  if (existing.status === "APPROVED") return providerManageScreen(yeriaSub);

  return providerStatusScreen(yeriaSub);
}

export async function providerOnboardingSubmit(
  yeriaSub: string,
  body: Record<string, unknown>,
  uploadRequest: { files?: Express.Multer.File[] | Record<string, Express.Multer.File[]> },
) {
  const location = parseGpsField(body.location);
  if (!location) {
    throw new HttpError(400, "LOCATION_REQUIRED", "Active la localisation et autorise l’accès GPS.");
  }

  const fields = parseProviderOnboardingFields(body);
  if (!fields.success) {
    const firstIssue = fields.error.issues[0];
    const detail = firstIssue?.message ?? "Vérifie chaque champ obligatoire.";
    throw new HttpError(400, "VALIDATION_ERROR", `Les informations du profil sont incomplètes. ${detail}`);
  }

  let mediaRefs;
  try {
    mediaRefs = await resolveOnboardingMedia(yeriaSub, uploadRequest);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, "UPLOAD_FAILED", "Les photos n’ont pas pu être envoyées. Réessaie avec une image plus légère.");
  }
  const parsed = providerProfileApplicationSchema.safeParse({
    ...fields.data,
    location,
    mediaRefs,
  });
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const detail = firstIssue?.message ?? "Vérifie les photos et la localisation.";
    throw new HttpError(400, "VALIDATION_ERROR", `Les informations du profil sont incomplètes. ${detail}`);
  }

  await providerService.applyAsProvider(yeriaSub, parsed.data);
  return YeriaUI.createMessageView("liena-provider-applied", "Candidature envoyée")
    .setIntro("Demande enregistrée")
    .setBody(
      "Ton dossier est en attente de validation par l’équipe Liena. Tu recevras l’accès à la gestion de services une fois le profil approuvé.",
    )
    .setSeverity("success")
    .addAction("Suivre mon statut", { go: "/screens/provider/status" });
}

export async function searchSubmit(body: Record<string, unknown>) {
  const location = parseGpsField(body[SEARCH_FORM_FIELDS.location]);
  if (!location) {
    throw new HttpError(
      400,
      "LOCATION_REQUIRED",
      "Active la localisation et autorise l’accès GPS pour classer les prestataires par distance.",
    );
  }
  const parsed = parseSearchFormFields(body, location);
  if (!parsed.success) {
    throw new HttpError(400, "VALIDATION_ERROR", "Choisis un métier et vérifie les champs du formulaire.");
  }
  const { categoryId, zone } = parsed.data;
  return searchResultsScreen({
    categoryId,
    zone,
    clientLat: location.lat,
    clientLon: location.lon,
    page: 1,
    pageSize: 24,
  });
}

export async function providerManageScreen(yeriaSub: string) {
  let displayName: string | undefined;
  let status: string | undefined;
  let requestCount = 0;
  try {
    const profile = await providerService.getMyProfile(yeriaSub);
    displayName = profile.displayName;
    status = profile.status;
  } catch {
    status = "AUCUN_PROFIL";
  }
  try {
    const requests = await requestService.listProviderRequests(yeriaSub);
    requestCount = Array.isArray(requests) ? requests.length : 0;
  } catch {
    requestCount = 0;
  }
  return buildProviderManageView({ displayName, status, requestCount });
}

export async function providerStatusScreen(yeriaSub: string) {
  const profile = await providerService.getMyProfile(yeriaSub);
  return buildProviderStatusView({
    displayName: profile.displayName,
    status: profile.status,
    zone: profile.zone,
    services: profile.services,
    categoryLabel: profile.category?.label ?? "Catégorie",
  });
}

export async function providerRequestsScreen(yeriaSub: string) {
  const rows = await requestService.listProviderRequests(yeriaSub);
  return buildProviderRequestsView(
    rows.map(
      (row: {
        id: number;
        description: string;
        zone: string | null;
        clientContact: string | null;
        locationLat: string | null;
        locationLon: string | null;
        locationAccuracy: string | null;
        status: string;
      }) => ({
        id: row.id,
        description: row.description,
        zone: row.zone,
        clientContact: row.clientContact,
        locationLat: row.locationLat,
        locationLon: row.locationLon,
        locationAccuracy: row.locationAccuracy,
        status: row.status,
      }),
    ),
  );
}

export async function providerSubmitScreen(yeriaSub: string) {
  await providerService.submitProfile(yeriaSub);
  return YeriaUI.createMessageView("liena-provider-submitted", "Profil soumis")
    .setIntro("Votre dossier est en cours de modération.")
    .setBody("L’équipe Liena vous notifiera dès qu’une décision sera prise.")
    .setSeverity("success")
    .addAction("Gestion de services", { go: "/screens/provider/manage" });
}
