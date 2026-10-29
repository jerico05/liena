import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request, RequestHandler, Response } from "express";
import { UserRole, UserStatus } from "@prisma/client";
import { config } from "../../config/env";
import { HttpError } from "../../http/errors";
import { prisma } from "../../lib/prisma";

const secureCookies = config.NODE_ENV === "production" || config.COOKIE_SAME_SITE === "none";

export const sessionCookieName = secureCookies
  ? "__Host-liena_admin_session"
  : "liena_admin_session";
export const csrfCookieName = secureCookies ? "__Host-liena_admin_csrf" : "liena_admin_csrf";

export function createOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function setCsrfCookie(response: Response, token: string, expiresAt?: Date): void {
  response.append(
    "Set-Cookie",
    serializeCookie(csrfCookieName, token, {
      path: "/",
      httpOnly: false,
      secure: secureCookies,
      sameSite: config.COOKIE_SAME_SITE,
      ...(expiresAt
        ? { expires: expiresAt }
        : { maxAge: 60 * 60 * 24 }),
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
  response.append(
    "Set-Cookie",
    serializeCookie(sessionCookieName, "", { ...options, httpOnly: true }),
  );
  response.append(
    "Set-Cookie",
    serializeCookie(csrfCookieName, "", { ...options, httpOnly: false }),
  );
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

export function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

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

export const requireAdmin: RequestHandler = async (request, response, next) => {
  try {
    const rawToken = readCookie(request, sessionCookieName);
    if (!rawToken) {
      next(new HttpError(401, "AUTHENTICATION_REQUIRED", "Veuillez vous connecter pour continuer."));
      return;
    }

    const now = new Date();
    const session = await prisma.adminSession.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            roles: true,
            status: true,
            deletedAt: true,
          },
        },
      },
    });

    if (
      !session ||
      session.expiresAt <= now ||
      session.user.status !== UserStatus.ACTIVE ||
      session.user.deletedAt !== null ||
      !session.user.roles.some((role) => role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN)
    ) {
      if (session) {
        await prisma.adminSession.deleteMany({ where: { id: session.id } });
      }
      clearAuthCookies(response);
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

    response.locals.admin = {
      id: session.user.id,
      email: session.user.email,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      roles: session.user.roles,
      sessionId: session.id,
    };

    if (session.lastSeenAt.getTime() < now.getTime() - 10 * 60 * 1000) {
      await prisma.adminSession.update({
        where: { id: session.id },
        data: { lastSeenAt: now },
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const requireSuperAdmin: RequestHandler = (request, response, next) => {
  const admin = response.locals.admin;
  if (!admin || !admin.roles.includes(UserRole.SUPER_ADMIN)) {
    next(new HttpError(403, "INSUFFICIENT_PERMISSIONS", "L’accès super-administrateur est requis."));
    return;
  }
  next();
};

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
