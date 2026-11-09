import { HttpError } from "../../middlewares/errorHandler";
import * as repository from "./service-request.repository";
import type { RequestCreate } from "./service-request.validator";
import { ServiceRequestStatus } from "@prisma/client";

export async function createRequest(clientYeriaSub: string, input: RequestCreate) {
  const provider = await repository.hasEligibleProvider(input.providerProfileId);
  if (!provider) throw new HttpError(404, "PROVIDER_NOT_FOUND", "The provider does not exist or is not approved.");
  return repository.insertRequest(clientYeriaSub, input);
}

export const listMyRequests = (clientYeriaSub: string) => repository.listMyRequests(clientYeriaSub);

export async function listProviderRequests(providerYeriaSub: string) {
  const profile = await repository.findOwnedProviderProfile(providerYeriaSub);
  if (!profile) throw new HttpError(404, "PROVIDER_PROFILE_NOT_FOUND", "No approved provider profile belongs to this identity.");
  return repository.listProviderRequests(profile.id);
}

async function providerProfileId(providerYeriaSub: string) {
  const profile = await repository.findOwnedProviderProfile(providerYeriaSub);
  if (!profile) throw new HttpError(404, "PROVIDER_PROFILE_NOT_FOUND", "No approved provider profile belongs to this identity.");
  return profile.id;
}

export async function getProviderRequest(providerYeriaSub: string, requestId: string) {
  const profileId = await providerProfileId(providerYeriaSub);
  const numericRequestId = Number(requestId);
  if (!Number.isSafeInteger(numericRequestId) || numericRequestId < 1) {
    throw new HttpError(404, "REQUEST_NOT_FOUND", "The request does not belong to this provider.");
  }
  const request = await repository.findProviderRequest(profileId, numericRequestId);
  if (!request) throw new HttpError(404, "REQUEST_NOT_FOUND", "The request does not belong to this provider.");
  return request;
}

export async function transitionProviderRequest(providerYeriaSub: string, requestId: string, action: "accept" | "decline" | "complete") {
  const profileId = await providerProfileId(providerYeriaSub);
  const numericRequestId = Number(requestId);
  if (!Number.isSafeInteger(numericRequestId) || numericRequestId < 1) {
    throw new HttpError(404, "REQUEST_NOT_FOUND", "The request does not belong to this provider.");
  }
  const transitions = {
    accept: { fromStatus: ServiceRequestStatus.SENT, toStatus: ServiceRequestStatus.ACCEPTED },
    decline: { fromStatus: ServiceRequestStatus.SENT, toStatus: ServiceRequestStatus.DECLINED },
    complete: { fromStatus: ServiceRequestStatus.ACCEPTED, toStatus: ServiceRequestStatus.COMPLETED },
  } as const;
  const transition = transitions[action];
  const request = await repository.transitionProviderRequest({ providerProfileId: profileId, requestId: numericRequestId, actorYeriaSub: providerYeriaSub, ...transition });
  if (!request) throw new HttpError(409, "INVALID_REQUEST_TRANSITION", "The request is not owned by this provider or its status does not allow this action.");
  return request;
}
