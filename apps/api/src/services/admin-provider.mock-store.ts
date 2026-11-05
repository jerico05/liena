import { HttpError } from "../middlewares/error-handler";

export type ProviderStatus = "PENDING" | "VERIFIED" | "REJECTED" | "SUSPENDED";
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

export type DashboardData = {
  summary: ProviderSummary;
  incomingThisWeek: number;
  stalePending: number;
  queue: DashboardCard[];
  recentDecisions: DashboardCard[];
  cities: DashboardCity[];
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

export type MockProviderListResult = {
  data: ProviderListItem[];
  summary: ProviderSummary;
  pagination: { page: number; pageSize: number; total: number };
};

export type ReviewDecision = "VERIFY" | "REJECT";

type MockProviderRecord = {
  id: string;
  businessName: string;
  slug: string;
  status: ProviderStatus;
  city: string;
  neighborhood: string | null;
  countryCode: string;
  createdAt: string;
  updatedAt: string;
  verifiedAt: string | null;
  description: string | null;
  verificationNotes: string | null;
  timeZone: string;
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

const LOCALE_CITY = "Lomé";
const LOCALE_COUNTRY = "TG";
const STALE_PENDING_MS = 7 * 24 * 60 * 60 * 1000;
const INCOMING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

let providers: MockProviderRecord[] = buildSeedProviders();

function isoDaysAgo(days: number, hour = 10, minute = 0): string {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function buildSeedProviders(): MockProviderRecord[] {
  return [
    {
      id: "prov-mock-001",
      businessName: "Kodjo Plomberie Express",
      slug: "kodjo-plomberie-express",
      status: "PENDING",
      city: LOCALE_CITY,
      neighborhood: "Tokoin",
      countryCode: LOCALE_COUNTRY,
      createdAt: isoDaysAgo(2, 9, 15),
      updatedAt: isoDaysAgo(1, 14, 30),
      verifiedAt: null,
      description:
        "Interventions rapides sur Lomé pour fuites, installations sanitaires et débouchage. Devis gratuit sur place.",
      verificationNotes: null,
      timeZone: "Africa/Lome",
      reviewCount: 0,
      contact: {
        firstName: "Kodjo",
        lastName: "Mensah",
        email: "kodjo.mensah@example.tg",
        phone: "+22890123456",
        accountStatus: "ACTIVE",
        avatarUrl: null,
        emailVerifiedAt: isoDaysAgo(2, 9, 20),
        phoneVerifiedAt: null,
        createdAt: isoDaysAgo(3, 8, 0),
      },
      addresses: [
        {
          id: "addr-mock-001",
          label: "Atelier",
          city: LOCALE_CITY,
          neighborhood: "Tokoin",
          street: "Boulevard du 13 Janvier",
          countryCode: LOCALE_COUNTRY,
          isDefault: true,
          latitude: 6.1319,
          longitude: 1.2228,
        },
      ],
      services: [
        {
          id: "svc-mock-001",
          title: "Réparation de fuite",
          status: "PUBLISHED",
          pricingType: "FIXED",
          price: "15000",
          currency: "XOF",
          city: LOCALE_CITY,
          neighborhood: "Tokoin",
          categoryName: "Plomberie",
        },
        {
          id: "svc-mock-002",
          title: "Installation chauffe-eau",
          status: "DRAFT",
          pricingType: "QUOTE",
          price: null,
          currency: "XOF",
          city: LOCALE_CITY,
          neighborhood: null,
          categoryName: "Plomberie",
        },
      ],
    },
    {
      id: "prov-mock-002",
      businessName: "Amina Coiffure & Beauté",
      slug: "amina-coiffure-beaute",
      status: "PENDING",
      city: LOCALE_CITY,
      neighborhood: "Bé",
      countryCode: LOCALE_COUNTRY,
      createdAt: isoDaysAgo(12, 11, 0),
      updatedAt: isoDaysAgo(10, 16, 45),
      verifiedAt: null,
      description: "Salon à domicile et en institut : tresses, soins capillaires et maquillage événementiel.",
      verificationNotes: null,
      timeZone: "Africa/Lome",
      reviewCount: 0,
      contact: {
        firstName: "Amina",
        lastName: "Diallo",
        email: "amina.diallo@example.tg",
        phone: "+22891234567",
        accountStatus: "ACTIVE",
        avatarUrl: null,
        emailVerifiedAt: isoDaysAgo(12, 11, 5),
        phoneVerifiedAt: isoDaysAgo(11, 10, 0),
        createdAt: isoDaysAgo(12, 10, 30),
      },
      addresses: [
        {
          id: "addr-mock-002",
          label: "Salon",
          city: LOCALE_CITY,
          neighborhood: "Bé",
          street: "Rue des Cocotiers",
          countryCode: LOCALE_COUNTRY,
          isDefault: true,
          latitude: 6.1375,
          longitude: 1.2125,
        },
      ],
      services: [
        {
          id: "svc-mock-003",
          title: "Tresses box braids",
          status: "PUBLISHED",
          pricingType: "FIXED",
          price: "25000",
          currency: "XOF",
          city: LOCALE_CITY,
          neighborhood: "Bé",
          categoryName: "Coiffure",
        },
      ],
    },
    {
      id: "prov-mock-003",
      businessName: "Électricité Lomé Pro",
      slug: "electricite-lome-pro",
      status: "VERIFIED",
      city: LOCALE_CITY,
      neighborhood: "Adidogomé",
      countryCode: LOCALE_COUNTRY,
      createdAt: isoDaysAgo(45, 8, 0),
      updatedAt: isoDaysAgo(5, 9, 0),
      verifiedAt: isoDaysAgo(40, 15, 30),
      description: "Mise aux normes, tableaux électriques et dépannage 24h/24 sur le grand Lomé.",
      verificationNotes: "Dossier complet, pièce d’identité et RCCM vérifiés.",
      timeZone: "Africa/Lome",
      reviewCount: 18,
      contact: {
        firstName: "Yao",
        lastName: "Agbeko",
        email: "yao.agbeko@example.tg",
        phone: "+22892345678",
        accountStatus: "ACTIVE",
        avatarUrl: null,
        emailVerifiedAt: isoDaysAgo(45, 8, 10),
        phoneVerifiedAt: isoDaysAgo(44, 12, 0),
        createdAt: isoDaysAgo(46, 7, 0),
      },
      addresses: [
        {
          id: "addr-mock-003",
          label: "Siège",
          city: LOCALE_CITY,
          neighborhood: "Adidogomé",
          street: "Avenue de la Libération",
          countryCode: LOCALE_COUNTRY,
          isDefault: true,
          latitude: 6.178,
          longitude: 1.191,
        },
      ],
      services: [
        {
          id: "svc-mock-004",
          title: "Dépannage électrique",
          status: "PUBLISHED",
          pricingType: "HOURLY",
          price: "8000",
          currency: "XOF",
          city: LOCALE_CITY,
          neighborhood: null,
          categoryName: "Électricité",
        },
        {
          id: "svc-mock-005",
          title: "Installation tableau divisionnaire",
          status: "PUBLISHED",
          pricingType: "FIXED",
          price: "120000",
          currency: "XOF",
          city: LOCALE_CITY,
          neighborhood: "Adidogomé",
          categoryName: "Électricité",
        },
      ],
    },
    {
      id: "prov-mock-004",
      businessName: "Mawuli Ménage & Repassage",
      slug: "mawuli-menage-repassage",
      status: "VERIFIED",
      city: LOCALE_CITY,
      neighborhood: "Agoè",
      countryCode: LOCALE_COUNTRY,
      createdAt: isoDaysAgo(6, 13, 20),
      updatedAt: isoDaysAgo(1, 10, 0),
      verifiedAt: isoDaysAgo(4, 17, 0),
      description: "Entretien de maison, repassage et nettoyage après travaux pour particuliers et bureaux.",
      verificationNotes: null,
      timeZone: "Africa/Lome",
      reviewCount: 4,
      contact: {
        firstName: "Mawuli",
        lastName: "Koffi",
        email: "mawuli.koffi@example.tg",
        phone: "+22893456789",
        accountStatus: "ACTIVE",
        avatarUrl: null,
        emailVerifiedAt: isoDaysAgo(6, 13, 25),
        phoneVerifiedAt: isoDaysAgo(5, 9, 0),
        createdAt: isoDaysAgo(7, 12, 0),
      },
      addresses: [
        {
          id: "addr-mock-004",
          label: null,
          city: LOCALE_CITY,
          neighborhood: "Agoè",
          street: "Carrefour Zongo",
          countryCode: LOCALE_COUNTRY,
          isDefault: true,
          latitude: 6.2105,
          longitude: 1.189,
        },
      ],
      services: [
        {
          id: "svc-mock-006",
          title: "Ménage à domicile (demi-journée)",
          status: "PUBLISHED",
          pricingType: "FIXED",
          price: "10000",
          currency: "XOF",
          city: LOCALE_CITY,
          neighborhood: "Agoè",
          categoryName: "Entretien",
        },
      ],
    },
    {
      id: "prov-mock-005",
      businessName: "Sika Transport Urbain",
      slug: "sika-transport-urbain",
      status: "REJECTED",
      city: LOCALE_CITY,
      neighborhood: "Zongo",
      countryCode: LOCALE_COUNTRY,
      createdAt: isoDaysAgo(30, 10, 0),
      updatedAt: isoDaysAgo(3, 11, 30),
      verifiedAt: null,
      description: "Courses en ville et livraisons légères.",
      verificationNotes: "Documents d’assurance incomplets ; merci de soumettre une attestation valide.",
      timeZone: "Africa/Lome",
      reviewCount: 0,
      contact: {
        firstName: "Sika",
        lastName: "Tchalla",
        email: "sika.tchalla@example.tg",
        phone: "+22894567890",
        accountStatus: "ACTIVE",
        avatarUrl: null,
        emailVerifiedAt: isoDaysAgo(30, 10, 5),
        phoneVerifiedAt: null,
        createdAt: isoDaysAgo(31, 9, 0),
      },
      addresses: [
        {
          id: "addr-mock-005",
          label: "Dépôt",
          city: LOCALE_CITY,
          neighborhood: "Zongo",
          street: "Route de Kpalimé",
          countryCode: LOCALE_COUNTRY,
          isDefault: true,
          latitude: 6.152,
          longitude: 1.205,
        },
      ],
      services: [
        {
          id: "svc-mock-007",
          title: "Course en ville",
          status: "PAUSED",
          pricingType: "FIXED",
          price: "3000",
          currency: "XOF",
          city: LOCALE_CITY,
          neighborhood: null,
          categoryName: "Transport",
        },
      ],
    },
    {
      id: "prov-mock-006",
      businessName: "Ewoe Jardinage & Paysagisme",
      slug: "ewoe-jardinage-paysagisme",
      status: "SUSPENDED",
      city: LOCALE_CITY,
      neighborhood: "Hanoukopé",
      countryCode: LOCALE_COUNTRY,
      createdAt: isoDaysAgo(90, 7, 30),
      updatedAt: isoDaysAgo(15, 8, 0),
      verifiedAt: isoDaysAgo(80, 14, 0),
      description: "Entretien de jardins, taille et aménagement paysager pour résidences à Lomé.",
      verificationNotes: "Profil suspendu suite à signalements clients en cours d’examen.",
      timeZone: "Africa/Lome",
      reviewCount: 7,
      contact: {
        firstName: "Ewoe",
        lastName: "Amegnisse",
        email: "ewoe.amegnisse@example.tg",
        phone: "+22895678901",
        accountStatus: "SUSPENDED",
        avatarUrl: null,
        emailVerifiedAt: isoDaysAgo(90, 7, 35),
        phoneVerifiedAt: isoDaysAgo(89, 16, 0),
        createdAt: isoDaysAgo(91, 6, 0),
      },
      addresses: [
        {
          id: "addr-mock-006",
          label: "Base",
          city: LOCALE_CITY,
          neighborhood: "Hanoukopé",
          street: "Quartier résidentiel",
          countryCode: LOCALE_COUNTRY,
          isDefault: true,
          latitude: 6.125,
          longitude: 1.235,
        },
      ],
      services: [
        {
          id: "svc-mock-008",
          title: "Tonte et entretien mensuel",
          status: "ARCHIVED",
          pricingType: "DAILY",
          price: "35000",
          currency: "XOF",
          city: LOCALE_CITY,
          neighborhood: "Hanoukopé",
          categoryName: "Jardinage",
        },
      ],
    },
  ];
}

function serviceCount(record: MockProviderRecord): number {
  return record.services.length;
}

export function toMockDetail(record: MockProviderRecord): ProviderDetail {
  return {
    id: record.id,
    businessName: record.businessName,
    slug: record.slug,
    status: record.status,
    city: record.city,
    neighborhood: record.neighborhood,
    countryCode: record.countryCode,
    createdAt: record.createdAt,
    verifiedAt: record.verifiedAt,
    serviceCount: serviceCount(record),
    contact: { ...record.contact },
    description: record.description,
    verificationNotes: record.verificationNotes,
    timeZone: record.timeZone,
    updatedAt: record.updatedAt,
    reviewCount: record.reviewCount,
    addresses: record.addresses.map((address) => ({ ...address })),
    services: record.services.map((service) => ({ ...service })),
  };
}

function toMockListItem(record: MockProviderRecord): ProviderListItem {
  const detail = toMockDetail(record);
  return {
    id: detail.id,
    businessName: detail.businessName,
    slug: detail.slug,
    status: detail.status,
    city: detail.city,
    neighborhood: detail.neighborhood,
    countryCode: detail.countryCode,
    createdAt: detail.createdAt,
    verifiedAt: detail.verifiedAt,
    serviceCount: detail.serviceCount,
    contact: {
      firstName: detail.contact.firstName,
      lastName: detail.contact.lastName,
      email: detail.contact.email,
      phone: detail.contact.phone,
      accountStatus: detail.contact.accountStatus,
    },
  };
}

function toDashboardCard(record: MockProviderRecord): DashboardCard {
  return {
    id: record.id,
    businessName: record.businessName,
    status: record.status,
    city: record.city,
    neighborhood: record.neighborhood,
    countryCode: record.countryCode,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    verifiedAt: record.verifiedAt,
    contact: {
      firstName: record.contact.firstName,
      lastName: record.contact.lastName,
    },
  };
}

export function computeMockProviderSummary(records: MockProviderRecord[] = providers): ProviderSummary {
  return records.reduce<ProviderSummary>(
    (summary, record) => {
      if (record.status === "PENDING") summary.pending += 1;
      if (record.status === "VERIFIED") summary.verified += 1;
      if (record.status === "REJECTED") summary.rejected += 1;
      if (record.status === "SUSPENDED") summary.suspended += 1;
      return summary;
    },
    { pending: 0, verified: 0, rejected: 0, suspended: 0 },
  );
}

function matchesQuery(record: MockProviderRecord, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    record.businessName,
    record.slug,
    record.city,
    record.neighborhood ?? "",
    record.contact.firstName,
    record.contact.lastName,
    record.contact.email,
    record.contact.phone ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

export function listMockProviders(input: {
  status?: ProviderStatus;
  q?: string;
  page: number;
  pageSize: number;
}): MockProviderListResult {
  const page = Math.max(1, input.page);
  const pageSize = Math.max(1, Math.min(100, input.pageSize));

  let filtered = [...providers];
  if (input.status) {
    filtered = filtered.filter((record) => record.status === input.status);
  }
  if (input.q) {
    filtered = filtered.filter((record) => matchesQuery(record, input.q ?? ""));
  }

  filtered.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);

  return {
    data: slice.map(toMockListItem),
    summary: computeMockProviderSummary(providers),
    pagination: { page, pageSize, total },
  };
}

export function getMockProvider(id: string): ProviderDetail {
  const record = providers.find((entry) => entry.id === id);
  if (!record) {
    throw new HttpError(404, "PROVIDER_NOT_FOUND", "Provider not found.");
  }
  return toMockDetail(record);
}

export function reviewMockProvider(
  id: string,
  decision: ReviewDecision,
  notes?: string,
): ProviderDetail {
  const record = providers.find((entry) => entry.id === id);
  if (!record) {
    throw new HttpError(404, "PROVIDER_NOT_FOUND", "Provider not found.");
  }
  if (record.status !== "PENDING") {
    throw new HttpError(409, "PROVIDER_ALREADY_REVIEWED", "This provider request was already reviewed.");
  }

  const trimmedNotes = notes?.trim() ?? "";
  if (decision === "REJECT" && trimmedNotes.length < 3) {
    throw new HttpError(400, "VALIDATION_ERROR", "Rejection notes must be at least 3 characters.");
  }

  const now = new Date().toISOString();
  record.updatedAt = now;

  if (decision === "VERIFY") {
    record.status = "VERIFIED";
    record.verifiedAt = now;
    record.verificationNotes = trimmedNotes || record.verificationNotes;
  } else {
    record.status = "REJECTED";
    record.verifiedAt = null;
    record.verificationNotes = trimmedNotes;
  }

  return toMockDetail(record);
}

export function getMockDashboard(): DashboardData {
  const summary = computeMockProviderSummary();
  const now = Date.now();
  const incomingCutoff = now - INCOMING_WINDOW_MS;
  const staleCutoff = now - STALE_PENDING_MS;

  const incomingThisWeek = providers.filter(
    (record) => Date.parse(record.createdAt) >= incomingCutoff,
  ).length;

  const stalePending = providers.filter(
    (record) => record.status === "PENDING" && Date.parse(record.createdAt) < staleCutoff,
  ).length;

  const queue = providers
    .filter((record) => record.status === "PENDING")
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
    .map(toDashboardCard);

  const recentDecisions = providers
    .filter((record) => record.status === "VERIFIED" || record.status === "REJECTED")
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, 8)
    .map(toDashboardCard);

  const cityMap = new Map<string, DashboardCity>();
  for (const record of providers) {
    const key = `${record.countryCode}:${record.city}`;
    const existing = cityMap.get(key) ?? {
      city: record.city,
      countryCode: record.countryCode,
      total: 0,
      pending: 0,
    };
    existing.total += 1;
    if (record.status === "PENDING") existing.pending += 1;
    cityMap.set(key, existing);
  }

  const cities = [...cityMap.values()].sort((left, right) => right.total - left.total);

  return {
    summary,
    incomingThisWeek,
    stalePending,
    queue,
    recentDecisions,
    cities,
  };
}

export function resetMockProviders(): void {
  providers = buildSeedProviders();
}
