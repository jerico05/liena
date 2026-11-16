import { withLambda } from "@netlify/aws-lambda-compat";
import type { Context, Config } from "@netlify/functions";
import serverless from "serverless-http";

let netlifyHandler:
  | ((request: Request, context: Context) => Promise<Response>)
  | undefined;

async function bootstrapHandler() {
  let createApp: () => import("express").Express;
  // Charger le source en premier pour que esbuild inclue Yeria/sanitize-html au build Lambda.
  // dist/app.js garde des require() vers node_modules (htmlparser2 ESM → crash sur Netlify).
  try {
    ({ createApp } = await import("../../apps/api/src/app"));
  } catch {
    ({ createApp } = await import("../../apps/api/dist/app.js"));
  }
  return withLambda(serverless(createApp()));
}

export default async (request: Request, context: Context): Promise<Response> => {
  const databaseUrl = Netlify.env.get("DATABASE_URL");
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured for this deployment.");
  }

  const origin = new URL(request.url).origin;
  process.env.DATABASE_URL = databaseUrl;
  process.env.NODE_ENV ??= "production";
  process.env.APP_URL ??= Netlify.env.get("PUBLIC_API_URL") ?? origin;
  process.env.PUBLIC_API_URL ??= process.env.APP_URL;
  process.env.CORS_ORIGIN ??= Netlify.env.get("CORS_ORIGIN") ?? origin;
  process.env.TRUST_PROXY_HOPS ??= "1";

  if (!netlifyHandler) {
    netlifyHandler = await bootstrapHandler();
  }

  return netlifyHandler(request, context);
};

/** Déclaration explicite : la fonction doit recevoir les routes Yeria (pas seulement /api/v1). */
export const config: Config = {
  path: [
    "/health",
    "/",
    "/home",
    "/map",
    "/search",
    "/become-provider",
    "/browse",
    "/browse/*",
    "/screens",
    "/screens/*",
    "/assets/*",
    "/api/v1/*",
    "/providers/*",
  ],
};