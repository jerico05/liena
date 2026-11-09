import { ProviderStatus, ServiceRequestStatus } from "@prisma/client";
import { prisma } from "../../config/database";
import type { RequestCreate } from "./service-request.validator";

export async function createRequest(clientYeriaSub: string, input: RequestCreate) {
  const [category, provider] = await Promise.all([
    prisma.category.findFirst({ where: { id: input.categoryId, isActive: true }, select: { id: true } }),
    prisma.providerProfile.findFirst({ where: { id: input.providerProfileId, status: { in: [ProviderStatus.APPROVED, ProviderStatus.VERIFIED] } }, select: { id: true } }),
  ]);
  return { category, provider };
}

export async function insertRequest(clientYeriaSub: string, input: RequestCreate) {
  return prisma.serviceRequest.create({
    data: {
      reference: `REQ-${Date.now().toString(36).toUpperCase()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
      clientYeriaSub,
      providerProfileId: input.providerProfileId,
      categoryId: input.categoryId,
      title: input.title,
      description: input.description,
      countryCode: input.countryCode,
      city: input.city,
      neighborhood: input.neighborhood ?? null,
      requestedStartsAt: input.requestedStartsAt ?? null,
      status: ServiceRequestStatus.OPEN,
    },
    select: { id: true, reference: true, clientYeriaSub: true, providerProfileId: true, categoryId: true, title: true, description: true, countryCode: true, city: true, neighborhood: true, requestedStartsAt: true, status: true, createdAt: true },
  });
}

export async function listMyRequests(clientYeriaSub: string) {
  return prisma.serviceRequest.findMany({
    where: { clientYeriaSub }, orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: { id: true, reference: true, providerProfileId: true, categoryId: true, title: true, description: true, countryCode: true, city: true, neighborhood: true, requestedStartsAt: true, status: true, createdAt: true, updatedAt: true },
  });
}

const providerRequestSelect = {
  id: true, reference: true, clientYeriaSub: true, providerProfileId: true,
  categoryId: true, title: true, description: true, countryCode: true,
  city: true, neighborhood: true, requestedStartsAt: true, status: true,
  createdAt: true, updatedAt: true,
} as const;

export async function findOwnedProviderProfile(providerYeriaSub: string) {
  return prisma.providerProfile.findFirst({
    where: { yeriaSub: providerYeriaSub, status: { in: [ProviderStatus.APPROVED, ProviderStatus.VERIFIED] } },
    select: { id: true },
  });
}

export async function listProviderRequests(providerProfileId: string) {
  return prisma.serviceRequest.findMany({
    where: { providerProfileId },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    select: providerRequestSelect,
  });
}

export async function findProviderRequest(providerProfileId: string, requestId: string) {
  return prisma.serviceRequest.findFirst({
    where: { id: requestId, providerProfileId },
    select: { ...providerRequestSelect, events: { orderBy: { createdAt: "asc" }, select: { id: true, fromStatus: true, toStatus: true, actorYeriaSub: true, note: true, createdAt: true } } },
  });
}

export async function transitionProviderRequest(input: {
  providerProfileId: string;
  requestId: string;
  actorYeriaSub: string;
  fromStatus: ServiceRequestStatus;
  toStatus: ServiceRequestStatus;
}) {
  return prisma.$transaction(async (transaction) => {
    const request = await transaction.serviceRequest.findFirst({
      where: { id: input.requestId, providerProfileId: input.providerProfileId, status: input.fromStatus },
      select: { id: true, status: true },
    });
    if (!request) return null;
    const updated = await transaction.serviceRequest.update({
      where: { id: input.requestId }, data: { status: input.toStatus }, select: providerRequestSelect,
    });
    await transaction.requestEvent.create({
      data: { requestId: input.requestId, fromStatus: input.fromStatus, toStatus: input.toStatus, actorYeriaSub: input.actorYeriaSub },
    });
    return updated;
  });
}
