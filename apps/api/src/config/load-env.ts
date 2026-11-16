import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

const apiRoot = path.resolve(__dirname, "../..");
const repositoryRoot = path.resolve(apiRoot, "../..");

/** Local : `apps/api/.env` puis `.env` racine (legacy). */
export function loadLocalEnvFiles(): void {
  const legacyRootEnv = path.join(repositoryRoot, ".env");
  const apiEnv = path.join(apiRoot, ".env");
  const apiLocal = path.join(apiRoot, ".env.local");

  if (fs.existsSync(legacyRootEnv)) dotenv.config({ path: legacyRootEnv });
  if (fs.existsSync(apiEnv)) dotenv.config({ path: apiEnv, override: true });
  if (fs.existsSync(apiLocal)) dotenv.config({ path: apiLocal, override: true });
}

loadLocalEnvFiles();