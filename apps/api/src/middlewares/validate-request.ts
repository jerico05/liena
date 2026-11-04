import type { RequestHandler } from "express";
import type { z } from "zod";
import { RequestValidationError } from "./error-handler";

/** Express 5 : `query`, `params` et souvent `body` ne sont plus réassignables — données validées sur le request. */
export function validateBody<T extends z.ZodType>(schema: T): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      next(new RequestValidationError(result.error));
      return;
    }
    request.validatedBody = result.data;
    next();
  };
}

export function validateParams<T extends z.ZodType>(schema: T): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.params);
    if (!result.success) {
      next(new RequestValidationError(result.error));
      return;
    }
    request.validatedParams = result.data;
    next();
  };
}

export function validateQuery<T extends z.ZodType>(schema: T): RequestHandler {
  return (request, _response, next) => {
    const result = schema.safeParse(request.query);
    if (!result.success) {
      next(new RequestValidationError(result.error));
      return;
    }
    request.validatedQuery = result.data;
    next();
  };
}
