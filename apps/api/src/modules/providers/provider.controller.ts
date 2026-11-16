import type { RequestHandler } from "express";
import * as service from "./provider.service";

function identity(request: Parameters<RequestHandler>[0]): string {
  if (!request.user) throw new Error("Authentication middleware did not populate request.user");
  return request.user.yeriaSub;
}

export const listProviders: RequestHandler = async (request, response, next) => { try { response.json(await service.listProviders(request.validatedQuery as never)); } catch (error) { next(error); } };
export const getProvider: RequestHandler = async (request, response, next) => { try { response.json({ data: await service.getProvider((request.validatedParams as { id: string }).id) }); } catch (error) { next(error); } };
export const createProfile: RequestHandler = async (request, response, next) => { try { response.status(201).json({ data: await service.createProfile(identity(request), request.validatedBody as never) }); } catch (error) { next(error); } };
export const getMyProfile: RequestHandler = async (request, response, next) => { try { response.json({ data: await service.getMyProfile(identity(request)) }); } catch (error) { next(error); } };
export const updateProfile: RequestHandler = async (request, response, next) => { try { response.json({ data: await service.updateProfile(identity(request), request.validatedBody as never) }); } catch (error) { next(error); } };
export const submitProfile: RequestHandler = async (request, response, next) => { try { response.json({ data: await service.submitProfile(identity(request)) }); } catch (error) { next(error); } };
