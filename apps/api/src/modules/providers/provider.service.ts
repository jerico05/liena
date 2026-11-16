import { Prisma } from "@prisma/client";
import { HttpError } from "../../middlewares/errorHandler";
import * as repository from "./provider.repository";
import type {
  PublicListQuery,
  ProviderProfileApplication,
  ProviderProfileInsert,
  ProviderProfileUpdate,
} from "./provider.validator";

export const listProviders = (query: PublicListQuery) => repository.listPublicProviders(query);

export const listDistinctServices = (filters: Parameters<typeof repository.listDistinctPublicServices>[0]) =>
  repository.listDistinctPublicServices(filters);

export const listMapProviders = () => repository.listApprovedProvidersForMap();

export async function getProvider(id: string) {
  const numericId = Number(id);
  if (!Number.isSafeInteger(numericId) || numericId < 1) {
    throw new HttpError(404, "PROVIDER_NOT_FOUND", "Provider not found.");
  }
  const provider = await repository.getPublicProvider(numericId);
  if (!provider) throw new HttpError(404, "PROVIDER_NOT_FOUND", "Provider not found.");
  return provider;
}

export async function createProfile(yeriaSub: string, input: ProviderProfileInsert) {
  if (!(await repository.isActiveCategory(input.categoryId))) {
    throw new HttpError(404, "CATEGORY_NOT_FOUND", "The category does not exist or is inactive.");
  }
  if (await repository.findProfileByYeriaSub(yeriaSub)) throw new HttpError(409, "PROFILE_ALREADY_EXISTS", "A provider profile already exists for this Yeria identity.");
  try { return await repository.createProviderProfile(yeriaSub, input); }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new HttpError(409, "PROFILE_ALREADY_EXISTS", "A provider profile already exists for this Yeria identity."); throw error; }
}

export async function getMyProfile(yeriaSub: string) {
  const profile = await repository.getMyProfile(yeriaSub);
  if (!profile) throw new HttpError(404, "PROFILE_NOT_FOUND", "Provider profile not found.");
  return profile;
}

export async function updateProfile(
  yeriaSub: string,
  input: ProviderProfileUpdate & { location?: ProviderProfileApplication["location"]; mediaRefs?: ProviderProfileApplication["mediaRefs"] },
) {
  const profile = await repository.getMyProfile(yeriaSub);
  if (!profile) throw new HttpError(404, "PROFILE_NOT_FOUND", "Provider profile not found.");
  if (profile.status !== "DRAFT") throw new HttpError(409, "PROFILE_NOT_EDITABLE", "Only a draft profile can be edited.");
  return repository.updateProviderProfile(yeriaSub, input);
}

export async function submitProfile(yeriaSub: string) {
  const profile = await repository.getMyProfile(yeriaSub);
  if (!profile) throw new HttpError(404, "PROFILE_NOT_FOUND", "Provider profile not found.");
  if (profile.status !== "DRAFT") throw new HttpError(409, "PROFILE_ALREADY_SUBMITTED", "Only a draft profile can be submitted.");
  return repository.submitProviderProfile(yeriaSub);
}

/** Candidature prestataire Yeria : enregistrement puis passage en `PENDING` pour modération admin. */
export async function applyAsProvider(yeriaSub: string, input: ProviderProfileApplication) {
  const existing = await repository.findProfileByYeriaSub(yeriaSub);
  if (!existing) {
    await createProfile(yeriaSub, input);
    return repository.submitProviderProfile(yeriaSub);
  }
  if (existing.status === "DRAFT") {
    await updateProfile(yeriaSub, input);
    return submitProfile(yeriaSub);
  }
  if (existing.status === "PENDING") {
    throw new HttpError(409, "APPLICATION_ALREADY_PENDING", "Votre candidature est déjà en cours d’examen.");
  }
  if (existing.status === "REJECTED") {
    throw new HttpError(
      409,
      "APPLICATION_REJECTED",
      "Votre dernière candidature a été refusée. Contactez le support pour une nouvelle demande.",
    );
  }
  throw new HttpError(409, "PROFILE_ALREADY_EXISTS", "Vous avez déjà un profil prestataire actif.");
}
