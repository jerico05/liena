import { Router } from "express";
import type { RequestHandler } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { validateBody, validateParams, validateQuery } from "../../middlewares/validateRequest";
import * as controller from "./user.controller";
import { publicListQuerySchema, providerProfileCreateSchema, providerProfileUpdateSchema, slugParamsSchema } from "./user.validator";

export function createUserRouter(authenticateMiddleware: RequestHandler = authenticate) {
  const router = Router();
  router.get("/categories", controller.listCategories);
  router.get("/providers", validateQuery(publicListQuerySchema), controller.listProviders);
  router.get("/providers/:slug", validateParams(slugParamsSchema), controller.getProvider);
  router.post("/providers/profile", authenticateMiddleware, validateBody(providerProfileCreateSchema), controller.createProfile);
  router.get("/providers/profile/me", authenticateMiddleware, controller.getMyProfile);
  router.put("/providers/profile/me", authenticateMiddleware, validateBody(providerProfileUpdateSchema), controller.updateProfile);
  router.post("/providers/profile/me/submit", authenticateMiddleware, controller.submitProfile);
  router.get("/providers/profile/me/status", authenticateMiddleware, controller.getMyProfile);
  return router;
}

export const userRouter = createUserRouter();
