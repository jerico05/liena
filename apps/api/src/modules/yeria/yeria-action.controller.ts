import type { RequestHandler } from "express";
import { HttpError } from "../../middlewares/errorHandler";
import { parseYeriaMultipart } from "../../middlewares/yeriaMultipart";
import * as providerService from "../providers/provider.service";
import * as controller from "./yeria.controller";
import { resolveCategoryServiceSelection } from "./yeria-service-labels";

/** Formulaires Yeria : POST sur l’URL courante ou `/{viewId}`. */
const postFormHandlers: Record<string, RequestHandler> = {
  "liena-search": controller.searchSubmit,
  "liena-map": controller.mapSubmit,
};

function readActionCode(request: { params: { actionCode?: string }; body?: unknown }): string | undefined {
  const fromPath = request.params.actionCode;
  if (fromPath) return decodeURIComponent(fromPath);
  const body = request.body as Record<string, unknown> | undefined;
  if (typeof body?.code === "string") return body.code;
  if (typeof body?.action === "string") return body.action;
  if (typeof body?.actionCode === "string") return body.actionCode;
  return undefined;
}

export const homeScreenAction: RequestHandler = async (request, response, next) => {
  try {
    const code = readActionCode(request);
    if (!code) throw new HttpError(400, "ACTION_CODE_REQUIRED", "Action code is required.");
    switch (code) {
      case "browse":
        return controller.categories(request, response, next);
      case "search":
        return controller.search(request, response, next);
      case "become-provider":
        return controller.providerOnboarding(request, response, next);
      case "map":
        return controller.providersMap(request, response, next);
      default:
        throw new HttpError(404, "UNKNOWN_ACTION", `Unknown home action "${code}".`);
    }
  } catch (error) {
    next(error);
  }
};

export const categoriesScreenAction: RequestHandler = async (request, response, next) => {
  try {
    const code = readActionCode(request);
    if (!code) throw new HttpError(400, "ACTION_CODE_REQUIRED", "Action code is required.");
    if (code === "empty") return controller.home(request, response, next);
    const match = /^cat-(\d+)$/.exec(code);
    const numericOnly = /^[1-9]\d*$/.exec(code);
    const categoryId = match ? Number(match[1]) : numericOnly ? Number(code) : null;
    if (categoryId === null || !Number.isSafeInteger(categoryId)) {
      throw new HttpError(404, "UNKNOWN_ACTION", `Unknown categories action "${code}".`);
    }
    request.validatedParams = { categoryId };
    return controller.categoryServices(request, response, next);
  } catch (error) {
    next(error);
  }
};

export const providerResultsScreenAction: RequestHandler = async (request, response, next) => {
  try {
    const code = readActionCode(request);
    if (!code) throw new HttpError(400, "ACTION_CODE_REQUIRED", "Action code is required.");
    if (code === "empty") return controller.search(request, response, next);
    const match = /^provider-(.+)$/.exec(code);
    if (!match) throw new HttpError(404, "UNKNOWN_ACTION", `Unknown provider results action "${code}".`);
    request.validatedParams = { id: match[1] };
    return controller.providerDetail(request, response, next);
  } catch (error) {
    next(error);
  }
};

export const providerManageScreenAction: RequestHandler = async (request, response, next) => {
  try {
    const code = readActionCode(request);
    if (!code) throw new HttpError(400, "ACTION_CODE_REQUIRED", "Action code is required.");
    switch (code) {
      case "profile":
        return controller.providerOnboarding(request, response, next);
      case "status":
        return controller.providerStatus(request, response, next);
      case "requests":
        return controller.providerRequests(request, response, next);
      case "submit":
        return controller.providerSubmit(request, response, next);
      default:
        throw new HttpError(404, "UNKNOWN_ACTION", `Unknown manage action "${code}".`);
    }
  } catch (error) {
    next(error);
  }
};

export const providerRequestsScreenAction: RequestHandler = async (request, response, next) => {
  try {
    const code = readActionCode(request);
    if (!code) throw new HttpError(400, "ACTION_CODE_REQUIRED", "Action code is required.");
    if (code === "empty") return controller.providerManage(request, response, next);
    if (code.startsWith("request-")) return controller.home(request, response, next);
    throw new HttpError(404, "UNKNOWN_ACTION", `Unknown requests action "${code}".`);
  } catch (error) {
    next(error);
  }
};

