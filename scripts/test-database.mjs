import "dotenv/config";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error("Set TEST_DATABASE_URL to a dedicated PostgreSQL test database.");
}

const testUrl = new URL(testDatabaseUrl);
if (testUrl.protocol !== "postgresql:" && testUrl.protocol !== "postgres:") {
  throw new Error("TEST_DATABASE_URL must use the PostgreSQL protocol.");
}

const testDatabaseName = decodeURIComponent(testUrl.pathname.slice(1));
if (!testDatabaseName.toLowerCase().includes("test")) {
  throw new Error("The test database name must contain 'test' as a safety check.");
}

if (process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED) {
  const identity = (url) => {
    const hostname = url.hostname
      .replace(/^\[|\]$/g, "")
      .replace(/-pooler(?=\.)/, "")
      .toLowerCase();
    const normalizedHostname = ["localhost", "127.0.0.1", "::1"].includes(hostname)
      ? "loopback"
      : hostname;
    return `${url.protocol}//${normalizedHostname}:${url.port || "5432"}${decodeURIComponent(url.pathname)}`;
  };

  const applicationDatabaseUrls = [
    process.env.DATABASE_URL,
    process.env.DATABASE_URL_UNPOOLED,
  ].filter(Boolean);

  if (applicationDatabaseUrls.some((url) => identity(testUrl) === identity(new URL(url)))) {
    throw new Error("TEST_DATABASE_URL must not point to the application database.");
  }
}

const env = {
  ...process.env,
  DATABASE_URL: testDatabaseUrl,
  DATABASE_URL_UNPOOLED: testDatabaseUrl,
};
const prismaCli = path.join(projectRoot, "node_modules", "prisma", "build", "index.js");

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(process.execPath, [prismaCli, "migrate", "deploy"]);
run(process.execPath, [prismaCli, "db", "seed"]);
run(process.execPath, [prismaCli, "db", "seed"]);
// Tests d'intégration API : réactiver quand apps/api sera implémentée.
