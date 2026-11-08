import { Prisma, ProviderStatus, ServiceStatus } from "@prisma/client";
import { prisma } from "../../config/database";
import type { PublicListQuery, ProviderProfileCreate, ProviderProfileUpdate } from "./user.validator";

const publicProfileSelect = {
  id: true, businessName: true, slug: true, description: true, status: true,
  countryCode: true, city: true, neighborhood: true, timeZone: true,
  verifiedAt: true, createdAt: true,
  professionCategory: { select: { id: true, name: true, slug: true } },
  _count: { select: { services: true } },
} satisfies Prisma.ProviderProfileSelect;

function mapProfile(row: Prisma.ProviderProfileGetPayload<{ select: typeof publicProfileSelect }>) {
  return {
    ...row,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    serviceCount: row._count.services,
    _count: undefined,
  };
}

export async function listPublicProviders(query: PublicListQuery) {
  const where: Prisma.ProviderProfileWhereInput = {
    status: { in: [ProviderStatus.APPROVED, ProviderStatus.VERIFIED] },
    ...(query.q ? { OR: [
      { businessName: { contains: query.q, mode: "insensitive" } },
      { city: { contains: query.q, mode: "insensitive" } },
      { neighborhood: { contains: query.q, mode: "insensitive" } },
    ] } : {}),
    ...(query.city ? { city: { equals: query.city, mode: "insensitive" } } : {}),
    ...(query.neighborhood ? { neighborhood: { equals: query.neighborhood, mode: "insensitive" } } : {}),
    ...(query.categoryId ? { services: { some: { categoryId: query.categoryId, status: ServiceStatus.PUBLISHED } } } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.providerProfile.count({ where }),
    prisma.providerProfile.findMany({
      where, orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (query.page - 1) * query.pageSize, take: query.pageSize,
      select: publicProfileSelect,
    }),
  ]);
  return { data: rows.map(mapProfile), pagination: { page: query.page, pageSize: query.pageSize, total } };
}

export async function getPublicProvider(slug: string) {
  const row = await prisma.providerProfile.findFirst({
    where: { slug, status: { in: [ProviderStatus.APPROVED, ProviderStatus.VERIFIED] } }, select: publicProfileSelect,
  });
  return row ? mapProfile(row) : null;
}

export async function listActiveCategories() {
  return prisma.category.findMany({
    where: { isActive: true }, orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, parentId: true, name: true, slug: true, description: true, iconUrl: true, position: true },
  });
}

export async function findProfileByYeriaSub(yeriaSub: string) {
  return prisma.providerProfile.findUnique({ where: { yeriaSub }, select: { id: true, status: true, yeriaSub: true } });
}

export async function createProviderProfile(yeriaSub: string, input: ProviderProfileCreate) {
  const slug = `${input.businessName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${crypto.randomUUID().slice(0, 8)}`;
  return prisma.providerProfile.create({
    data: { yeriaSub, businessName: input.businessName, slug, description: input.description ?? null,
      professionCategoryId: input.professionCategoryId ?? null, countryCode: input.countryCode,
      city: input.city, neighborhood: input.neighborhood ?? null, timeZone: input.timeZone },
    select: { id: true, yeriaSub: true, businessName: true, slug: true, description: true, status: true, countryCode: true, city: true, neighborhood: true, timeZone: true },
  });
}

export async function updateProviderProfile(yeriaSub: string, input: ProviderProfileUpdate) {
  return prisma.providerProfile.update({ where: { yeriaSub }, data: input, select: { id: true, yeriaSub: true, businessName: true, slug: true, description: true, status: true, countryCode: true, city: true, neighborhood: true, timeZone: true } });
}

export async function submitProviderProfile(yeriaSub: string) {
  return prisma.providerProfile.updateMany({ where: { yeriaSub, status: ProviderStatus.PENDING }, data: { status: ProviderStatus.PENDING } });
}

export async function getMyProfile(yeriaSub: string) {
  return prisma.providerProfile.findUnique({ where: { yeriaSub }, select: { id: true, yeriaSub: true, businessName: true, slug: true, description: true, status: true, verificationNotes: true, countryCode: true, city: true, neighborhood: true, timeZone: true, professionCategoryId: true, verifiedAt: true, createdAt: true, updatedAt: true } });
}
