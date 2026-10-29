import { app } from "./app";
import { config } from "./config/env";
import { disconnectDatabase, prisma } from "./lib/prisma";
import { cleanupExpiredAdminAuthRecords } from "./modules/admin-auth/cleanup";

async function startServer(): Promise<void> {
  await prisma.$connect();
  await cleanupExpiredAdminAuthRecords().catch((error: unknown) => {
    console.error("Expired administrator authentication records could not be cleaned up.", error);
  });

  const server = app.listen(config.PORT, () => {
    console.info(`Liena API listening on port ${config.PORT} (${config.NODE_ENV}).`);
  });

  const cleanupTimer = setInterval(() => {
    void cleanupExpiredAdminAuthRecords().catch((error: unknown) => {
      console.error("Expired administrator authentication records could not be cleaned up.", error);
    });
  }, 24 * 60 * 60 * 1000);
  cleanupTimer.unref();

  let shuttingDown = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    clearInterval(cleanupTimer);
    console.info(`Received ${signal}; shutting down the Liena API.`);

    server.close((error) => {
      if (error) {
        console.error("HTTP server shutdown failed.", error);
        process.exitCode = 1;
      }

      void disconnectDatabase()
        .catch((disconnectError: unknown) => {
          console.error("Database shutdown failed.", disconnectError);
          process.exitCode = 1;
        })
        .finally(() => {
          if (error) {
            process.exitCode = 1;
          }
        });
    });
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

void startServer().catch(async (error: unknown) => {
  console.error("Liena API startup failed.", error);
  try {
    await disconnectDatabase();
  } catch (disconnectError) {
    console.error("Database cleanup after startup failure failed.", disconnectError);
  }
  process.exitCode = 1;
});
