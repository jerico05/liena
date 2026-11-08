import cors from "cors";
import express from "express";
import type { RequestHandler } from "express";
import helmet from "helmet";
import { config } from "./config/env";
import { errorHandler } from "./middlewares/errorHandler";
import { requestIdMiddleware } from "./middlewares/requestId";
import { adminRouter } from "./modules/admin/admin.routes";
import { createUserRouter } from "./modules/user/user.routes";
import { createProviderRequestsRouter, createRequestsRouter } from "./modules/requests/requests.routes";

const adminNoCache: express.RequestHandler = (_request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  next();
};

export function createApp(options: { userAuthenticate?: RequestHandler } = {}) {
  const app = express();

  app.set("trust proxy", config.TRUST_PROXY_HOPS);
  app.disable("x-powered-by");

  app.use(requestIdMiddleware);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(
    cors({
      origin: config.CORS_ORIGIN,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "X-CSRF-Token"],
    }),
  );
  app.use(express.json({ limit: "64kb" }));

  app.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  app.use("/api/v1/admin", adminNoCache, adminRouter);
  app.use("/api/v1/providers/requests", createProviderRequestsRouter(options.userAuthenticate));
  app.use("/api/v1/requests", createRequestsRouter(options.userAuthenticate));
  app.use("/api/v1", createUserRouter(options.userAuthenticate));
  app.use(errorHandler);

  return app;
}
