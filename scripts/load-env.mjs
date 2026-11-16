import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiEnvPath = path.join(repositoryRoot, "apps", "api", ".env");
const legacyRootEnvPath = path.join(repositoryRoot, ".env");

if (fs.existsSync(legacyRootEnvPath)) dotenv.config({ path: legacyRootEnvPath });
if (fs.existsSync(apiEnvPath)) dotenv.config({ path: apiEnvPath, override: true });