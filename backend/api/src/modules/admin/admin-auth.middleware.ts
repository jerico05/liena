import type { RequestHandler } from "express";
import { config } from "../../config/env";
import { HttpError } from "../../middlewares/errorHandler";
import { findAdminSession, touchAdminSession } from "./admin-session.store";
import {
  clearAuthCookies,
  csrfCookieName,
  readCookie,
  sessionCookieName,
} from "./admin-auth.security";
import { constantTimeEqual, hashToken } from "./security-tokens";

export const requireCsrf: RequestHandler = (request, _response, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    next();
    return;
  }
  if (request.get("origin") !== config.CORS_ORIGIN) {
    next(new HttpError(403, "CSRF_REJECTED", "L’origine de cette requête n’est pas autorisée."));
    return;
  }
  const cookieToken = readCookie(request, csrfCookieName);
  const headerToken = request.get("x-csrf-token");
  if (!cookieToken || !headerToken || !constantTimeEqual(cookieToken, headerToken)) {
    next(new HttpError(403, "CSRF_REJECTED", "Un jeton de sécurité valide est requis."));
    return;
  }
  next();
};

export const requireAdmin: RequestHandler = (request, response, next) => {
  const rawToken = readCookie(request, sessionCookieName);
  const session = rawToken ? findAdminSession(rawToken) : undefined;
  if (!session) {
    if (rawToken) clearAuthCookies(response);
    next(new HttpError(401, "AUTHENTICATION_REQUIRED", "Veuillez vous connecter pour continuer."));
    return;
  }
  const csrfToken = readCookie(request, csrfCookieName);
  if (
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    (!csrfToken || !constantTimeEqual(hashToken(csrfToken), session.csrfTokenHash))
  ) {
    next(new HttpError(403, "CSRF_REJECTED", "Un jeton de sécurité valide est requis."));
    return;
  }
  touchAdminSession(session);
  response.locals.admin = { username: config.ADMIN_USERNAME, sessionId: session.id };
  next();
};
