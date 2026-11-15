import type { RequestHandler } from "express";
import { tryAttachYeriaUser } from "../../middlewares/authenticate";
import { parseYeriaMultipart } from "../../middlewares/yeriaMultipart";
import { HttpError } from "../../middlewares/errorHandler";
import { respondWithYeriaView } from "./serve-view";
import * as screenService from "./yeria-screen.service";
import type { z } from "zod";
import type {
  categoryProvidersQuerySchema,
  searchResultsQuerySchema,
  searchServicesQuerySchema,
} from "./yeria.validator";

type SearchResultsQuery = z.infer<typeof searchResultsQuerySchema>;
type SearchServicesQuery = z.infer<typeof searchServicesQuerySchema>;
type CategoryProvidersQuery = z.infer<typeof categoryProvidersQuerySchema>;

function yeriaIdentity(request: Parameters<RequestHandler>[0]): string {
  if (!request.user) throw new HttpError(401, "AUTHENTICATION_REQUIRED", "A valid Yeria bearer token is required.");
  return request.user.yeriaSub;
}

export const home: RequestHandler = (_request, response) => {
  respondWithYeriaView(response, screenService.homeScreen());
};

export const categories: RequestHandler = async (_request, response, next) => {
  try {
    respondWithYeriaView(response, await screenService.categoriesScreen());
  } catch (error) {
    next(error);
  }
};

export const categoryServices: RequestHandler = async (request, response, next) => {
  try {
    const { categoryId } = request.validatedParams as { categoryId: number };
    respondWithYeriaView(response, await screenService.categoryServicesScreen(categoryId));
  } catch (error) {
    next(error);
  }
};

export const categoryProviders: RequestHandler = async (request, response, next) => {
  try {
    const { categoryId } = request.validatedParams as { categoryId: number };
    const query = (request.validatedQuery ?? {}) as CategoryProvidersQuery;
    respondWithYeriaView(
      response,
      await screenService.categoryProvidersScreen(categoryId, {
        service: query.service,
        page: query.page,
        pageSize: query.pageSize,
      }),
    );
  } catch (error) {
    next(error);
  }
};

export const searchServices: RequestHandler = async (request, response, next) => {
  try {
    const query = request.validatedQuery as SearchServicesQuery;
    respondWithYeriaView(response, await screenService.searchServicesScreen(query));
  } catch (error) {
    next(error);
  }
};

export const search: RequestHandler = async (_request, response, next) => {
  try {
    respondWithYeriaView(response, await screenService.searchScreen());
  } catch (error) {
    next(error);
  }
};

export const searchSubmit: RequestHandler = async (request, response, next) => {
  try {
    respondWithYeriaView(response, await screenService.searchSubmit(request.body as Record<string, unknown>));
  } catch (error) {
    next(error);
  }
};

export const providerOnboardingSubmitHandler: RequestHandler = async (request, response, next) => {
  try {
    respondWithYeriaView(
      response,
      await screenService.providerOnboardingSubmit(
        yeriaIdentity(request),
        request.body as Record<string, unknown>,
        request,
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const providerOnboardingSubmit: RequestHandler[] = [
  parseYeriaMultipart,
  providerOnboardingSubmitHandler,
];

export const searchResults: RequestHandler = async (request, response, next) => {
  try {
    const query = request.validatedQuery as SearchResultsQuery;
    respondWithYeriaView(response, await screenService.searchResultsScreen(query));
  } catch (error) {
    next(error);
  }
};

export const providerDetail: RequestHandler = async (request, response, next) => {
  try {
    const { id } = request.validatedParams as { id: string };
    respondWithYeriaView(response, await screenService.providerDetailScreen(id));
  } catch (error) {
    next(error);
  }
};

export const serviceRequestForm: RequestHandler = async (request, response, next) => {
  try {
    const { id } = request.validatedParams as { id: string };
    respondWithYeriaView(response, await screenService.serviceRequestFormScreen(id));
  } catch (error) {
    next(error);
  }
};

export const serviceRequestSubmit: RequestHandler = async (request, response, next) => {
  try {
    const { id } = request.validatedParams as { id: string };
    respondWithYeriaView(
      response,
      await screenService.serviceRequestSubmit(yeriaIdentity(request), id, request.body as Record<string, unknown>),
    );
  } catch (error) {
    next(error);
  }
};

export const providersMap: RequestHandler = async (request, response, next) => {
  try {
    const query = (request.validatedQuery ?? {}) as { clientLat?: number; clientLon?: number };
    if (query.clientLat !== undefined && query.clientLon !== undefined) {
      respondWithYeriaView(response, await screenService.providersMapScreen(query.clientLat, query.clientLon));
      return;
    }
    respondWithYeriaView(response, screenService.mapAccessScreen());
  } catch (error) {
    next(error);
  }
};

export const mapSubmit: RequestHandler = async (request, response, next) => {
  try {
    respondWithYeriaView(response, await screenService.mapSubmit(request.body as Record<string, unknown>));
  } catch (error) {
    next(error);
  }
};

export const providerOnboarding: RequestHandler = async (request, response, next) => {
  try {
    await tryAttachYeriaUser(request);
    respondWithYeriaView(response, await screenService.resolveBecomeProviderScreen(request.user?.yeriaSub));
  } catch (error) {
    next(error);
  }
};

export const providerManage: RequestHandler = async (request, response, next) => {
  try {
    respondWithYeriaView(response, await screenService.providerManageScreen(yeriaIdentity(request)));
  } catch (error) {
    next(error);
  }
};

export const providerStatus: RequestHandler = async (request, response, next) => {
  try {
    respondWithYeriaView(response, await screenService.providerStatusScreen(yeriaIdentity(request)));
  } catch (error) {
    next(error);
  }
};

export const providerRequests: RequestHandler = async (request, response, next) => {
  try {
    respondWithYeriaView(response, await screenService.providerRequestsScreen(yeriaIdentity(request)));
  } catch (error) {
    next(error);
  }
};

export const providerSubmit: RequestHandler = async (request, response, next) => {
  try {
    respondWithYeriaView(response, await screenService.providerSubmitScreen(yeriaIdentity(request)));
  } catch (error) {
    next(error);
  }
};
