import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool, type PoolConfig } from "pg";
import { config } from "./env";

const isNeonHost = /@.*\.neon\.tech/i.test(config.DATABASE_URL);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Neon : limiter les connexions simultanées vers le pooler (évite les timeouts au réveil). */
const poolMax = Number(process.env.DATABASE_POOL_MAX ?? (isNeonHost ? 5 : 10));

const poolConfig: PoolConfig = {
  connectionString: config.DATABASE_URL,
  max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 5,
  idleTimeoutMillis: isNeonHost ? 20_000 : 30_000,
  // Cold start Neon + latence Windows → 20 s insuffisant pour plusieurs requêtes parallèles.
  connectionTimeoutMillis:
    Number(process.env.DATABASE_CONNECT_TIMEOUT_MS) ||
    (config.NODE_ENV === "production" ? 15_000 : 60_000),
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
  // Recycler avant que Neon / le pooler ne coupe des connexions idle.
  maxLifetimeSeconds: isNeonHost ? 120 : 0,
  allowExitOnIdle: false,
};

const pool = new Pool(poolConfig);

pool.on("error", (error) => {
  console.error("Unexpected idle PostgreSQL client error.", error);
});

const basePrisma = new PrismaClient({
  adapter: new PrismaPg(pool),
  log: config.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

export function isTransientDatabaseError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const message =
    error instanceof Error
      ? `${error.message} ${(error as Error & { cause?: Error }).cause?.message ?? ""}`
      : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes("connection terminated") ||
    normalized.includes("timeout exceeded when trying to connect") ||
    normalized.includes("connection timeout") ||
    normalized.includes("econnreset") ||
    normalized.includes("econnrefused") ||
    normalized.includes("connection terminated unexpectedly")
  );
}

async function withConnectionRetry<T>(operation: () => Promise<T>): Promise<T> {
  const maxAttempts = isNeonHost ? 3 : 2;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientDatabaseError(error) || attempt === maxAttempts) throw error;
      await sleep(400 * attempt);
    }
  }
  throw lastError;
}

export const prisma = basePrisma.$extends({
  query: {
    $allOperations({ args, query }) {
      return withConnectionRetry(() => query(args));
    },
  },
});

/** Réveille Neon et valide le pool avant le trafic HTTP. */
export async function warmDatabasePool(): Promise<void> {
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await pool.query("SELECT 1");
      if (attempt > 1) {
        console.log(`Database pool ready (attempt ${attempt}).`);
      }
      return;
    } catch (error) {
      const isLast = attempt === maxAttempts;
      console.warn(
        isLast ? "Database warmup failed." : `Database warmup attempt ${attempt} failed, retrying…`,
        error instanceof Error ? error.message : error,
      );
      if (isLast) throw error;
      await sleep(1_500 * attempt);
    }
  }
}

export async function disconnectDatabase(): Promise<void> {
  await basePrisma.$disconnect();
  await pool.end();
}
