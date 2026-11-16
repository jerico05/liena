import { createApp } from "./app";
import { config } from "./config/env";
import { disconnectDatabase, warmDatabasePool } from "./config/database";

const app = createApp();

void (async () => {
  try {
    await warmDatabasePool();
  } catch (error) {
    console.error(
      "Impossible de joindre PostgreSQL au démarrage. Vérifie DATABASE_URL (pooler Neon) et la connectivité réseau.",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }

  const server = app.listen(config.PORT, () => {
    console.log(`Liena API listening on http://localhost:${config.PORT}`);
  });

  async function shutdown(signal: string) {
    console.log(`Received ${signal}. Shutting down…`);
    server.close(async () => {
      await disconnectDatabase().catch(() => undefined);
      process.exit(0);
    });
  }

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
})();