/** Depuis un métier : choix d’un service → `GET …/cat-2/service-1`. */
export const categoryChildAction: RequestHandler = async (request, response, next) => {
  try {
    const code = readActionCode(request);
    if (!code) throw new HttpError(400, "ACTION_CODE_REQUIRED", "Action code is required.");
    if (code === "empty") return controller.categories(request, response, next);
    if (/^service-\d+$/.test(code)) return categoryServicesScreenAction(request, response, next);
    if (code === "providers") {
      return controller.categoryProviders(request, response, next);
    }
    throw new HttpError(404, "UNKNOWN_ACTION", `Unknown category action "${code}".`);
  } catch (error) {
    next(error);
  }
};

export const categoryServicesScreenAction: RequestHandler = async (request, response, next) => {
  try {
    const code = readActionCode(request);
    if (!code || code === "empty") return controller.categories(request, response, next);
    const serviceIndex = /^service-(\d+)$/.exec(code);
    if (serviceIndex) {
      const categoryId =
        (request.validatedParams as { categoryId?: number } | undefined)?.categoryId ??
        Number((request.params as { categoryId?: string }).categoryId);
      if (!Number.isSafeInteger(categoryId) || categoryId < 1) {
        throw new HttpError(400, "VALIDATION_ERROR", "Métier invalide.");
      }
      const selection = await resolveCategoryServiceSelection(categoryId, Number(serviceIndex[1]));
      if (!selection) throw new HttpError(404, "SERVICE_NOT_FOUND", "Ce service n’est plus disponible.");
      request.validatedParams = { categoryId };
      request.validatedQuery = { service: selection.service, page: 1, pageSize: 24 };
      return controller.categoryProviders(request, response, next);
    }
    throw new HttpError(404, "UNKNOWN_ACTION", `Unknown category services action "${code}".`);
  } catch (error) {
    next(error);
  }
};

export const searchServicesScreenAction: RequestHandler = async (request, response, next) => {
  try {
    const code = readActionCode(request);
    if (!code || code === "empty") return controller.search(request, response, next);
    const serviceIndex = /^service-(\d+)$/.exec(code);
    if (serviceIndex) {
      const query = request.validatedQuery as {
        zone?: string;
        q?: string;
        categoryId?: number;
        clientLat?: number;
        clientLon?: number;
      } | undefined;
      const services = await providerService.listDistinctServices({
        zone: query?.zone,
        q: query?.q,
        categoryId: query?.categoryId,
      });
      const label = services[Number(serviceIndex[1]) - 1];
      if (!label) throw new HttpError(404, "SERVICE_NOT_FOUND", "Ce service n’est plus disponible.");
      request.validatedQuery = {
        zone: query?.zone,
        q: query?.categoryId ? undefined : query?.q,
        categoryId: query?.categoryId,
        clientLat: query?.clientLat,
        clientLon: query?.clientLon,
        service: label,
        page: 1,
        pageSize: 24,
      };
      return controller.searchResults(request, response, next);
    }
    throw new HttpError(404, "UNKNOWN_ACTION", `Unknown search services action "${code}".`);
  } catch (error) {
    next(error);
  }
};

const viewActionHandlers: Record<string, RequestHandler> = {
  "liena-home": homeScreenAction,
  "liena-categories": categoriesScreenAction,
  "liena-category-services": categoryServicesScreenAction,
  "liena-search-services": searchServicesScreenAction,
  "liena-provider-results": providerResultsScreenAction,
  "liena-provider-manage": providerManageScreenAction,
  "liena-provider-requests": providerRequestsScreenAction,
};

function readViewId(params: { viewId?: string | string[] }): string {
  const raw = params.viewId;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw[0] ?? "";
  return "";
}

export function createPostViewAction(authenticateMiddleware: RequestHandler): RequestHandler {
  return async (request, response, next) => {
    const viewId = readViewId(request.params);

    if (viewId === "liena-provider-onboarding") {
      return authenticateMiddleware(request, response, () => {
        parseYeriaMultipart(request, response, (parseError) => {
          if (parseError) return next(parseError);
          void controller.providerOnboardingSubmitHandler(request, response, next);
        });
      });
    }

    const formHandler = postFormHandlers[viewId];
    if (formHandler) return formHandler(request, response, next);

    const actionHandler = viewActionHandlers[viewId];
    if (actionHandler) return actionHandler(request, response, next);

    return next();
  };
}

