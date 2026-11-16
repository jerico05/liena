import { Router, type RequestHandler } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { validateParams, validateQuery } from "../../middlewares/validateRequest";
import * as actionController from "./yeria-action.controller";
import { attachResolvedCategoryId } from "./yeria-category.routes.middleware";
import { browseTrailScreenAction, searchServicesTrailScreenAction } from "./yeria-trail-action";
import * as controller from "./yeria.controller";
import {
  categoryProvidersQuerySchema,
  mapQuerySchema,
  providerIdParamsSchema,
  searchResultsQuerySchema,
  searchServicesQuerySchema,
} from "./yeria.validator";

export function createYeriaRouter(authenticateMiddleware: RequestHandler = authenticate) {
  const router = Router();
  const categoryId = attachResolvedCategoryId("categoryId");

  router.get("/home", controller.home);
  router.get("/home/:actionCode", actionController.homeScreenAction);
  router.post("/home/become-provider", authenticateMiddleware, ...controller.providerOnboardingSubmit);
  router.post("/home/search", controller.searchSubmit);
  router.post("/home/map", controller.mapSubmit);
  router.post("/home", actionController.homeScreenAction);

  router.get("/categories", controller.categories);
  router.post("/categories", actionController.categoriesScreenAction);
  router.get("/home/browse/:actionCode", actionController.categoriesScreenAction);
  router.post("/home/browse/:actionCode", actionController.categoriesScreenAction);
  router.get("/home/browse/{*trail}", browseTrailScreenAction);
  router.post("/home/browse/{*trail}", browseTrailScreenAction);

  // Yeria ActionGrid : GET {urlCourante}/{codeAction} — ex. /screens/categories/cat-2/service-1
  router.get("/categories/:categoryId/:actionCode", categoryId, actionController.categoryChildAction);
  router.post("/categories/:categoryId/:actionCode", categoryId, actionController.categoryChildAction);

  router.get(
    "/categories/:categoryId/providers",
    categoryId,
    validateQuery(categoryProvidersQuerySchema) as unknown as RequestHandler,
    controller.categoryProviders,
  );
  router.get("/categories/:categoryId/providers/:actionCode", categoryId, actionController.providerResultsScreenAction);
  router.post("/categories/:categoryId/providers/:actionCode", categoryId, actionController.providerResultsScreenAction);

  router.get("/categories/:actionCode", actionController.categoriesScreenAction);
  router.post("/categories/:actionCode", actionController.categoriesScreenAction);
  router.get("/categories/{*trail}", browseTrailScreenAction);
  router.post("/categories/{*trail}", browseTrailScreenAction);

  router.get("/search", controller.search);
  router.post("/search", controller.searchSubmit);
  router.get(
    "/search/services",
    validateQuery(searchServicesQuerySchema) as unknown as RequestHandler,
    controller.searchServices,
  );
  router.get(
    "/search/services/:actionCode",
    validateQuery(searchServicesQuerySchema) as unknown as RequestHandler,
    actionController.searchServicesScreenAction,
  );
  router.post(
    "/search/services",
    validateQuery(searchServicesQuerySchema) as unknown as RequestHandler,
    actionController.searchServicesScreenAction,
  );
  router.post(
    "/search/services/:actionCode",
    validateQuery(searchServicesQuerySchema) as unknown as RequestHandler,
    actionController.searchServicesScreenAction,
  );
  router.get(
    "/search/services/{*trail}",
    validateQuery(searchServicesQuerySchema) as unknown as RequestHandler,
    searchServicesTrailScreenAction,
  );
  router.post(
    "/search/services/{*trail}",
    validateQuery(searchServicesQuerySchema) as unknown as RequestHandler,
    searchServicesTrailScreenAction,
  );
  router.get("/home/search/services/{*trail}", searchServicesTrailScreenAction);
  router.post("/home/search/services/{*trail}", searchServicesTrailScreenAction);
  router.get("/search/results", validateQuery(searchResultsQuerySchema) as unknown as RequestHandler, controller.searchResults);
  router.get(
    "/search/results/:actionCode",
    validateQuery(searchResultsQuerySchema) as unknown as RequestHandler,
    actionController.providerResultsScreenAction,
  );
  router.post(
    "/search/results/:actionCode",
    validateQuery(searchResultsQuerySchema) as unknown as RequestHandler,
    actionController.providerResultsScreenAction,
  );
  router.get("/search/:actionCode", actionController.providerResultsScreenAction);
  router.get("/home/search/:actionCode", actionController.providerResultsScreenAction);
  router.get("/providers/:id", validateParams(providerIdParamsSchema), controller.providerDetail);
  router.get(
    "/providers/:id/request",
    authenticateMiddleware,
    validateParams(providerIdParamsSchema),
    controller.serviceRequestForm,
  );
  router.post(
    "/providers/:id/request",
    authenticateMiddleware,
    validateParams(providerIdParamsSchema),
    controller.serviceRequestSubmit,
  );
  router.get("/map", validateQuery(mapQuerySchema) as unknown as RequestHandler, controller.providersMap);
  router.post("/map", controller.mapSubmit);

  router.get("/provider/onboarding", controller.providerOnboarding);
  router.post("/provider/onboarding", authenticateMiddleware, ...controller.providerOnboardingSubmit);
  router.get("/provider/manage", authenticateMiddleware, controller.providerManage);
  router.get("/provider/manage/:actionCode", authenticateMiddleware, actionController.providerManageScreenAction);
  router.post("/provider/manage", authenticateMiddleware, actionController.providerManageScreenAction);
  router.get("/provider/status", authenticateMiddleware, controller.providerStatus);
  router.get("/provider/requests", authenticateMiddleware, controller.providerRequests);
  router.get("/provider/requests/:actionCode", authenticateMiddleware, actionController.providerRequestsScreenAction);
  router.post("/provider/requests", authenticateMiddleware, actionController.providerRequestsScreenAction);
  router.get("/provider/submit", authenticateMiddleware, controller.providerSubmit);

  return router;
}

export const yeriaRouter = createYeriaRouter();