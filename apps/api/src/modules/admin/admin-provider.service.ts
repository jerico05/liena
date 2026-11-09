import { config } from "../../config/env";
import { HttpError } from "../../middlewares/errorHandler";
import { withAdminMockMeta } from "./admin-api-meta";
import type { ProviderListQuery, ProviderReviewInput } from "./admin-provider.validator";
import * as repository from "./admin-provider.repository";
import {
  getMockDashboard,
  getMockProvider,
  listMockProviders,
  reviewMockProvider,
  resetMockProviders,
  type DashboardCard as LegacyDashboardCard,
  type ProviderDetail as LegacyProviderDetail,
  type ProviderListItem as LegacyProviderListItem,
  type ProviderStatus as LegacyProviderStatus,
} from "./admin-provider.mock-store";
import type { ProviderStatus } from "@prisma/client";

function toCurrentStatus(status: LegacyProviderStatus): ProviderStatus {
  return status === "VERIFIED" ? "APPROVED" : status;
}

function toLegacyStatus(status: ProviderStatus): LegacyProviderStatus | undefined {
  if (status === "APPROVED") return "VERIFIED";
  if (status === "PENDING" || status === "REJECTED" || status === "SUSPENDED") return status;
  return undefined;
}

function mapLegacyProvider(
  provider: LegacyProviderListItem | LegacyProviderDetail | LegacyDashboardCard,
) {
  const isDetail = "description" in provider;
  const services = "services" in provider ? provider.services : [];
  const neighborhood = provider.neighborhood;
  const contact =
    ("phone" in provider.contact && provider.contact.phone) ||
    ("email" in provider.contact && provider.contact.email) ||
    `${provider.contact.firstName} ${provider.contact.lastName}`;
  return {
    id: provider.id,
    displayName: provider.businessName,
    categoryLabel: services[0]?.categoryName ?? "Non renseignée",
    services:
      services.length > 0
        ? services.map((service) => service.title).join(", ")
        : "services" in provider
          ? `${provider.serviceCount} service${provider.serviceCount === 1 ? "" : "s"}`
          : "",
    zone: [neighborhood, provider.city].filter(Boolean).join(", "),
    contact,
    status: toCurrentStatus(provider.status),
    isActive:
      "accountStatus" in provider.contact
        ? provider.contact.accountStatus === "ACTIVE"
        : provider.status !== "SUSPENDED",
    indicativePrice: null,
    createdAt: provider.createdAt,
    approvedAt: provider.verifiedAt,
    ...(isDetail
      ? {
          description: provider.description ?? "",
          yeriaSub: "Donnée de démonstration — identité Yeria non configurée",
          mediaRefs:
            "avatarUrl" in provider.contact && provider.contact.avatarUrl
              ? [provider.contact.avatarUrl]
              : null,
          updatedAt: provider.updatedAt,
          moderationDecisions: [],
        }
      : {}),
  };
}

function mapLegacySummary(summary: {
  pending: number;
  verified: number;
  rejected: number;
  suspended: number;
}): Record<ProviderStatus, number> {
  return {
    DRAFT: 0,
    PENDING: summary.pending,
    APPROVED: summary.verified,
    REJECTED: summary.rejected,
    SUSPENDED: summary.suspended,
    ARCHIVED: 0,
  };
}

function summaryFromDatabase() {
  return repository.countProvidersByStatus();
}

export async function listAdminProviders(query: ProviderListQuery) {
  if (config.ADMIN_MOCK_DATA) {
    const legacyStatus = query.status ? toLegacyStatus(query.status) : undefined;
    const result =
      query.status && !legacyStatus
        ? {
            data: [],
            summary: { pending: 0, verified: 0, rejected: 0, suspended: 0 },
            pagination: { page: query.page, pageSize: query.pageSize, total: 0 },
          }
        : listMockProviders({ ...query, status: legacyStatus });
    return withAdminMockMeta({
      ...result,
      data: result.data.map(mapLegacyProvider),
      summary: mapLegacySummary(result.summary),
    });
  }
  const [summary, page] = await Promise.all([
    summaryFromDatabase(),
    repository.listProviders(query),
  ]);
  return { ...page, summary };
}

export async function getAdminProviderDetail(id: string) {
  if (config.ADMIN_MOCK_DATA) {
    return withAdminMockMeta({ data: mapLegacyProvider(getMockProvider(id)) });
  }
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
  if (config.ADMIN_MOCK_DATA) {
    reviewMockProvider(id, input.decision, input.notes);
    return;
  }
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
  if (!config.ADMIN_MOCK_DATA) return { data: await repository.getDashboardData() };
  const data = getMockDashboard();
  const { cities, ...dashboard } = data;
  return withAdminMockMeta({
    data: {
      ...dashboard,
      summary: mapLegacySummary(data.summary),
      queue: data.queue.map(mapLegacyProvider),
      recentDecisions: data.recentDecisions.map(mapLegacyProvider),
      zones: cities.map((city) => ({
        zone: city.city,
        total: city.total,
        pending: city.pending,
      })),
    },
  });
}

export function resetAdminProviderMocksForTests(): void {
  if (config.ADMIN_MOCK_DATA) resetMockProviders();
}
