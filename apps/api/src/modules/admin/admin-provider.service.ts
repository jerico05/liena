import { config } from "../../config/env";
import { HttpError } from "../../middlewares/errorHandler";
import { withAdminMockMeta } from "./admin-api-meta";
import type { ProviderListQuery, ProviderReviewInput } from "./admin-provider.validator";
import * as repository from "./admin-provider.repository";
import {
  getMockProvider,
  listMockProviders,
  reviewMockProvider,
  resetMockProviders,
} from "./admin-provider.mock-store";

async function summaryFromDatabase() {
  const rows = await repository.countProvidersByStatus();
  return {
    pending: rows.PENDING,
    verified: rows.APPROVED + rows.VERIFIED,
    rejected: rows.REJECTED,
    suspended: rows.SUSPENDED,
  };
}

export async function listAdminProviders(query: ProviderListQuery) {
  if (config.ADMIN_MOCK_DATA) {
    return withAdminMockMeta(listMockProviders(query));
  }
  const [summary, page] = await Promise.all([
    summaryFromDatabase(),
    repository.listProviders(query),
  ]);
  return { ...page, summary };
}

export async function getAdminProviderDetail(id: string) {
  if (config.ADMIN_MOCK_DATA) {
    return withAdminMockMeta({ data: getMockProvider(id) });
  }
  const data = await repository.getProviderDetail(id);
  if (!data) {
    throw new HttpError(404, "PROVIDER_NOT_FOUND", "Provider not found.");
  }
  return { data };
}

export async function reviewAdminProvider(id: string, input: ProviderReviewInput) {
  if (config.ADMIN_MOCK_DATA) {
    reviewMockProvider(id, input.decision, input.notes);
    return;
  }
  const result = await repository.reviewProvider({ id, ...input });
  if (result.kind === "not_found") {
    throw new HttpError(404, "PROVIDER_NOT_FOUND", "Provider not found.");
  }
  if (result.kind === "already_reviewed") {
    throw new HttpError(409, "PROVIDER_ALREADY_REVIEWED", "This provider request was already reviewed.");
  }
}

export function resetAdminProviderMocksForTests(): void {
  if (config.ADMIN_MOCK_DATA) resetMockProviders();
}
