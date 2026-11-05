import { AdminBootstrapService } from "../src/modules/admin-auth/bootstrap";
import { disconnectDatabase, prisma } from "../src/lib/prisma";

async function bootstrapAdmin(emailInput: string): Promise<void> {
  const service = new AdminBootstrapService(prisma);
  const invitation = await service.createInvitation(emailInput);
  console.info(`Bootstrap invitation for ${invitation.email} (expires ${invitation.expiresAt.toISOString()}):`);
  console.info(invitation.setupUrl);
  console.info("Open this link only on a trusted device. It is shown once and is not stored in plain text.");
}

void bootstrapAdmin(process.argv[2] ?? "")
  .catch((error: unknown) => {
    console.error("Could not create the initial super-administrator.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
