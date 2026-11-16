import { HttpError } from "../../middlewares/errorHandler";
import type { ProviderDeleteInput, ProviderListQuery, ProviderReviewInput } from "./admin-provider.validator";
import * as repository from "./admin-provider.repository";

export async function listAdminProviders(query: ProviderListQuery) {
  const [summary, page] = await Promise.all([
    repository.countProvidersByStatus(),
    repository.listProviders(query),
  ]);
  return { ...page, summary };
}

export async function getAdminProviderDetail(id: string) {
  const numericId = Number(id);
  if (!Number.isSafeInteger(numericId) || numericId < 1) {
    throw new HttpError(404, "PROVIDER_NOT_FOUND", "Provider not found.");
  }
  const data = await repository.getProviderDetail(numericId);
  if (!data) {
    throw new HttpError(404, "PROVIDER_NOT_FOUND", "Provider not found.");
  }
  return { data };
}

export async function reviewAdminProvider(
  id: string,
  input: ProviderReviewInput,
  adminUsername: string,
) {
  const numericId = Number(id);
  if (!Number.isSafeInteger(numericId) || numericId < 1) {
    throw new HttpError(404, "PROVIDER_NOT_FOUND", "Provider not found.");
  }
  const result = await repository.reviewProvider({
    id: numericId,
    ...input,
    adminUsername,
  });
  if (result.kind === "not_found") {
    throw new HttpError(404, "PROVIDER_NOT_FOUND", "Provider not found.");
  }
  if (result.kind === "already_reviewed") {
    throw new HttpError(409, "PROVIDER_ALREADY_REVIEWED", "This provider request was already reviewed.");
  }
}

export async function getAdminDashboard() {
  return { data: await repository.getDashboardData() };
}

export async function deleteAdminProvider(id: string, _input: ProviderDeleteInput, _adminUsername: string) {
  const numericId = Number(id);
  if (!Number.isSafeInteger(numericId) || numericId < 1) {
    throw new HttpError(404, "PROVIDER_NOT_FOUND", "Provider not found.");
  }
  const result = await repository.deleteApprovedProvider({ id: numericId });
  if (result.kind === "not_found") {
    throw new HttpError(404, "PROVIDER_NOT_FOUND", "Provider not found.");
  }
  if (result.kind === "not_deletable") {
    throw new HttpError(
      409,
      "PROVIDER_NOT_DELETABLE",
      "Seuls les profils approuvés peuvent être supprimés depuis l’administration.",
    );
  }
}
