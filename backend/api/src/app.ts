import path from "node:path";
import cors from "cors";
import express from "express";
import type { RequestHandler } from "express";
import helmet from "helmet";
import { config } from "./config/env";
import { authenticate } from "./middlewares/authenticate";
import { errorHandler } from "./middlewares/errorHandler";
import { requestIdMiddleware } from "./middlewares/requestId";
import { adminRouter } from "./modules/admin/admin.routes";
import { createCategoryRouter } from "./modules/categories/category.routes";
import { createClientRouter } from "./modules/clients/client.routes";
import { createProviderRouter } from "./modules/providers/provider.routes";
import { createServiceRequestRouter } from "./modules/service-requests/service-request.routes";
import * as yeriaActionController from "./modules/yeria/yeria-action.controller";
import * as yeriaController from "./modules/yeria/yeria.controller";
import { browseTrailScreenAction } from "./modules/yeria/yeria-trail-action";
import { rootYeriaNestedAction, rootYeriaSingleAction } from "./modules/yeria/yeria-root-actions";
import { createYeriaRouter } from "./modules/yeria/yeria.routes";

const ROOT_HOME_ACTIONS = ["browse", "search", "become-provider", "map"] as const;
const apiAssetsPath = path.resolve(__dirname, "../assets");

const adminNoCache: express.RequestHandler = (_request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  next();
};

export function createApp(options: { userAuthenticate?: RequestHandler } = {}) {
  const userAuthenticate = options.userAuthenticate ?? authenticate;
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
      allowedHeaders: ["Authorization", "Content-Type", "X-CSRF-Token"],
    }),
  );
  app.use(express.json({ limit: "64kb" }));

  app.get("/health", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  const serveApiAssets = express.static(apiAssetsPath, {
    maxAge: config.NODE_ENV === "production" ? "7d" : 0,
    setHeaders(response) {
      response.setHeader("Cache-Control", config.NODE_ENV === "production" ? "public, max-age=604800" : "no-store");
    },
  });

  app.use("/assets", serveApiAssets);
  // Vues sous `/screens/*` résolvent `assets/...` vers `/screens/assets/...`
  app.use("/screens/assets", serveApiAssets);

  // Yeria appelle souvent GET / (écran d'entrée vide ou « / ») : il faut une vue signée, pas une redirection HTML.
  app.get("/", yeriaController.home);
  app.get("/home", yeriaController.home);
  for (const actionCode of ROOT_HOME_ACTIONS) {
    app.get(`/${actionCode}`, (request, response, next) => {
      (request.params as { actionCode: string }).actionCode = actionCode;
      void yeriaActionController.homeScreenAction(request, response, next);
    });
  }
  app.get("/browse/:actionCode", yeriaActionController.categoriesScreenAction);
  app.post("/browse/:actionCode", yeriaActionController.categoriesScreenAction);
  app.get("/browse/{*trail}", browseTrailScreenAction);
  app.post("/browse/{*trail}", browseTrailScreenAction);
  app.get("/search/:actionCode", yeriaActionController.providerResultsScreenAction);
  app.post("/search", yeriaController.searchSubmit);
  app.post("/map", yeriaController.mapSubmit);
  app.post("/become-provider", userAuthenticate, ...yeriaController.providerOnboardingSubmit);
  // Yeria : parfois `GET /cat-1` à la racine (URL courante = base du service)
  app.get("/:actionCode/{*trail}", rootYeriaNestedAction);
  app.post("/:actionCode/{*trail}", rootYeriaNestedAction);
  app.get("/:actionCode", rootYeriaSingleAction);
  app.post("/:actionCode", rootYeriaSingleAction);
  app.post("/:viewId", yeriaActionController.createPostViewAction(userAuthenticate));

  app.use("/screens", createYeriaRouter(userAuthenticate));
  app.use("/api/v1/admin", adminNoCache, adminRouter);
  app.use("/api/v1/providers/requests", createServiceRequestRouter(userAuthenticate));
  app.use("/api/v1/requests", createClientRouter(userAuthenticate));
  app.use("/api/v1", createCategoryRouter());
  app.use("/api/v1", createProviderRouter(userAuthenticate));
  app.use(errorHandler);

  return app;
}
