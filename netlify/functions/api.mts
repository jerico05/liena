import { withLambda } from "@netlify/aws-lambda-compat";
import type { Context, Config } from "@netlify/functions";
import serverless from "serverless-http";

let netlifyHandler:
  | ((request: Request, context: Context) => Promise<Response>)
  | undefined;

export default async (request: Request, context: Context): Promise<Response> => {
  const databaseUrl = Netlify.env.get("NETLIFY_DB_URL");
  if (!databaseUrl) {
    throw new Error("Netlify Database is not configured for this deployment.");
  }

  const origin = new URL(request.url).origin;
  process.env.DATABASE_URL = databaseUrl;
  process.env.NODE_ENV = "production";
  process.env.APP_URL ??= origin;
  process.env.CORS_ORIGIN ??= origin;

  if (!netlifyHandler) {
    const { app } = await import("../../src/app");
    netlifyHandler = withLambda(serverless(app));
  }

  return netlifyHandler(request, context);
};

export const config: Config = { path: ["/api/*", "/health"] };
