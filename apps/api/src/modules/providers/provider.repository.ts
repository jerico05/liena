import { Prisma, ProviderStatus } from "@prisma/client";
import { prisma } from "../../config/database";
import type { PublicListQuery, ProviderProfileCreate, ProviderProfileUpdate } from "./provider.validator";

const publicProfileSelect = {
  id: true,
  displayName: true,
  categoryId: true,
  services: true,
  zone: true,
  description: true,
  indicativePrice: true,
  contact: true,
  status: true,
  createdAt: true,
  approvedAt: true,
  category: { select: { label: true } },
} satisfies Prisma.ProviderProfileSelect;

type PublicProfileRow = Prisma.ProviderProfileGetPayload<{ select: typeof publicProfileSelect }>;

function mapProfile(row: PublicProfileRow) {
  return {
    id: String(row.id),
    displayName: row.displayName,
    categoryId: row.categoryId,
    categoryLabel: row.category.label,
    services: row.services,
    zone: row.zone,
    description: row.description,
    indicativePrice: row.indicativePrice?.toString() ?? null,
    contact: row.contact,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    approvedAt: row.approvedAt?.toISOString() ?? null,
  };
}

export async function listPublicProviders(query: PublicListQuery) {
  const where: Prisma.ProviderProfileWhereInput = {
    status: ProviderStatus.APPROVED,
    isActive: true,
    ...(query.q
      ? {
          OR: [
            { displayName: { contains: query.q, mode: "insensitive" } },
            { services: { contains: query.q, mode: "insensitive" } },
            { zone: { contains: query.q, mode: "insensitive" } },
            { category: { label: { contains: query.q, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(query.zone ? { zone: { contains: query.zone, mode: "insensitive" } } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.providerProfile.count({ where }),
    prisma.providerProfile.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: publicProfileSelect,
    }),
  ]);
  return {
    data: rows.map(mapProfile),
    pagination: { page: query.page, pageSize: query.pageSize, total },
  };
}

export async function getPublicProvider(id: number) {
  const row = await prisma.providerProfile.findFirst({
    where: { id, status: ProviderStatus.APPROVED, isActive: true },
    select: publicProfileSelect,
  });
  return row ? mapProfile(row) : null;
}

export async function findProfileByYeriaSub(yeriaSub: string) {
  return prisma.providerProfile.findUnique({
    where: { yeriaSub },
    select: { id: true, status: true, yeriaSub: true },
  });
}

export async function isActiveCategory(categoryId: number) {
  return prisma.category.findFirst({
    where: { id: categoryId, isActive: true },
    select: { id: true },
  });
}

export async function createProviderProfile(yeriaSub: string, input: ProviderProfileCreate) {
  return prisma.providerProfile.create({
    data: {
      yeriaSub,
      displayName: input.displayName,
      categoryId: input.categoryId,
      services: input.services,
      zone: input.zone,
      description: input.description,
      contact: input.contact,
      indicativePrice: input.indicativePrice,
    },
    select: {
      id: true,
      yeriaSub: true,
      displayName: true,
      categoryId: true,
      services: true,
      zone: true,
      description: true,
      contact: true,
      status: true,
      createdAt: true,
    },
  });
}

export async function updateProviderProfile(yeriaSub: string, input: ProviderProfileUpdate) {
  return prisma.providerProfile.update({
    where: { yeriaSub },
    data: input,
    select: {
      id: true,
      yeriaSub: true,
      displayName: true,
      categoryId: true,
      services: true,
      zone: true,
      description: true,
      contact: true,
      status: true,
      updatedAt: true,
    },
  });
}

export async function submitProviderProfile(yeriaSub: string) {
  return prisma.providerProfile.update({
    where: { yeriaSub },
    data: { status: ProviderStatus.PENDING },
    select: { id: true, yeriaSub: true, status: true, updatedAt: true },
  });
}

export async function getMyProfile(yeriaSub: string) {
  return prisma.providerProfile.findUnique({
    where: { yeriaSub },
    select: {
      id: true,
      yeriaSub: true,
      displayName: true,
      categoryId: true,
      category: { select: { label: true } },
      services: true,
      zone: true,
      description: true,
      indicativePrice: true,
      contact: true,
      mediaRefs: true,
      status: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      approvedAt: true,
    },
  });
}
