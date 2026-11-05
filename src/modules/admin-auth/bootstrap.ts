import { UserRole, UserStatus } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { adminLink } from "./email";
import { createOpaqueToken, hashToken } from "./security";

const emailSchema = z.string().trim().email().max(254).transform((value) => value.toLowerCase());

export type BootstrapInvitation = {
  email: string;
  expiresAt: Date;
  setupUrl: string;
};

export class AdminBootstrapService {
  constructor(private readonly database: PrismaClient) {}

  async createInvitation(emailInput: string): Promise<BootstrapInvitation> {
    const parsedEmail = emailSchema.safeParse(emailInput);
    if (!parsedEmail.success) {
      throw new Error("A valid administrator email address is required.");
    }

    const email = parsedEmail.data;
    const token = createOpaqueToken();
    const invitation = await this.database.$transaction(async (transaction) => {
      await transaction.$queryRaw<{ locked: boolean }[]>`
        SELECT true AS locked
        FROM (SELECT pg_advisory_xact_lock(7412031123)) AS advisory_lock
      `;
      await transaction.adminInvitation.updateMany({
        where: {
          role: UserRole.SUPER_ADMIN,
          invitedById: null,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { lte: new Date() },
        },
        data: { revokedAt: new Date() },
      });
      const activeAdminCount = await transaction.user.count({
        where: {
          status: UserStatus.ACTIVE,
          deletedAt: null,
          roles: { hasSome: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
        },
      });
      const pendingBootstrapCount = await transaction.adminInvitation.count({
        where: {
          role: UserRole.SUPER_ADMIN,
          invitedById: null,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      if (activeAdminCount > 0 || pendingBootstrapCount > 0) {
        throw new Error("An administrator already exists or a bootstrap invitation is still active.");
      }

      const user = await transaction.user.findUnique({ where: { email }, select: { id: true } });
      if (user) {
        throw new Error("That e-mail address already belongs to an account; bootstrap requires a new address.");
      }

      const created = await transaction.adminInvitation.create({
        data: {
          email,
          role: UserRole.SUPER_ADMIN,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });
      await transaction.auditLog.create({
        data: {
          action: "admin.bootstrap.invitation_created",
          entityType: "admin_invitation",
          entityId: created.id,
          metadata: { email },
        },
      });
      return created;
    });

    return {
      email: invitation.email,
      expiresAt: invitation.expiresAt,
      setupUrl: adminLink("/setup", token),
    };
  }
}
