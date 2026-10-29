import { prisma } from "../../lib/prisma";

export async function cleanupExpiredAdminAuthRecords(): Promise<void> {
  const now = new Date();
  await prisma.$transaction([
    prisma.adminSession.deleteMany({ where: { expiresAt: { lte: now } } }),
    prisma.adminInvitation.deleteMany({ where: { expiresAt: { lte: now } } }),
    prisma.adminPasswordReset.deleteMany({
      where: { OR: [{ expiresAt: { lte: now } }, { usedAt: { not: null } }] },
    }),
  ]);
}
