import { dedupeServiceLabels, formatDistanceKm, haversineDistanceKm, parseServiceOfferings } from "@liena/shared-schemas";
import { Prisma, ProviderStatus } from "@prisma/client";
import { prisma } from "../../config/database";
import type {
  PublicListQuery,
  ProviderLocation,
  ProviderMediaRef,
  ProviderProfileInsert,
  ProviderProfileUpdate,
} from "./provider.validator";

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
  locationLat: true,
  locationLon: true,
  category: { select: { label: true } },
} satisfies Prisma.ProviderProfileSelect;

type PublicProfileRow = Prisma.ProviderProfileGetPayload<{ select: typeof publicProfileSelect }>;

function mapProfile(
  row: PublicProfileRow,
  options?: { clientLat?: number; clientLon?: number },
) {
  const base = {
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

  if (options?.clientLat === undefined || options.clientLon === undefined) {
    return base;
  }

  const lat = row.locationLat !== null ? Number(row.locationLat) : null;
  const lon = row.locationLon !== null ? Number(row.locationLon) : null;
  if (lat === null || lon === null || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    return { ...base, distanceKm: null, distanceLabel: "Distance inconnue" };
  }
  const distanceKm = haversineDistanceKm(options.clientLat, options.clientLon, lat, lon);
  return { ...base, distanceKm, distanceLabel: formatDistanceKm(distanceKm) };
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
    ...(query.service ? { services: { contains: query.service, mode: "insensitive" } } : {}),
  };

  const geoClient =
    query.clientLat !== undefined && query.clientLon !== undefined
      ? { clientLat: query.clientLat, clientLon: query.clientLon }
      : undefined;

  if (geoClient) {
    const rows = await prisma.providerProfile.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 2_000,
      select: publicProfileSelect,
    });
    const ranked = rows.map((row) => mapProfile(row, geoClient));
    ranked.sort((left, right) => {
      const leftKm =
        "distanceKm" in left && typeof left.distanceKm === "number"
          ? left.distanceKm
          : Number.POSITIVE_INFINITY;
      const rightKm =
        "distanceKm" in right && typeof right.distanceKm === "number"
          ? right.distanceKm
          : Number.POSITIVE_INFINITY;
      if (leftKm !== rightKm) return leftKm - rightKm;
      return left.displayName.localeCompare(right.displayName, "fr");
    });
    const start = (query.page - 1) * query.pageSize;
    return {
      data: ranked.slice(start, start + query.pageSize),
      pagination: { page: query.page, pageSize: query.pageSize, total: ranked.length },
    };
  }

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
    data: rows.map((row) => mapProfile(row)),
    pagination: { page: query.page, pageSize: query.pageSize, total },
  };
}

const approvedPublicWhere = {
  status: ProviderStatus.APPROVED,
  isActive: true,
} satisfies Prisma.ProviderProfileWhereInput;

export async function listDistinctPublicServices(filters: {
  categoryId?: number;
  zone?: string;
  q?: string;
}): Promise<string[]> {
  const where: Prisma.ProviderProfileWhereInput = {
    ...approvedPublicWhere,
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.zone ? { zone: { contains: filters.zone, mode: "insensitive" } } : {}),
    ...(filters.q
      ? {
          OR: [
            { services: { contains: filters.q, mode: "insensitive" } },
            { displayName: { contains: filters.q, mode: "insensitive" } },
            { zone: { contains: filters.q, mode: "insensitive" } },
            { category: { label: { contains: filters.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const rows = await prisma.providerProfile.findMany({
    where,
    select: { services: true },
    take: 500,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
  });

  const tokens: string[] = [];
  for (const row of rows) tokens.push(...parseServiceOfferings(row.services));
  return dedupeServiceLabels(tokens);
}

export async function listApprovedProvidersForMap(limit = 500) {
  const rows = await prisma.providerProfile.findMany({
    where: {
      ...approvedPublicWhere,
      locationLat: { not: null },
      locationLon: { not: null },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: limit,
    select: publicProfileSelect,
  });

  return rows
    .map((row) => {
      const lat = row.locationLat !== null ? Number(row.locationLat) : null;
      const lon = row.locationLon !== null ? Number(row.locationLon) : null;
      if (lat === null || lon === null || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const profile = mapProfile(row);
      return {
        id: profile.id,
        displayName: profile.displayName,
        categoryLabel: profile.categoryLabel,
        zone: profile.zone,
        lat,
        lon,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
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

function locationData(location?: ProviderLocation) {
  if (!location) return {};
  return {
    locationLat: location.lat,
    locationLon: location.lon,
    locationAccuracy: location.accuracy ?? null,
  };
}

export async function createProviderProfile(yeriaSub: string, input: ProviderProfileInsert) {
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
      ...(input.mediaRefs ? { mediaRefs: input.mediaRefs } : {}),
      ...locationData(input.location),
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

export async function updateProviderProfile(
  yeriaSub: string,
  input: ProviderProfileUpdate & { location?: ProviderLocation; mediaRefs?: ProviderMediaRef[] },
) {
  const { location, mediaRefs, ...scalar } = input;
  return prisma.providerProfile.update({
    where: { yeriaSub },
    data: {
      ...scalar,
      ...(mediaRefs ? { mediaRefs } : {}),
      ...(location ? locationData(location) : {}),
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
