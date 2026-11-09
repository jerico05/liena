import { Router } from "express";
import type { RequestHandler } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { validateBody } from "../../middlewares/validateRequest";
import * as controller from "./client.controller";
import { requestCreateSchema } from "../service-requests/service-request.validator";

export function createClientRouter(authenticateMiddleware: RequestHandler = authenticate) {
  const router = Router();
  router.use(authenticateMiddleware);
  router.post("/", validateBody(requestCreateSchema), controller.createRequest);
  router.get("/my-requests", controller.listMyRequests);
  router.get("/", controller.listMyRequests);
  return router;
}

export const clientRouter = createClientRouter();
