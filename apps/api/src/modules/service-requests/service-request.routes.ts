import { Router } from "express";
import type { RequestHandler } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { validateParams } from "../../middlewares/validateRequest";
import * as controller from "./service-request.controller";
import { requestIdParamsSchema } from "./service-request.validator";

export function createServiceRequestRouter(authenticateMiddleware: RequestHandler = authenticate) {
  const router = Router();
  router.use(authenticateMiddleware);
  router.get("/", controller.listProviderRequests);
  router.get("/:id", validateParams(requestIdParamsSchema), controller.getProviderRequest);
  router.patch("/:id/accept", validateParams(requestIdParamsSchema), controller.transitionProviderRequest("accept"));
  router.patch("/:id/decline", validateParams(requestIdParamsSchema), controller.transitionProviderRequest("decline"));
  router.patch("/:id/complete", validateParams(requestIdParamsSchema), controller.transitionProviderRequest("complete"));
  return router;
}

export const serviceRequestRouter = createServiceRequestRouter();
