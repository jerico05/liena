import { Router, type RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import argon2 from "argon2";
import { UserRole, UserStatus } from "@prisma/client";
import { z } from "zod";
import { HttpError } from "../../http/errors";
import { validateBody, validateParams } from "../../http/middleware/validate";
import { prisma } from "../../lib/prisma";
import { adminLink, escapeHtml, sendAdminEmail } from "./email";
import {
  clearAuthCookies,
  constantTimeEqual,
  createOpaqueToken,
  csrfCookieName,
  getRequestAuditContext,
  hashToken,
  readCookie,
  requireAdmin,
  requireSuperAdmin,
  setCsrfCookie,
  setSessionCookie,
  sessionCookieName,
} from "./security";

const adminRoleSchema = z.enum([UserRole.ADMIN, UserRole.SUPER_ADMIN]);
const emailSchema = z.string().trim().email().max(254).transform((email) => email.toLowerCase());
const passwordSchema = z.string().min(12).max(128);
const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(128),
    rememberDevice: z.boolean().default(false),
  })
  .strict();
const inviteSchema = z
  .object({
    email: emailSchema,
    role: adminRoleSchema.default(UserRole.ADMIN),
  })
  .strict();
const acceptInvitationSchema = z
  .object({
    token: z.string().min(32).max(128),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    password: passwordSchema,
  })
  .strict();
const forgotPasswordSchema = z.object({ email: emailSchema }).strict();
const resetPasswordSchema = z
  .object({ token: z.string().min(32).max(128), password: passwordSchema })
  .strict();
const changeRoleSchema = z.object({ role: adminRoleSchema }).strict();
const idParamsSchema = z.object({ id: z.string().uuid() }).strict();
const loginLimiter = createRateLimiter(8, "Trop de tentatives de connexion. Réessayez plus tard.");
const recoveryLimiter = createRateLimiter(4, "Trop de demandes. Réessayez plus tard.");

export const adminAuthRouter = Router();
adminAuthRouter.use((_request, response, next) => {
  response.setHeader("Cache-Control", "no-store");
  next();
});

adminAuthRouter.get("/csrf", async (request, response) => {
  const rawSessionToken = readCookie(request, sessionCookieName);
  const session = rawSessionToken
    ? await prisma.adminSession.findUnique({
        where: { tokenHash: hashToken(rawSessionToken) },
        include: { user: { select: { status: true, deletedAt: true, roles: true } } },
      })
    : null;

  if (
    session &&
    session.expiresAt > new Date() &&
    session.user.status === UserStatus.ACTIVE &&
    session.user.deletedAt === null &&
    session.user.roles.some((role) => role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN)
  ) {
    let csrfToken = readCookie(request, csrfCookieName);
    if (!csrfToken || !constantTimeEqual(hashToken(csrfToken), session.csrfTokenHash)) {
      csrfToken = createOpaqueToken();
      await prisma.adminSession.update({
        where: { id: session.id },
        data: { csrfTokenHash: hashToken(csrfToken) },
      });
    }
    setCsrfCookie(response, csrfToken, session.expiresAt);
    response.status(200).json({ csrfToken });
    return;
  }

  const csrfToken = createOpaqueToken();
  setCsrfCookie(response, csrfToken);
  response.status(200).json({ csrfToken });
});

