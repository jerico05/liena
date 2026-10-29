import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { config } from "../config/env";

const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (error) => {
  console.error("Unexpected idle PostgreSQL client error.", error);
});

export const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
  log: config.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
