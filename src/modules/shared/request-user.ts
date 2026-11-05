import { UserStatus, type UserRole } from "@prisma/client";
import type { Request, RequestHandler } from "express";
import { z } from "zod";
import { config } from "../../config/env";
import { HttpError } from "../../http/errors";
import { prisma } from "../../lib/prisma";

const userIdSchema = z.string().uuid();

export const requireUserAuthentication: RequestHandler = async (request, _response, next) => {
  if (!config.DEV_AUTH_ENABLED || config.NODE_ENV === "production") {
    next(new HttpError(401, "AUTHENTICATION_REQUIRED", "Veuillez vous identifier pour continuer."));
    return;
  }

  const parsedUserId = userIdSchema.safeParse(request.get("x-user-id")?.trim());
  if (!parsedUserId.success) {
    next(new HttpError(401, "AUTHENTICATION_REQUIRED", "Veuillez vous identifier pour continuer."));
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: parsedUserId.data },
      select: { id: true, roles: true, status: true, deletedAt: true },
    });

    if (!user || user.status !== UserStatus.ACTIVE || user.deletedAt !== null) {
      next(new HttpError(401, "AUTHENTICATION_REQUIRED", "Veuillez vous identifier pour continuer."));
      return;
    }

    request.user = { id: user.id, roles: user.roles };
    next();
  } catch (error) {
    next(error);
  }
};

export function requireRequestUserId(request: Request): string {
  const userId = request.user?.id;
  if (!userId) {
    throw new HttpError(401, "AUTHENTICATION_REQUIRED", "Veuillez vous identifier pour continuer.");
  }

  return userId;
}

export function requireUserRole(request: Request, role: UserRole): void {
  if (!request.user?.roles.includes(role)) {
    throw new HttpError(403, "ACCESS_DENIED", "Vous n’êtes pas autorisé à effectuer cette action.");
  }
}
