export type ProviderStatus =
  | "DRAFT"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "SUSPENDED"
  | "ARCHIVED";

export type StatusFilter = "ALL" | ProviderStatus;

export type ProviderListItem = {
  id: string;
  displayName: string;
  categoryLabel: string;
  services: string;
  zone: string;
  contact: string;
  status: ProviderStatus;
  isActive: boolean;
  indicativePrice: string | null;
  createdAt: string;
  approvedAt: string | null;
};

export type ProviderSummary = Record<ProviderStatus, number>;

export type DashboardCard = ProviderListItem & {
  updatedAt: string;
};

export type DashboardZone = {
  zone: string;
  total: number;
  pending: number;
};

export type DashboardData = {
  summary: ProviderSummary;
  incomingThisWeek: number;
  stalePending: number;
  queue: DashboardCard[];
  recentDecisions: DashboardCard[];
  zones: DashboardZone[];
};

export type ProviderModerationDecision = {
  id: string;
  adminUsername: string;
  adminYeriaSub: string | null;
  decision: "APPROVE" | "REJECT" | "SUSPEND" | "REACTIVATE";
  reason: string | null;
  createdAt: string;
};

export type ProviderDetail = ProviderListItem & {
  description: string;
  yeriaSub: string;
  mediaRefs: unknown;
  updatedAt: string;
  moderationDecisions: ProviderModerationDecision[];
};

export type DashboardResponse = { data: DashboardData };

export type ProviderListResponse = {
  data: ProviderListItem[];
  summary: ProviderSummary;
  pagination: { page: number; pageSize: number; total: number };
};

export type ProviderDetailResponse = { data: ProviderDetail };
export type SessionResponse = { data: { username: string }; csrfToken?: string };

export type ApiErrorBody = {
  error?: { code?: string; message?: string };
};

export type ApiMeta = {
  source?: "mock";
};

export type WithApiMeta<T> = T & { meta?: ApiMeta };