adminAuthRouter.post("/login", loginLimiter, validateBody(loginSchema), async (request, response) => {
  const { email, password, rememberDevice } = request.body as z.output<typeof loginSchema>;
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      passwordHash: true,
      roles: true,
      status: true,
      deletedAt: true,
    },
  });

  const passwordMatches = user ? await argon2.verify(user.passwordHash, password) : false;
  if (!user) {
    await argon2.hash(password, { type: argon2.argon2id });
  }
  const isAdmin =
    user?.roles.some((role) => role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN) ?? false;

  if (
    !user ||
    !passwordMatches ||
    !isAdmin ||
    user.status !== UserStatus.ACTIVE ||
    user.deletedAt !== null
  ) {
    response.status(401).json({
      error: { code: "INVALID_CREDENTIALS", message: "E-mail ou mot de passe incorrect." },
    });
    return;
  }

  const csrfToken = readCookie(request, csrfCookieName);
  if (!csrfToken) {
    throw new HttpError(403, "CSRF_REJECTED", "Un jeton de sécurité valide est requis.");
  }

  const rawToken = createOpaqueToken();
  const expiresAt = new Date(Date.now() + (rememberDevice ? 30 * 24 : 12) * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.adminSession.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        csrfTokenHash: hashToken(csrfToken),
        expiresAt,
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "admin.auth.login",
        entityType: "admin_session",
        entityId: null,
        ...getRequestAuditContext(request),
      },
    }),
  ]);

  setSessionCookie(response, rawToken, expiresAt, rememberDevice);
  setCsrfCookie(response, csrfToken, rememberDevice ? expiresAt : undefined);
  response.status(200).json({
    data: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
    },
    csrfToken,
  });
});

adminAuthRouter.get("/me", requireAdmin, (request, response) => {
  const admin = response.locals.admin;
  if (!admin) {
    throw new HttpError(401, "AUTHENTICATION_REQUIRED", "Veuillez vous connecter pour continuer.");
  }
  response.status(200).json({
    data: {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      roles: admin.roles,
    },
    csrfToken: readCookie(request, csrfCookieName),
  });
});

adminAuthRouter.post("/logout", requireAdmin, async (request, response) => {
  const admin = response.locals.admin;
  if (admin) {
    await prisma.$transaction([
      prisma.adminSession.deleteMany({ where: { id: admin.sessionId } }),
      prisma.auditLog.create({
        data: {
          actorId: admin.id,
          action: "admin.auth.logout",
          entityType: "admin_session",
          entityId: admin.sessionId,
          ...getRequestAuditContext(request),
        },
      }),
    ]);
  }
  clearAuthCookies(response);
  response.status(200).json({ data: { message: "Déconnexion réussie." } });
});

adminAuthRouter.post(
  "/invitations",
  requireAdmin,
  requireSuperAdmin,
  validateBody(inviteSchema),
  async (request, response) => {
    const admin = response.locals.admin;
    if (!admin) {
      throw new HttpError(401, "AUTHENTICATION_REQUIRED", "Veuillez vous connecter pour continuer.");
    }

    const { email, role } = request.body as z.output<typeof inviteSchema>;
    const token = createOpaqueToken();
    const invitation = await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${email}))`;
      const existingUser = await transaction.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existingUser) {
        throw new HttpError(409, "EMAIL_ALREADY_REGISTERED", "Cette adresse e-mail est déjà utilisée.");
      }
      await transaction.adminInvitation.updateMany({
        where: { email, acceptedAt: null, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      const created = await transaction.adminInvitation.create({
        data: {
          email,
          role,
          tokenHash: hashToken(token),
          invitedById: admin.id,
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: admin.id,
          action: "admin.invitation.created",
          entityType: "admin_invitation",
          entityId: created.id,
          metadata: { email, role },
          ...getRequestAuditContext(request),
        },
      });
      return created;
    });

    const link = adminLink("/setup", token);
    try {
      await sendAdminEmail({
        to: email,
        subject: "Votre invitation à l’espace d’administration Liena",
        text: `Vous avez été invité à rejoindre l'administration Liena. Créez votre accès ici : ${link}\nCe lien expire dans 48 heures.`,
        html: `<p>Vous avez été invité à rejoindre l’administration Liena.</p><p><a href="${escapeHtml(link)}">Créer votre accès</a></p><p>Ce lien expire dans 48 heures.</p>`,
      });
    } catch (error) {
      console.error("Could not send admin invitation.", error);
      await prisma.adminInvitation.update({
        where: { id: invitation.id },
        data: { revokedAt: new Date() },
      });
      throw new HttpError(
        503,
        "EMAIL_DELIVERY_UNAVAILABLE",
        "L’invitation n’a pas pu être envoyée. Vérifiez la configuration e-mail.",
        { cause: error },
      );
    }

    response.status(201).json({
      data: { id: invitation.id, email: invitation.email, role, expiresAt: invitation.expiresAt },
    });
  },
);

