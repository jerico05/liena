import { Router } from "express";
import rateLimit from "express-rate-limit";
import { getCsrf, getMe, postLogin, postLogout } from "../controllers/admin-auth.controller";
import { getDashboard } from "../controllers/admin-dashboard.controller";
import {
  getProvider,
  listProviders,
  reviewProvider,
} from "../controllers/admin-provider.controller";
import { requireAdmin, requireCsrf } from "../middlewares/admin-auth.middleware";
import { validateBody, validateParams, validateQuery } from "../middlewares/validate-request";
import { adminLoginSchema } from "../validators/admin-auth.validator";
import {
  providerIdParamsSchema,
  providerListQuerySchema,
  providerReviewSchema,
} from "../validators/admin-provider.validator";

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
