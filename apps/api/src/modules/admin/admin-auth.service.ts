import type { Request, Response } from "express";
import { config } from "../../config/env";
import { HttpError } from "../../middlewares/errorHandler";
import { createOpaqueToken, hashToken } from "./security-tokens";
import { createAdminSession, replaceSessionCsrf } from "./admin-session.store";
import {
  clearAuthCookies,
  credentialsMatch,
  destroyAdminSession,
  readCookie,
  sessionCookieName,
  setCsrfCookie,
  setSessionCookie,
  csrfCookieName,
} from "./admin-auth.security";
import type { AdminLoginInput } from "./admin-auth.validator";
import { findAdminSession } from "./admin-session.store";

const sessionTtlMs = 12 * 60 * 60 * 1000;
const persistentSessionTtlMs = 30 * 24 * 60 * 60 * 1000;

export function issueCsrfToken(response: Response): string {
  const token = createOpaqueToken();
  setCsrfCookie(response, token);
  return token;
}

export function refreshCsrfForSession(request: Request, response: Response): string | undefined {
  const rawToken = readCookie(request, sessionCookieName);
  const session = rawToken ? findAdminSession(rawToken) : undefined;
  if (!session) return undefined;
  const token = createOpaqueToken();
  replaceSessionCsrf(session.id, hashToken(token));
  setCsrfCookie(response, token, session.expiresAt);
  return token;
}

export function loginAdmin(request: Request, response: Response, input: AdminLoginInput): string {
  if (!credentialsMatch(input.username, input.password)) {
    throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid administrator credentials.");
  }

  const csrfToken = readCookie(request, csrfCookieName) ?? createOpaqueToken();
  if (!readCookie(request, csrfCookieName)) setCsrfCookie(response, csrfToken);

  const persistent = input.rememberDevice;
  const expiresAt = new Date(Date.now() + (persistent ? persistentSessionTtlMs : sessionTtlMs));
  const { rawToken } = createAdminSession({
    csrfTokenHash: hashToken(csrfToken),
    expiresAt,
    persistent,
  });

  setSessionCookie(response, rawToken, expiresAt, persistent);
  setCsrfCookie(response, csrfToken, expiresAt);
  return csrfToken;
}

export function logoutAdmin(request: Request, response: Response): void {
  const rawToken = readCookie(request, sessionCookieName);
  const session = rawToken ? findAdminSession(rawToken) : undefined;
  if (session) destroyAdminSession(session.id);
  clearAuthCookies(response);
}

export function currentAdminUsername(): string {
  return config.ADMIN_USERNAME;
}
