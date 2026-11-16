import { withLambda } from "@netlify/aws-lambda-compat";
import type { Context, Config } from "@netlify/functions";
import serverless from "serverless-http";

let netlifyHandler:
  | ((request: Request, context: Context) => Promise<Response>)
  | undefined;

async function bootstrapHandler() {
  const { createApp } = await import("./liena-app");
  return withLambda(serverless(createApp()));
}

export default async (request: Request, context: Context): Promise<Response> => {
  const databaseUrl = Netlify.env.get("DATABASE_URL");
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured for this deployment.");
  }

  const origin = new URL(request.url).origin;
  const corsOrigin = Netlify.env.get("CORS_ORIGIN");
  process.env.DATABASE_URL = databaseUrl;
  process.env.NODE_ENV ??= "production";
  process.env.APP_URL ??= Netlify.env.get("PUBLIC_API_URL") ?? origin;
  process.env.PUBLIC_API_URL ??= process.env.APP_URL;
  process.env.CORS_ORIGIN ??= corsOrigin ?? origin;
  process.env.TRUST_PROXY_HOPS ??= "1";
  // Admin sur un autre domaine Netlify : cookies cross-site → SameSite=None (obligatoire).
  const cookieSameSite = Netlify.env.get("COOKIE_SAME_SITE");
  if (cookieSameSite) {
    process.env.COOKIE_SAME_SITE = cookieSameSite;
  } else if (corsOrigin && new URL(corsOrigin).origin !== origin) {
    process.env.COOKIE_SAME_SITE = "none";
  } else {
    process.env.COOKIE_SAME_SITE ??= "lax";
  }

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