adminAuthRouter.get("/invitations", requireAdmin, requireSuperAdmin, async (_request, response) => {
  const invitations = await prisma.adminInvitation.findMany({
    where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, role: true, expiresAt: true, createdAt: true },
  });
  response.status(200).json({ data: invitations });
});

adminAuthRouter.delete(
  "/invitations/:id",
  requireAdmin,
  requireSuperAdmin,
  validateParams(idParamsSchema),
  async (request, response) => {
    const { id } = request.params as z.output<typeof idParamsSchema>;
    const admin = response.locals.admin;
    const invitation = await prisma.adminInvitation.findFirst({
      where: { id, acceptedAt: null, revokedAt: null },
      select: { id: true },
    });
    if (!invitation) {
      throw new HttpError(404, "INVITATION_NOT_FOUND", "L’invitation est introuvable.");
    }

    await prisma.$transaction([
      prisma.adminInvitation.update({ where: { id }, data: { revokedAt: new Date() } }),
      prisma.auditLog.create({
        data: {
          actorId: admin?.id,
          action: "admin.invitation.revoked",
          entityType: "admin_invitation",
          entityId: id,
          ...getRequestAuditContext(request),
        },
      }),
    ]);
    response.status(204).end();
  },
);

adminAuthRouter.post(
  "/invitations/accept",
  validateBody(acceptInvitationSchema),
  async (request, response) => {
    const { token, firstName, lastName, password } =
      request.body as z.output<typeof acceptInvitationSchema>;
    const invitation = await prisma.adminInvitation.findFirst({
      where: {
        tokenHash: hashToken(token),
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!invitation) {
      throw new HttpError(400, "INVITATION_INVALID", "Cette invitation est invalide ou a expiré.");
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM admin_invitations WHERE id = ${invitation.id}::uuid FOR UPDATE`;
      const current = await transaction.adminInvitation.findFirst({
        where: {
          id: invitation.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });
      if (!current) {
        throw new HttpError(400, "INVITATION_INVALID", "Cette invitation est invalide ou a expiré.");
      }

      const user = await transaction.user.create({
        data: {
          email: current.email,
          firstName,
          lastName,
          passwordHash,
          roles: [current.role],
          emailVerifiedAt: new Date(),
        },
      });
      await transaction.adminInvitation.update({
        where: { id: current.id },
        data: { acceptedAt: new Date() },
      });
      await transaction.auditLog.create({
        data: {
          actorId: user.id,
          action: "admin.invitation.accepted",
          entityType: "user",
          entityId: user.id,
          ...getRequestAuditContext(request),
        },
      });
    });

    response.status(201).json({ data: { message: "Compte administrateur créé. Vous pouvez vous connecter." } });
  },
);

adminAuthRouter.post(
  "/password/forgot",
  recoveryLimiter,
  validateBody(forgotPasswordSchema),
  async (request, response) => {
    const { email } = request.body as z.output<typeof forgotPasswordSchema>;
    const user = await prisma.user.findFirst({
      where: {
        email,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        roles: { hasSome: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
      },
      select: { id: true, email: true },
    });

    if (user) {
      const token = createOpaqueToken();
      const reset = await prisma.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`;
        await transaction.adminPasswordReset.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        const created = await transaction.adminPasswordReset.create({
          data: {
            userId: user.id,
            tokenHash: hashToken(token),
            expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          },
        });
        await transaction.auditLog.create({
          data: {
            actorId: user.id,
            action: "admin.password_reset.requested",
            entityType: "admin_password_reset",
            entityId: created.id,
            ...getRequestAuditContext(request),
          },
        });
        return created;
      });

      const link = adminLink("/reset-password", token);
      try {
        await sendAdminEmail({
          to: user.email,
          subject: "Réinitialisation de votre mot de passe Liena",
          text: `Pour choisir un nouveau mot de passe, ouvrez ce lien dans les 30 minutes : ${link}\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.`,
          html: `<p>Une réinitialisation de mot de passe a été demandée.</p><p><a href="${escapeHtml(link)}">Choisir un nouveau mot de passe</a></p><p>Ce lien expire dans 30 minutes. Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.</p>`,
        });
      } catch (error) {
        console.error("Could not send admin password reset email.", error);
        await prisma.adminPasswordReset.update({
          where: { id: reset.id },
          data: { usedAt: new Date() },
        });
      }
    }

    response.status(202).json({
      data: { message: "Si un compte administrateur correspond à cet e-mail, un message a été envoyé." },
    });
  },
);

