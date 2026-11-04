import type { Request, Response } from "express";
import { config } from "../config/env";
import { deleteAdminSession } from "./admin-session.store";
import { digestEqual } from "../utils/security-tokens";

const secureCookies = config.NODE_ENV === "production" || config.COOKIE_SAME_SITE === "none";

export const sessionCookieName = secureCookies
  ? "__Host-liena_admin_session"
  : "liena_admin_session";
export const csrfCookieName = secureCookies ? "__Host-liena_admin_csrf" : "liena_admin_csrf";

export function credentialsMatch(username: string, password: string): boolean {
  return digestEqual(username, config.ADMIN_USERNAME) && digestEqual(password, config.ADMIN_PASSWORD);
}

export function setCsrfCookie(response: Response, token: string, expiresAt?: Date): void {
  response.append(
    "Set-Cookie",
    serializeCookie(csrfCookieName, token, {
      path: "/",
      httpOnly: false,
      secure: secureCookies,
      sameSite: config.COOKIE_SAME_SITE,
      ...(expiresAt ? { expires: expiresAt } : { maxAge: 60 * 60 * 24 }),
    }),
  );
}

export function setSessionCookie(
  response: Response,
  token: string,
  expiresAt: Date,
  persistent: boolean,
): void {
  response.append(
    "Set-Cookie",
    serializeCookie(sessionCookieName, token, {
      path: "/",
      httpOnly: true,
      secure: secureCookies,
      sameSite: config.COOKIE_SAME_SITE,
      ...(persistent ? { expires: expiresAt } : {}),
    }),
  );
}

export function clearAuthCookies(response: Response): void {
  const options = {
    path: "/",
    secure: secureCookies,
    sameSite: config.COOKIE_SAME_SITE,
    expires: new Date(0),
    maxAge: 0,
  };
  response.append("Set-Cookie", serializeCookie(sessionCookieName, "", { ...options, httpOnly: true }));
  response.append("Set-Cookie", serializeCookie(csrfCookieName, "", { ...options, httpOnly: false }));
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  for (const pair of header.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0 || pair.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(pair.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function destroyAdminSession(sessionId: string): void {
  deleteAdminSession(sessionId);
}

export function getRequestAuditContext(request: Request): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  return {
    ipAddress: request.ip || null,
    userAgent: request.get("user-agent")?.slice(0, 500) ?? null,
  };
}

function serializeCookie(
  name: string,
  value: string,
  options: {
    path: string;
    httpOnly: boolean;
    secure: boolean;
    sameSite: "lax" | "strict" | "none";
    maxAge?: number;
    expires?: Date;
  },
): string {
  const attributes = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path}`,
    `SameSite=${options.sameSite[0].toUpperCase()}${options.sameSite.slice(1)}`,
  ];
  if (options.httpOnly) attributes.push("HttpOnly");
  if (options.secure) attributes.push("Secure");
  if (options.maxAge !== undefined) attributes.push(`Max-Age=${options.maxAge}`);
  if (options.expires) attributes.push(`Expires=${options.expires.toUTCString()}`);
  return attributes.join("; ");
}
