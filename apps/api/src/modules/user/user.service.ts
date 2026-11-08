import { Prisma } from "@prisma/client";
import { HttpError } from "../../middlewares/errorHandler";
import * as repository from "./user.repository";
import type { PublicListQuery, ProviderProfileCreate, ProviderProfileUpdate } from "./user.validator";

export const listCategories = () => repository.listActiveCategories();
export const listProviders = (query: PublicListQuery) => repository.listPublicProviders(query);

export async function getProvider(slug: string) {
  const provider = await repository.getPublicProvider(slug);
  if (!provider) throw new HttpError(404, "PROVIDER_NOT_FOUND", "Provider not found.");
  return provider;
}

export async function createProfile(yeriaSub: string, input: ProviderProfileCreate) {
  if (await repository.findProfileByYeriaSub(yeriaSub)) throw new HttpError(409, "PROFILE_ALREADY_EXISTS", "A provider profile already exists for this Yeria identity.");
  try { return await repository.createProviderProfile(yeriaSub, input); }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new HttpError(409, "PROFILE_ALREADY_EXISTS", "A provider profile already exists for this Yeria identity."); throw error; }
}

export async function getMyProfile(yeriaSub: string) {
  const profile = await repository.getMyProfile(yeriaSub);
  if (!profile) throw new HttpError(404, "PROFILE_NOT_FOUND", "Provider profile not found.");
  return profile;
}

export async function updateProfile(yeriaSub: string, input: ProviderProfileUpdate) {
  const profile = await repository.getMyProfile(yeriaSub);
  if (!profile) throw new HttpError(404, "PROFILE_NOT_FOUND", "Provider profile not found.");
  if (profile.status !== "PENDING") throw new HttpError(409, "PROFILE_NOT_EDITABLE", "Only a pending profile can be edited.");
  return repository.updateProviderProfile(yeriaSub, input);
}

export async function submitProfile(yeriaSub: string) {
  const profile = await repository.getMyProfile(yeriaSub);
  if (!profile) throw new HttpError(404, "PROFILE_NOT_FOUND", "Provider profile not found.");
  if (profile.status !== "PENDING") throw new HttpError(409, "PROFILE_ALREADY_REVIEWED", "This profile has already been reviewed.");
  return profile;
}
