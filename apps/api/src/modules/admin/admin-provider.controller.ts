import type { RequestHandler } from "express";
import {
  deleteAdminProvider,
  getAdminProviderDetail,
  listAdminProviders,
  reviewAdminProvider,
} from "./admin-provider.service";
import type { ProviderDeleteInput, ProviderListQuery, ProviderReviewInput } from "./admin-provider.validator";

export const listProviders: RequestHandler = async (request, response, next) => {
  try {
    const payload = await listAdminProviders(request.validatedQuery as ProviderListQuery);
    response.status(200).json(payload);
  } catch (error) {
    next(error);
  }
};

export const getProvider: RequestHandler = async (request, response, next) => {
  try {
    const { id } = request.validatedParams as { id: string };
    const payload = await getAdminProviderDetail(id);
    response.status(200).json(payload);
  } catch (error) {
    next(error);
  }
};

export const reviewProvider: RequestHandler = async (request, response, next) => {
  try {
    const { id } = request.validatedParams as { id: string };
    const admin = response.locals.admin as { username: string };
    await reviewAdminProvider(id, request.validatedBody as ProviderReviewInput, admin.username);
    response.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const deleteProvider: RequestHandler = async (request, response, next) => {
  try {
    const { id } = request.validatedParams as { id: string };
    const admin = response.locals.admin as { username: string };
    await deleteAdminProvider(id, request.validatedBody as ProviderDeleteInput, admin.username);
    response.status(204).send();
  } catch (error) {
    next(error);
  }
};
