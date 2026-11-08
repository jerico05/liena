import { Router } from "express";
import type { RequestHandler } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { validateBody, validateParams } from "../../middlewares/validateRequest";
import * as controller from "./requests.controller";
import { requestCreateSchema, requestIdParamsSchema } from "./requests.validator";

export function createRequestsRouter(authenticateMiddleware: RequestHandler = authenticate) {
  const router = Router();
  router.use(authenticateMiddleware);
  router.post("/", validateBody(requestCreateSchema), controller.createRequest);
  router.get("/my-requests", controller.listMyRequests);
  router.get("/", controller.listMyRequests);
  return router;
}

export function createProviderRequestsRouter(authenticateMiddleware: RequestHandler = authenticate) {
  const router = Router();
  router.use(authenticateMiddleware);
  router.get("/", controller.listProviderRequests);
  router.get("/:id", validateParams(requestIdParamsSchema), controller.getProviderRequest);
  router.patch("/:id/accept", validateParams(requestIdParamsSchema), controller.transitionProviderRequest("accept"));
  router.patch("/:id/decline", validateParams(requestIdParamsSchema), controller.transitionProviderRequest("decline"));
  router.patch("/:id/complete", validateParams(requestIdParamsSchema), controller.transitionProviderRequest("complete"));
  return router;
}

export const requestsRouter = createRequestsRouter();
