export type ProviderStatus = "PENDING" | "APPROVED" | "VERIFIED" | "REJECTED" | "SUSPENDED";
export type AccountStatus = "ACTIVE" | "SUSPENDED" | "DELETED";
export type ServiceStatus = "DRAFT" | "PUBLISHED" | "PAUSED" | "ARCHIVED";
export type PricingType = "FIXED" | "HOURLY" | "DAILY" | "QUOTE";

export type ProviderContact = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  accountStatus: AccountStatus;
};

export type ProviderListItem = {
  id: string;
  businessName: string;
  slug: string;
  status: ProviderStatus;
  city: string;
  neighborhood: string | null;
  countryCode: string;
  createdAt: string;
  verifiedAt: string | null;
  serviceCount: number;
  contact: ProviderContact;
};

export type ProviderSummary = {
  pending: number;
  verified: number;
  rejected: number;
  suspended: number;
};

export type StatusFilter = "ALL" | ProviderStatus;

export type DashboardCard = {
  id: string;
  businessName: string;
  status: ProviderStatus;
  city: string;
  neighborhood: string | null;
  countryCode: string;
  createdAt: string;
  updatedAt: string;
  verifiedAt: string | null;
  contact: { firstName: string; lastName: string };
};

export type DashboardCity = {
  city: string;
  countryCode: string;
  total: number;
  pending: number;
};

export type DashboardResponse = {
  data: {
    summary: ProviderSummary;
    incomingThisWeek: number;
    stalePending: number;
    queue: DashboardCard[];
    recentDecisions: DashboardCard[];
    cities: DashboardCity[];
  };
};

export type ProviderListResponse = {
  data: ProviderListItem[];
  summary: ProviderSummary;
  pagination: { page: number; pageSize: number; total: number };
};

export type ProviderAddress = {
  id: string;
  label: string | null;
  city: string;
  neighborhood: string | null;
  street: string | null;
  countryCode: string;
  isDefault: boolean;
  latitude: number | null;
  longitude: number | null;
};

export type ProviderService = {
  id: string;
  title: string;
  status: ServiceStatus;
  pricingType: PricingType;
  price: string | null;
  currency: string;
  city: string | null;
  neighborhood: string | null;
  categoryName: string;
};

export type ProviderDetail = ProviderListItem & {
  description: string | null;
  verificationNotes: string | null;
  timeZone: string;
  updatedAt: string;
  reviewCount: number;
  contact: ProviderContact & {
    avatarUrl: string | null;
    emailVerifiedAt: string | null;
    phoneVerifiedAt: string | null;
    createdAt: string;
  };
  addresses: ProviderAddress[];
  services: ProviderService[];
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
