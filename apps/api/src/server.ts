import { createApp } from "./app";
import { config } from "./config/env";
import { disconnectDatabase } from "./repositories/prisma.client";

const app = createApp();

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
