import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler } from "express";
import type { ParsedQs } from "qs";
import type { ParamsDictionary } from "express-serve-static-core";
import { ZodError } from "zod";

type AppLocals = { requestId: string };

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "HttpError";
  }
}

export class RequestValidationError extends Error {
  constructor(public readonly validation: ZodError) {
    super("Request validation failed.");
    this.name = "RequestValidationError";
  }
}

export const errorHandler: ErrorRequestHandler<
  ParamsDictionary,
  unknown,
  unknown,
  ParsedQs,
  AppLocals
> = (error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  const requestId = response.locals.requestId;
  let statusCode = 500;
  let code = "INTERNAL_SERVER_ERROR";
  let message = "An unexpected error occurred.";
  let details: Array<{ path: string; message: string }> | undefined;

  if (error instanceof RequestValidationError) {
    statusCode = 400;
    code = "VALIDATION_ERROR";
    message = "Request data is invalid.";
    details = error.validation.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
  } else if (error instanceof HttpError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
  } else if (error instanceof Prisma.PrismaClientKnownRequestError && isDatabaseUnavailable(error.code)) {
    statusCode = 503;
    code = "DATABASE_UNAVAILABLE";
    message = "The database is temporarily unavailable.";
  } else if (error instanceof Prisma.PrismaClientInitializationError) {
    statusCode = 503;
    code = "DATABASE_UNAVAILABLE";
    message = "The database is temporarily unavailable.";
  } else if (isMalformedJsonError(error)) {
    statusCode = 400;
    code = "INVALID_JSON";
    message = "Request body must contain valid JSON.";
  } else if (statusCode >= 500) {
    console.error({ requestId, path: request.path, error });
  }

  response.status(statusCode).json({
    error: { code, message, ...(details ? { details } : {}) },
    requestId,
  });
};

function isDatabaseUnavailable(code: string): boolean {
  return code === "ECONNREFUSED" || code.startsWith("P100");
}

function isMalformedJsonError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "entity.parse.failed"
  );
}
