import { Prisma, ProviderStatus } from "@prisma/client";
import { prisma } from "../../config/database";

const listSelect = {
  id: true,
  businessName: true,
  slug: true,
  status: true,
  city: true,
  neighborhood: true,
  countryCode: true,
  createdAt: true,
  verifiedAt: true,
  user: {
    select: {
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      status: true,
    },
  },
  _count: { select: { services: true } },
} satisfies Prisma.ProviderProfileSelect;

function mapListItem(row: Prisma.ProviderProfileGetPayload<{ select: typeof listSelect }>) {
  return {
    id: row.id,
    businessName: row.businessName,
    slug: row.slug,
    status: row.status,
    city: row.city,
    neighborhood: row.neighborhood,
    countryCode: row.countryCode,
    createdAt: row.createdAt.toISOString(),
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    serviceCount: row._count.services,
    contact: {
      firstName: row.user.firstName,
      lastName: row.user.lastName,
      email: row.user.email,
      phone: row.user.phone,
      accountStatus: row.user.status,
    },
  };
}

export async function countProvidersByStatus(): Promise<Record<ProviderStatus, number>> {
  const grouped = await prisma.providerProfile.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const summary = { PENDING: 0, VERIFIED: 0, REJECTED: 0, SUSPENDED: 0 };
  for (const row of grouped) summary[row.status] = row._count._all;
  return summary;
}

export async function listProviders(query: {
  status?: ProviderStatus;
  q?: string;
  page: number;
  pageSize: number;
}) {
  const where: Prisma.ProviderProfileWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { businessName: { contains: query.q, mode: "insensitive" } },
            { city: { contains: query.q, mode: "insensitive" } },
            { user: { email: { contains: query.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.providerProfile.count({ where }),
    prisma.providerProfile.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: listSelect,
    }),
  ]);

  return {
    data: rows.map(mapListItem),
    pagination: { page: query.page, pageSize: query.pageSize, total },
  };
}

export async function getProviderDetail(id: string) {
  const profile = await prisma.providerProfile.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          avatarUrl: true,
          emailVerifiedAt: true,
          phoneVerifiedAt: true,
          createdAt: true,
        },
      },
      services: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          title: true,
          status: true,
          pricingType: true,
          price: true,
          currency: true,
          city: true,
          neighborhood: true,
          category: { select: { name: true } },
        },
      },
      _count: { select: { reviews: true, services: true } },
    },
  });

  if (!profile) return null;

  const addresses = await prisma.address.findMany({
    where: { userId: profile.userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      label: true,
      city: true,
      neighborhood: true,
      street: true,
      countryCode: true,
      isDefault: true,
      latitude: true,
      longitude: true,
    },
  });

  return {
    id: profile.id,
    businessName: profile.businessName,
    slug: profile.slug,
    status: profile.status,
    city: profile.city,
    neighborhood: profile.neighborhood,
    countryCode: profile.countryCode,
    createdAt: profile.createdAt.toISOString(),
    verifiedAt: profile.verifiedAt?.toISOString() ?? null,
    updatedAt: profile.updatedAt.toISOString(),
    description: profile.description,
    verificationNotes: profile.verificationNotes,
    timeZone: profile.timeZone,
    serviceCount: profile._count.services,
    reviewCount: profile._count.reviews,
    contact: {
      firstName: profile.user.firstName,
      lastName: profile.user.lastName,
      email: profile.user.email,
      phone: profile.user.phone,
      accountStatus: profile.user.status,
      avatarUrl: profile.user.avatarUrl,
      emailVerifiedAt: profile.user.emailVerifiedAt?.toISOString() ?? null,
      phoneVerifiedAt: profile.user.phoneVerifiedAt?.toISOString() ?? null,
      createdAt: profile.user.createdAt.toISOString(),
    },
    services: profile.services.map((service) => ({
      id: service.id,
      title: service.title,
      status: service.status,
      pricingType: service.pricingType,
      price: service.price?.toString() ?? null,
      currency: service.currency,
      city: service.city,
      neighborhood: service.neighborhood,
      categoryName: service.category.name,
    })),
    addresses: addresses.map((address) => ({
      id: address.id,
      label: address.label,
      city: address.city,
      neighborhood: address.neighborhood,
      street: address.street,
      countryCode: address.countryCode,
      isDefault: address.isDefault,
      latitude: address.latitude ? Number(address.latitude) : null,
      longitude: address.longitude ? Number(address.longitude) : null,
    })),
  };
}

