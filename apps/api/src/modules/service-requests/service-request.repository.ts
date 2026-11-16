import { ProviderStatus, ServiceRequestStatus } from "@prisma/client";
import { prisma } from "../../config/database";
import type { RequestCreate } from "./service-request.validator";

const requestSelect = {
  id: true,
  clientYeriaSub: true,
  providerProfileId: true,
  description: true,
  zone: true,
  clientContact: true,
  locationLat: true,
  locationLon: true,
  locationAccuracy: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

function locationData(location?: { lat: number; lon: number; accuracy?: number }) {
  if (!location) return {};
  return {
    locationLat: location.lat,
    locationLon: location.lon,
    locationAccuracy: location.accuracy ?? null,
  };
}

type RequestRow = {
  id: number;
  clientYeriaSub: string;
  providerProfileId: number;
  description: string;
  zone: string | null;
  clientContact: string | null;
  locationLat: { toString(): string } | null;
  locationLon: { toString(): string } | null;
  locationAccuracy: { toString(): string } | null;
  status: ServiceRequestStatus;
  createdAt: Date;
  updatedAt: Date;
};

export function serializeServiceRequest(row: RequestRow) {
  return {
    id: row.id,
    clientYeriaSub: row.clientYeriaSub,
    providerProfileId: row.providerProfileId,
    description: row.description,
    zone: row.zone,
    clientContact: row.clientContact,
    locationLat: row.locationLat?.toString() ?? null,
    locationLon: row.locationLon?.toString() ?? null,
    locationAccuracy: row.locationAccuracy?.toString() ?? null,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function hasEligibleProvider(providerProfileId: number) {
  return prisma.providerProfile.findFirst({
    where: {
      id: providerProfileId,
      status: ProviderStatus.APPROVED,
      isActive: true,
    },
    select: { id: true },
  });
}

export async function insertRequest(clientYeriaSub: string, input: RequestCreate) {
  return prisma.$transaction(async (transaction) => {
    const request = await transaction.serviceRequest.create({
      data: {
        clientYeriaSub,
        providerProfileId: input.providerProfileId,
        description: input.description,
        zone: input.zone,
        clientContact: input.clientContact,
        ...locationData(input.location),
        status: ServiceRequestStatus.SENT,
      },
      select: requestSelect,
    });
    await transaction.requestEvent.create({
      data: {
        serviceRequestId: request.id,
        actorYeriaSub: clientYeriaSub,
        newStatus: ServiceRequestStatus.SENT,
      },
    });
    return serializeServiceRequest(request);
  });
}

export async function listMyRequests(clientYeriaSub: string) {
  const rows = await prisma.serviceRequest.findMany({
    where: { clientYeriaSub },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: requestSelect,
  });
  return rows.map((row) => serializeServiceRequest(row));
}

export async function findOwnedProviderProfile(providerYeriaSub: string) {
  return prisma.providerProfile.findFirst({
    where: {
      yeriaSub: providerYeriaSub,
      status: ProviderStatus.APPROVED,
      isActive: true,
    },
    select: { id: true },
  });
}

export async function listProviderRequests(providerProfileId: number) {
  const rows = await prisma.serviceRequest.findMany({
    where: { providerProfileId },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: requestSelect,
  });
  return rows.map((row) => serializeServiceRequest(row));
}

export async function findProviderRequest(providerProfileId: number, requestId: number) {
  const row = await prisma.serviceRequest.findFirst({
    where: { id: requestId, providerProfileId },
    select: {
      ...requestSelect,
      events: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          oldStatus: true,
          newStatus: true,
          actorYeriaSub: true,
          note: true,
          createdAt: true,
        },
      },
    },
  });
  if (!row) return null;
  const { events, ...request } = row;
  return { ...serializeServiceRequest(request), events };
}

export async function transitionProviderRequest(input: {
  providerProfileId: number;
  requestId: number;
  actorYeriaSub: string;
  fromStatus: ServiceRequestStatus;
  toStatus: ServiceRequestStatus;
}) {
  return prisma.$transaction(async (transaction) => {
    const updatedCount = await transaction.serviceRequest.updateMany({
      where: {
        id: input.requestId,
        providerProfileId: input.providerProfileId,
        status: input.fromStatus,
      },
      data: { status: input.toStatus },
    });
    if (updatedCount.count !== 1) return null;

    const updated = await transaction.serviceRequest.findUnique({
      where: { id: input.requestId },
      select: requestSelect,
    });
    if (!updated) return null;

    await transaction.requestEvent.create({
      data: {
        serviceRequestId: input.requestId,
        actorYeriaSub: input.actorYeriaSub,
        oldStatus: input.fromStatus,
        newStatus: input.toStatus,
      },
    });
    return updated ? serializeServiceRequest(updated) : null;
  });
}