adminAuthRouter.post(
  "/password/reset",
  recoveryLimiter,
  validateBody(resetPasswordSchema),
  async (request, response) => {
    const { token, password } = request.body as z.output<typeof resetPasswordSchema>;
    const resetCandidate = await prisma.adminPasswordReset.findFirst({
      where: {
        tokenHash: hashToken(token),
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: { select: { roles: true, status: true, deletedAt: true } },
      },
    });
    if (
      !resetCandidate ||
      resetCandidate.user.status !== UserStatus.ACTIVE ||
      resetCandidate.user.deletedAt !== null ||
      !resetCandidate.user.roles.some((role) => role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN)
    ) {
      throw new HttpError(400, "RESET_TOKEN_INVALID", "Ce lien de réinitialisation est invalide ou expiré.");
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

    await prisma.$transaction(async (transaction) => {
      const [reset] = await transaction.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM admin_password_resets
        WHERE token_hash = ${hashToken(token)} AND used_at IS NULL AND expires_at > NOW()
        FOR UPDATE
      `;
      if (!reset) {
        throw new HttpError(400, "RESET_TOKEN_INVALID", "Ce lien de réinitialisation est invalide ou expiré.");
      }

      const record = await transaction.adminPasswordReset.findUnique({
        where: { id: reset.id },
        include: { user: { select: { id: true, roles: true, status: true, deletedAt: true } } },
      });
      if (
        !record ||
        record.user.status !== UserStatus.ACTIVE ||
        record.user.deletedAt !== null ||
        !record.user.roles.some((role) => role === UserRole.ADMIN || role === UserRole.SUPER_ADMIN)
      ) {
        throw new HttpError(400, "RESET_TOKEN_INVALID", "Ce lien de réinitialisation est invalide ou expiré.");
      }

      await transaction.adminPasswordReset.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
      await transaction.adminPasswordReset.updateMany({
        where: { userId: record.user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      await transaction.user.update({
        where: { id: record.user.id },
        data: { passwordHash },
      });
      await transaction.adminSession.deleteMany({ where: { userId: record.user.id } });
      await transaction.auditLog.create({
        data: {
          actorId: record.user.id,
          action: "admin.password_reset.completed",
          entityType: "user",
          entityId: record.user.id,
          ...getRequestAuditContext(request),
        },
      });
    });

    response.status(200).json({ data: { message: "Mot de passe mis à jour. Vous pouvez vous connecter." } });
  },
);

adminAuthRouter.get("/admins", requireAdmin, requireSuperAdmin, async (_request, response) => {
  const admins = await prisma.user.findMany({
    where: {
      status: { not: UserStatus.DELETED },
      deletedAt: null,
      roles: { hasSome: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      roles: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
  response.status(200).json({ data: admins });
});

adminAuthRouter.patch(
  "/admins/:id/role",
  requireAdmin,
  requireSuperAdmin,
  validateParams(idParamsSchema),
  validateBody(changeRoleSchema),
  async (request, response) => {
    const { id } = request.params as z.output<typeof idParamsSchema>;
    const { role } = request.body as z.output<typeof changeRoleSchema>;
    const actor = response.locals.admin;
    if (!actor || actor.id === id) {
      throw new HttpError(400, "SELF_ROLE_CHANGE_FORBIDDEN", "Vous ne pouvez pas modifier votre propre rôle administrateur.");
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(7412031123)`;
      const target = await transaction.user.findUnique({
        where: { id },
        select: { id: true, roles: true, status: true, deletedAt: true },
      });
      if (
        !target ||
        target.deletedAt !== null ||
        target.status !== UserStatus.ACTIVE ||
        !target.roles.some((value) => value === UserRole.ADMIN || value === UserRole.SUPER_ADMIN)
      ) {
        throw new HttpError(404, "ADMIN_NOT_FOUND", "L’administrateur est introuvable.");
      }

      if (
        target.roles.includes(UserRole.SUPER_ADMIN) &&
        role !== UserRole.SUPER_ADMIN &&
        (await transaction.user.count({
          where: {
            id: { not: id },
            status: UserStatus.ACTIVE,
            deletedAt: null,
            roles: { has: UserRole.SUPER_ADMIN },
          },
        })) === 0
      ) {
        throw new HttpError(409, "LAST_SUPER_ADMIN", "Au moins un super-administrateur actif doit être conservé.");
      }

      const otherRoles = target.roles.filter(
        (value) => value !== UserRole.ADMIN && value !== UserRole.SUPER_ADMIN,
      );
      await transaction.user.update({
        where: { id },
        data: { roles: [...otherRoles, role] },
      });
      await transaction.auditLog.create({
        data: {
          actorId: actor.id,
          action: "admin.role.changed",
          entityType: "user",
          entityId: id,
          metadata: { role },
          ...getRequestAuditContext(request),
        },
      });
    });

    response.status(200).json({ data: { id, role } });
  },
);

adminAuthRouter.delete(
  "/admins/:id",
  requireAdmin,
  requireSuperAdmin,
  validateParams(idParamsSchema),
  async (request, response) => {
    const { id } = request.params as z.output<typeof idParamsSchema>;
    const actor = response.locals.admin;
    if (!actor || actor.id === id) {
      throw new HttpError(400, "SELF_REMOVAL_FORBIDDEN", "Vous ne pouvez pas retirer vos propres accès administrateur.");
    }

    await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(7412031123)`;
      const target = await transaction.user.findUnique({
        where: { id },
        select: { id: true, roles: true, status: true, deletedAt: true },
      });
      if (
        !target ||
        target.deletedAt !== null ||
        !target.roles.some((value) => value === UserRole.ADMIN || value === UserRole.SUPER_ADMIN)
      ) {
        throw new HttpError(404, "ADMIN_NOT_FOUND", "L’administrateur est introuvable.");
      }
      if (
        target.roles.includes(UserRole.SUPER_ADMIN) &&
        target.status === UserStatus.ACTIVE &&
        (await transaction.user.count({
          where: {
            id: { not: id },
            status: UserStatus.ACTIVE,
            deletedAt: null,
            roles: { has: UserRole.SUPER_ADMIN },
          },
        })) === 0
      ) {
        throw new HttpError(409, "LAST_SUPER_ADMIN", "Au moins un super-administrateur actif doit être conservé.");
      }

      await transaction.user.update({
        where: { id },
        data: {
          roles: target.roles.filter(
            (value) => value !== UserRole.ADMIN && value !== UserRole.SUPER_ADMIN,
          ),
        },
      });
      await transaction.adminSession.deleteMany({ where: { userId: id } });
      await transaction.auditLog.create({
        data: {
          actorId: actor.id,
          action: "admin.access.removed",
          entityType: "user",
          entityId: id,
          ...getRequestAuditContext(request),
        },
      });
    });

    response.status(204).end();
  },
);

function createRateLimiter(limit: number, message: string): RequestHandler {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_request, response) => {
      response.status(429).json({
        error: { code: "RATE_LIMITED", message },
        requestId: response.locals.requestId,
      });
    },
  });
}
