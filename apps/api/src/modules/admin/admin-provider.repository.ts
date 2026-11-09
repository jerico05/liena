import { Prisma, ProviderStatus } from "@prisma/client";
import { prisma } from "../../config/database";

const providerSummaryStatuses = [
  ProviderStatus.DRAFT,
  ProviderStatus.PENDING,
  ProviderStatus.APPROVED,
  ProviderStatus.REJECTED,
  ProviderStatus.SUSPENDED,
  ProviderStatus.ARCHIVED,
] as const;

const listSelect = {
  id: true,
  displayName: true,
  status: true,
  isActive: true,
  services: true,
  zone: true,
  contact: true,
  indicativePrice: true,
  createdAt: true,
  approvedAt: true,
  category: { select: { label: true } },
} satisfies Prisma.ProviderProfileSelect;

type ProviderListRow = Prisma.ProviderProfileGetPayload<{ select: typeof listSelect }>;

function mapListItem(row: ProviderListRow) {
  return {
    id: String(row.id),
    displayName: row.displayName,
    categoryLabel: row.category.label,
    services: row.services,
    zone: row.zone,
    contact: row.contact,
    status: row.status,
    isActive: row.isActive,
    indicativePrice: row.indicativePrice?.toString() ?? null,
    createdAt: row.createdAt.toISOString(),
    approvedAt: row.approvedAt?.toISOString() ?? null,
  };
}

export async function countProvidersByStatus(): Promise<Record<ProviderStatus, number>> {
  const grouped = await prisma.providerProfile.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const summary = Object.fromEntries(
    providerSummaryStatuses.map((status) => [status, 0]),
  ) as Record<ProviderStatus, number>;
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
            { displayName: { contains: query.q, mode: "insensitive" } },
            { services: { contains: query.q, mode: "insensitive" } },
            { zone: { contains: query.q, mode: "insensitive" } },
            { contact: { contains: query.q, mode: "insensitive" } },
            { category: { label: { contains: query.q, mode: "insensitive" } } },
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

export async function getProviderDetail(id: number) {
  const profile = await prisma.providerProfile.findUnique({
    where: { id },
    include: {
      category: { select: { label: true } },
      moderationDecisions: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!profile) return null;

  return {
    ...mapListItem({
      ...profile,
      category: profile.category,
    }),
    description: profile.description,
    yeriaSub: profile.yeriaSub,
    mediaRefs: profile.mediaRefs,
    updatedAt: profile.updatedAt.toISOString(),
    moderationDecisions: profile.moderationDecisions.map((decision) => ({
      id: String(decision.id),
      adminUsername: decision.adminUsername,
      adminYeriaSub: decision.adminYeriaSub,
      decision: decision.decision,
      reason: decision.reason,
      createdAt: decision.createdAt.toISOString(),
    })),
  };
}

export async function reviewProvider(input: {
  id: number;
  decision: "VERIFY" | "REJECT";
  notes?: string;
  adminUsername: string;
}) {
  return prisma.$transaction(async (transaction) => {
    const newStatus =
      input.decision === "VERIFY" ? ProviderStatus.APPROVED : ProviderStatus.REJECTED;
    const update = await transaction.providerProfile.updateMany({
      where: { id: input.id, status: ProviderStatus.PENDING },
      data: {
        status: newStatus,
        isActive: input.decision === "VERIFY",
        approvedAt: input.decision === "VERIFY" ? new Date() : null,
      },
    });

    if (update.count === 0) {
      const existing = await transaction.providerProfile.findUnique({
        where: { id: input.id },
        select: { id: true },
      });
      return { kind: existing ? ("already_reviewed" as const) : ("not_found" as const) };
    }

    await transaction.moderationDecision.create({
      data: {
        providerProfileId: input.id,
        adminUsername: input.adminUsername,
        decision: input.decision === "VERIFY" ? "APPROVE" : "REJECT",
        reason: input.notes ?? null,
      },
    });

    return { kind: "ok" as const };
  });
}

export async function getDashboardData() {
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const weekAgo = new Date(now - 7 * dayMs);
  const staleBefore = new Date(now - 3 * dayMs);
  const [summary, incomingThisWeek, stalePending, queue, decisions, zoneGroups] =
    await Promise.all([
      countProvidersByStatus(),
      prisma.providerProfile.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.providerProfile.count({
        where: { status: ProviderStatus.PENDING, createdAt: { lt: staleBefore } },
      }),
      prisma.providerProfile.findMany({
        where: { status: ProviderStatus.PENDING },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 8,
        select: listSelect,
      }),
      prisma.providerProfile.findMany({
        where: { status: { in: [ProviderStatus.APPROVED, ProviderStatus.REJECTED] } },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: 8,
        select: listSelect,
      }),
      prisma.providerProfile.groupBy({
        by: ["zone"],
        _count: { _all: true },
        orderBy: { _count: { zone: "desc" } },
        take: 8,
      }),
    ]);

  const pendingZones = await prisma.providerProfile.groupBy({
    by: ["zone"],
    where: { status: ProviderStatus.PENDING },
    _count: { _all: true },
  });
  const pendingByZone = new Map(pendingZones.map((row) => [row.zone, row._count._all]));

  return {
    summary,
    incomingThisWeek,
    stalePending,
    queue: queue.map(mapListItem),
    recentDecisions: decisions.map(mapListItem),
    zones: zoneGroups.map((row) => ({
      zone: row.zone,
      total: row._count._all,
      pending: pendingByZone.get(row.zone) ?? 0,
    })),
  };
}
