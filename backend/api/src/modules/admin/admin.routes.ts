import { Router } from "express";
import rateLimit from "express-rate-limit";
import { getCsrf, getMe, postLogin, postLogout } from "./admin-auth.controller";
import { getDashboard } from "./admin-dashboard.controller";
import {
  deleteProvider,
  getProvider,
  listProviders,
  reviewProvider,
} from "./admin-provider.controller";
import { requireAdmin, requireCsrf } from "./admin-auth.middleware";
import { validateBody, validateParams, validateQuery } from "../../middlewares/validateRequest";
import { adminLoginSchema } from "./admin-auth.validator";
import {
  providerIdParamsSchema,
  providerDeleteSchema,
  providerListQuerySchema,
  providerReviewSchema,
} from "./admin-provider.validator";

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "Too many login attempts. Try again later.",
    },
  },
});

export const adminRouter = Router();

adminRouter.get("/csrf", getCsrf);
adminRouter.post("/login", loginRateLimiter, requireCsrf, validateBody(adminLoginSchema), postLogin);
adminRouter.get("/me", requireAdmin, getMe);
adminRouter.post("/logout", requireAdmin, requireCsrf, postLogout);
adminRouter.get("/dashboard", requireAdmin, getDashboard);
adminRouter.get(
  "/providers",
  requireAdmin,
  validateQuery(providerListQuerySchema),
  listProviders,
);
adminRouter.get(
  "/providers/:id",
  requireAdmin,
  validateParams(providerIdParamsSchema),
  getProvider,
);
adminRouter.post(
  "/providers/:id/review",
  requireAdmin,
  requireCsrf,
  validateParams(providerIdParamsSchema),
  validateBody(providerReviewSchema),
  reviewProvider,
);
adminRouter.post(
  "/providers/:id/delete",
  requireAdmin,
  requireCsrf,
  validateParams(providerIdParamsSchema),
  validateBody(providerDeleteSchema),
  deleteProvider,
);
