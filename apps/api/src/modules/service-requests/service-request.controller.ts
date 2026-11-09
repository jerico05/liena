import type { RequestHandler } from "express";
import * as service from "./service-request.service";

function identity(request: Parameters<RequestHandler>[0]): string {
  if (!request.user) throw new Error("Authentication middleware did not populate request.user");
  return request.user.yeriaSub;
}

export const createRequest: RequestHandler = async (request, response, next) => {
  try { response.status(201).json({ data: await service.createRequest(identity(request), request.validatedBody as never) }); } catch (error) { next(error); }
};

export const listMyRequests: RequestHandler = async (request, response, next) => {
  try { response.json({ data: await service.listMyRequests(identity(request)) }); } catch (error) { next(error); }
};

export const listProviderRequests: RequestHandler = async (request, response, next) => {
  try { response.json({ data: await service.listProviderRequests(identity(request)) }); } catch (error) { next(error); }
};

export const getProviderRequest: RequestHandler = async (request, response, next) => {
  try { response.json({ data: await service.getProviderRequest(identity(request), String(request.params.id)) }); } catch (error) { next(error); }
};

export const transitionProviderRequest = (action: "accept" | "decline" | "complete"): RequestHandler => async (request, response, next) => {
  try { response.json({ data: await service.transitionProviderRequest(identity(request), String(request.params.id), action) }); } catch (error) { next(error); }
};
