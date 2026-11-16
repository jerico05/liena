import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(repositoryRoot, ".env") });

process.env.NODE_ENV ??= "test";
process.env.PORT ??= "3001";
process.env.CORS_ORIGIN ??= "http://localhost:5173";
process.env.APP_URL ??= "http://localhost:5173";
process.env.ADMIN_USERNAME ??= "admin";
process.env.ADMIN_PASSWORD ??= "liena-admin-dev";
