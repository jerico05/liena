import type { RequestHandler } from "express";
import { YeriaPlatformUnreachableError } from "@numerum-tech/yeriasdk";
import { getYeriaApp, yeriaConfig } from "../config/yeria";
import { HttpError } from "./errorHandler";

type VerifiedClaims = { sub: string; aud: string; iss: string; exp: number; iat?: number; kid?: string };
type TokenVerifier = (token: string, audience: string) => Promise<VerifiedClaims>;

/** Authenticate a client or provider request with a Yeria service token. */
export function createAuthenticate(verifyToken: TokenVerifier, audience: string): RequestHandler {
  return async (request, _response, next) => {
    const authorization = request.get("authorization");
    const match = authorization?.match(/^Bearer\s+([^\s]+)$/i);
    if (!match) {
      next(new HttpError(401, "AUTHENTICATION_REQUIRED", "A valid Yeria bearer token is required."));
      return;
    }

    try {
      const claims = await verifyToken(match[1], audience);
      request.user = {
        yeriaSub: claims.sub,
        audience: claims.aud,
        issuer: claims.iss,
        expiresAt: claims.exp,
        issuedAt: claims.iat,
        keyId: claims.kid,
      };
      next();
    } catch (error) {
      if (error instanceof YeriaPlatformUnreachableError) {
        next(new HttpError(503, "YERIA_UNAVAILABLE", "Yeria could not be reached to verify the token."));
        return;
      }
      next(new HttpError(401, "INVALID_YERIA_TOKEN", "The Yeria bearer token is invalid or expired."));
    }
  };
}

export const authenticate: RequestHandler = (request, response, next) => {
  const yeria = getYeriaApp();
  if (!yeria || !yeriaConfig.serviceId) {
    next(new HttpError(503, "YERIA_NOT_CONFIGURED", "Yeria authentication is not configured."));
    return;
  }
  return createAuthenticate(
    (token, audience) => yeria.verifyUserToken(token, audience),
    yeriaConfig.serviceId,
  )(request, response, next);
};
