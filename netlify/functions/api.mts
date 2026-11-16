import { withLambda } from "@netlify/aws-lambda-compat";
import type { Context, Config } from "@netlify/functions";
import serverless from "serverless-http";
import { syncNetlifyEnv } from "./sync-netlify-env";

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
  const corsOrigin = Netlify.env.get("CORS_ORIGIN") ?? undefined;
  syncNetlifyEnv(origin, corsOrigin);
  process.env.DATABASE_URL = databaseUrl;

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
    "/api/v1",
    "/api/v1/*",
    "/providers/*",
  ],
};