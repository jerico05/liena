import type { RequestHandler } from "express";
import { resolveCategoryId } from "./yeria-category.routes.middleware";
import * as actionController from "./yeria-action.controller";

export type YeriaTrailContext = "browse" | "search-services";

/** Segments après un préfixe d’écran (Yeria empile `{base}/{code}` à chaque clic). */
export function parseYeriaActionTrail(segments: string[]): { actionCode: string; categoryId?: number } | null {
  if (segments.length === 0) return null;
  const actionCode = segments[segments.length - 1] ?? "";
  if (!actionCode) return null;
  let categoryId: number | undefined;
  for (const segment of segments) {
    const id = resolveCategoryId(segment);
    if (id !== null) categoryId = id;
  }
  return { actionCode, categoryId };
}

function applyTrailToRequest(
  request: Parameters<RequestHandler>[0],
  trail: string,
): { actionCode: string; categoryId?: number } | null {
  const segments = trail.split("/").filter(Boolean);
  const parsed = parseYeriaActionTrail(segments);
  if (!parsed) return null;
  (request.params as { actionCode?: string }).actionCode = parsed.actionCode;
  if (parsed.categoryId !== undefined) {
    request.validatedParams = {
      ...(request.validatedParams as Record<string, unknown> | undefined),
      categoryId: parsed.categoryId,
    };
  }
  return parsed;
}

function readTrailParam(request: Parameters<RequestHandler>[0]): string | null {
  const raw = request.params.trail;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw.join("/");
  return null;
}

function createTrailHandler(context: YeriaTrailContext): RequestHandler {
  return (request, response, next) => {
    const trail = readTrailParam(request);
    if (!trail) return next();
    const parsed = applyTrailToRequest(request, trail);
    if (!parsed) return next();

    const { actionCode } = parsed;
    if (/^cat-\d+$/.test(actionCode) || /^[1-9]\d*$/.test(actionCode)) {
      return actionController.categoriesScreenAction(request, response, next);
    }
    if (/^service-\d+$/.test(actionCode)) {
      if (context === "search-services") {
        return actionController.searchServicesScreenAction(request, response, next);
      }
      return actionController.categoryChildAction(request, response, next);
    }
    if (/^provider-.+/.test(actionCode)) {
      return actionController.providerResultsScreenAction(request, response, next);
    }
    if (actionCode === "providers") {
      return actionController.categoryChildAction(request, response, next);
    }
    if (actionCode === "empty" && context === "browse") {
      return actionController.categoriesScreenAction(request, response, next);
    }
    if (actionCode === "empty" && context === "search-services") {
      return actionController.searchServicesScreenAction(request, response, next);
    }

    return next();
  };
}

export const browseTrailScreenAction = createTrailHandler("browse");
export const searchServicesTrailScreenAction = createTrailHandler("search-services");