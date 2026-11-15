import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler } from "express";
import type { ParsedQs } from "qs";
import type { ParamsDictionary } from "express-serve-static-core";
import { ZodError } from "zod";
import { isTransientDatabaseError } from "../config/database";
import { isYeriaClientPost, respondYeriaClientError } from "../modules/yeria/serve-view";
import { getYeriaApp } from "../config/yeria";

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
  } else if (isTransientDatabaseError(error)) {
    statusCode = 503;
    code = "DATABASE_UNAVAILABLE";
    message = "The database is temporarily unavailable.";
  } else if (isRequestAborted(error)) {
    return;
  } else if (isMalformedJsonError(error)) {
    statusCode = 400;
    code = "INVALID_JSON";
    message = "Request body must contain valid JSON.";
  } else if (statusCode >= 500 && statusCode !== 503) {
    console.error({ requestId, path: request.path, error });
    if (error instanceof Error && !(error instanceof HttpError)) {
      message = "Une erreur serveur est survenue. Réessaie dans un instant.";
    }
  }

  if ((isYeriaClientPost(request) || isYeriaScreenGet(request)) && getYeriaApp()) {
    const detail = details?.length ? `${message} (${details.map((d) => d.message).join(", ")})` : message;
    respondYeriaClientError(response, detail, code);
    return;
  }

  response.status(statusCode).json({
    error: { code, message, ...(details ? { details } : {}) },
    requestId,
  });
};

function isYeriaScreenGet(request: Pick<import("express").Request, "method" | "path">): boolean {
  if (request.method !== "GET") return false;
  if (request.path.startsWith("/screens/")) return true;
  if (request.path === "/" || request.path === "/home") return true;
  if (/^\/(browse|search|map|become-provider)(\/|$)/.test(request.path)) return true;
  return /^\/cat-\d+(\/|$)/.test(request.path) || /^\/[1-9]\d*(\/|$)/.test(request.path);
}

function isDatabaseUnavailable(code: string): boolean {
  return code === "ECONNREFUSED" || code.startsWith("P100");
}

function isRequestAborted(error: unknown): boolean {
  return error instanceof Error && error.message === "Request aborted";
}

function isMalformedJsonError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    error.type === "entity.parse.failed"
  );
}
