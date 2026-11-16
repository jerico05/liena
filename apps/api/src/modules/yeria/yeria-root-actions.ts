import type { RequestHandler } from "express";
import * as actionController from "./yeria-action.controller";
import { browseTrailScreenAction } from "./yeria-trail-action";

const RESERVED_ROOT_SEGMENTS = new Set([
  "api",
  "assets",
  "become-provider",
  "browse",
  "health",
  "home",
  "map",
  "screens",
  "search",
]);

/** Codes Yeria parfois appelés à la racine du service (ex. `GET /cat-3`). */
export function isRootYeriaActionCode(code: string): boolean {
  return (
    /^cat-\d+$/.test(code) ||
    /^[1-9]\d*$/.test(code) ||
    /^service-\d+$/.test(code) ||
    /^provider-.+/.test(code) ||
    code === "providers" ||
    code === "empty"
  );
}

function readTrailParts(request: Parameters<RequestHandler>[0]): string | null {
  const rest = request.params.trail;
  if (typeof rest === "string" && rest.length > 0) return rest;
  if (Array.isArray(rest) && rest.length > 0) return rest.join("/");
  return null;
}

function dispatchRootTrail(head: string, rest: string | null): RequestHandler {
  return (request, response, next) => {
    request.params.trail = rest ? `${head}/${rest}` : head;
    return browseTrailScreenAction(request, response, next);
  };
}

export const rootYeriaSingleAction: RequestHandler = (request, response, next) => {
  const code = request.params.actionCode;
  if (typeof code !== "string" || RESERVED_ROOT_SEGMENTS.has(code) || !isRootYeriaActionCode(code)) {
    return next();
  }
  (request.params as { actionCode: string }).actionCode = code;
  if (/^cat-\d+$/.test(code) || /^[1-9]\d*$/.test(code)) {
    return actionController.categoriesScreenAction(request, response, next);
  }
  if (/^service-\d+$/.test(code)) {
    return actionController.searchServicesScreenAction(request, response, next);
  }
  if (/^provider-.+/.test(code)) {
    return actionController.providerResultsScreenAction(request, response, next);
  }
  return next();
};

export const rootYeriaNestedAction: RequestHandler = (request, response, next) => {
  const head = request.params.actionCode;
  if (typeof head !== "string" || RESERVED_ROOT_SEGMENTS.has(head)) return next();
  if (!/^cat-\d+$/.test(head) && !/^[1-9]\d*$/.test(head)) return next();
  return dispatchRootTrail(head, readTrailParts(request))(request, response, next);
};