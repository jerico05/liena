import { HttpError } from "../../middlewares/errorHandler";
import * as repository from "./requests.repository";
import type { RequestCreate } from "./requests.validator";
import { ProviderStatus, ServiceRequestStatus } from "@prisma/client";

export async function createRequest(clientYeriaSub: string, input: RequestCreate) {
  const { category, provider } = await repository.createRequest(clientYeriaSub, input);
  if (!provider) throw new HttpError(404, "PROVIDER_NOT_FOUND", "The provider does not exist or is not approved.");
  if (!category) throw new HttpError(404, "CATEGORY_NOT_FOUND", "The category does not exist or is inactive.");
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
  const request = await repository.findProviderRequest(profileId, requestId);
  if (!request) throw new HttpError(404, "REQUEST_NOT_FOUND", "The request does not belong to this provider.");
  return request;
}

export async function transitionProviderRequest(providerYeriaSub: string, requestId: string, action: "accept" | "decline" | "complete") {
  const profileId = await providerProfileId(providerYeriaSub);
  const transitions = {
    accept: { fromStatus: ServiceRequestStatus.OPEN, toStatus: ServiceRequestStatus.ACCEPTED },
    decline: { fromStatus: ServiceRequestStatus.OPEN, toStatus: ServiceRequestStatus.DECLINED },
    complete: { fromStatus: ServiceRequestStatus.ACCEPTED, toStatus: ServiceRequestStatus.COMPLETED },
  } as const;
  const transition = transitions[action];
  const request = await repository.transitionProviderRequest({ providerProfileId: profileId, requestId, actorYeriaSub: providerYeriaSub, ...transition });
  if (!request) throw new HttpError(409, "INVALID_REQUEST_TRANSITION", "The request is not owned by this provider or its status does not allow this action.");
  return request;
}
