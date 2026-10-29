import type { RequestHandler } from "express";
import { z } from "zod";
import { RequestValidationError } from "../errors";

export function validateBody<T extends z.ZodType>(
  schema: T,
): RequestHandler<Record<string, string>, unknown, unknown> {
  return (request, _response, next) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      next(new RequestValidationError(result.error));
      return;
    }

    request.body = result.data;
    next();
  };
}

export function validateParams<T extends z.ZodType<Record<string, string>>>(
  schema: T,
): RequestHandler<Record<string, string>, unknown, unknown, unknown> {
  return (request, _response, next) => {
    const result = schema.safeParse(request.params);
    if (!result.success) {
      next(new RequestValidationError(result.error));
      return;
    }

    request.params = result.data;
    next();
  };
}
