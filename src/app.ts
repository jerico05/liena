import cors from "cors";
import express from "express";
import helmet from "helmet";
import { config } from "./config/env";
import { errorHandler, HttpError } from "./http/errors";
import { requestIdMiddleware } from "./http/middleware/request-id";
import { categoryRouter } from "./modules/categories/category.routes";
import { docsRouter } from "./modules/docs/docs.routes";
import { healthRouter } from "./modules/health/health.routes";
import { providerRegistrationRouter } from "./modules/provider-registrations/provider-registration.routes";
import { providerRouter } from "./modules/providers/provider.routes";
import { serviceSearchRouter } from "./modules/services/service-search.routes";
import { adminAuthRouter } from "./modules/admin-auth/admin-auth.routes";
import { requireCsrf } from "./modules/admin-auth/security";

export const app = express();

app.disable("x-powered-by");
app.set("trust proxy", config.TRUST_PROXY_HOPS);
app.use(requestIdMiddleware);
app.use(helmet());
app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "1mb" }));

app.use("/health", healthRouter);
app.use("/api-docs", docsRouter);
app.use("/api/v1/categories", categoryRouter);
app.use("/api/v1/services", serviceSearchRouter);
app.use("/api/v1/providers", providerRouter);
app.use("/api/v1/admin/provider-registrations", providerRegistrationRouter);
app.use("/api/v1/admin", requireCsrf, adminAuthRouter);

app.use((_request, _response, next) => {
  next(new HttpError(404, "ROUTE_NOT_FOUND", "The requested route was not found."));
});

app.use(errorHandler);