export async function reviewProvider(input: {
  id: string;
  decision: "VERIFY" | "REJECT";
  notes?: string;
}) {
  const existing = await prisma.providerProfile.findUnique({
    where: { id: input.id },
    select: { id: true, status: true },
  });
  if (!existing) return { kind: "not_found" as const };
  if (existing.status !== ProviderStatus.PENDING) return { kind: "already_reviewed" as const };

  const updated = await prisma.providerProfile.update({
    where: { id: input.id },
    data: {
      status: input.decision === "VERIFY" ? ProviderStatus.VERIFIED : ProviderStatus.REJECTED,
      verificationNotes: input.notes ?? null,
      verifiedAt: input.decision === "VERIFY" ? new Date() : null,
    },
    select: listSelect,
  });

  return { kind: "ok" as const, provider: mapListItem(updated) };
}

const cardSelect = {
  id: true,
  businessName: true,
  status: true,
  city: true,
  neighborhood: true,
  countryCode: true,
  createdAt: true,
  updatedAt: true,
  verifiedAt: true,
  user: { select: { firstName: true, lastName: true } },
} satisfies Prisma.ProviderProfileSelect;

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

function mapCard(row: Prisma.ProviderProfileGetPayload<{ select: typeof cardSelect }>): DashboardCard {
  return {
    id: row.id,
    businessName: row.businessName,
    status: row.status,
    city: row.city,
    neighborhood: row.neighborhood,
    countryCode: row.countryCode,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    contact: { firstName: row.user.firstName, lastName: row.user.lastName },
  };
}

export async function getDashboardData() {
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const weekAgo = new Date(now - 7 * dayMs);
  const staleBefore = new Date(now - 3 * dayMs);

  const summaryRows = await countProvidersByStatus();
  const summary = {
    pending: summaryRows.PENDING,
    verified: summaryRows.VERIFIED,
    rejected: summaryRows.REJECTED,
    suspended: summaryRows.SUSPENDED,
  };

  const [incomingThisWeek, stalePending, queue, decisions, cityGroups, pendingCityGroups] =
    await Promise.all([
      prisma.providerProfile.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.providerProfile.count({
        where: { status: ProviderStatus.PENDING, createdAt: { lt: staleBefore } },
      }),
      prisma.providerProfile.findMany({
        where: { status: ProviderStatus.PENDING },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 8,
        select: cardSelect,
      }),
      prisma.providerProfile.findMany({
        where: { status: { in: [ProviderStatus.VERIFIED, ProviderStatus.REJECTED] } },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: 8,
        select: cardSelect,
      }),
      prisma.providerProfile.groupBy({
        by: ["city", "countryCode"],
        _count: { _all: true },
        orderBy: { _count: { city: "desc" } },
        take: 8,
      }),
      prisma.providerProfile.groupBy({
        by: ["city", "countryCode"],
        where: { status: ProviderStatus.PENDING },
        _count: { _all: true },
      }),
    ]);

  const pendingByCity = new Map(
    pendingCityGroups.map((row) => [`${row.countryCode}:${row.city}`, row._count._all]),
  );

  return {
    summary,
    incomingThisWeek,
    stalePending,
    queue: queue.map(mapCard),
    recentDecisions: decisions.map(mapCard),
    cities: cityGroups.map((row) => ({
      city: row.city,
      countryCode: row.countryCode,
      total: row._count._all,
      pending: pendingByCity.get(`${row.countryCode}:${row.city}`) ?? 0,
    })),
  };
}
