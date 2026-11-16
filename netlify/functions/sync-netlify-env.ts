/** Copie les variables Netlify vers `process.env` avant le chargement de `apps/api`. */

import { normalizePemKey } from "../../apps/api/src/config/normalize-pem";

function normalizePublicUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

const NETLIFY_ENV_KEYS = [
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "NODE_ENV",
  "APP_URL",
  "PUBLIC_API_URL",
  "CORS_ORIGIN",
  "TRUST_PROXY_HOPS",
  "COOKIE_SAME_SITE",
  "ADMIN_USERNAME",
  "ADMIN_PASSWORD",
  "YERIA_BASE_URL",
  "YERIA_APP_ID",
  "YERIA_SERVICE_ID",
  "YERIA_DEV_KEY_ID",
  "YERIA_SERVICE_PRIVATE_KEY_PATH",
  "YERIA_SERVICE_PUBLIC_KEY_PATH",
  "SERVICE_ED25519_PRIVATE_KEY",
  "SERVICE_ED25519_PUBLIC_KEY",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
] as const;

export function syncNetlifyEnv(origin: string, corsOrigin: string | undefined): void {
  for (const key of NETLIFY_ENV_KEYS) {
    const value = Netlify.env.get(key);
    if (value) process.env[key] = value;
  }

  process.env.NODE_ENV ??= "production";
  process.env.TRUST_PROXY_HOPS ??= "1";

  const publicUrl = Netlify.env.get("PUBLIC_API_URL") ?? Netlify.env.get("APP_URL") ?? origin;
  process.env.PUBLIC_API_URL = normalizePublicUrl(publicUrl);
  process.env.APP_URL = normalizePublicUrl(process.env.APP_URL ?? publicUrl);

  if (corsOrigin) process.env.CORS_ORIGIN = new URL(corsOrigin).origin;

  const privateKey = Netlify.env.get("SERVICE_ED25519_PRIVATE_KEY");
  if (privateKey) process.env.SERVICE_ED25519_PRIVATE_KEY = normalizePemKey(privateKey);

  const publicKey = Netlify.env.get("SERVICE_ED25519_PUBLIC_KEY");
  if (publicKey) process.env.SERVICE_ED25519_PUBLIC_KEY = normalizePemKey(publicKey);

  const cookieSameSite = Netlify.env.get("COOKIE_SAME_SITE");
  if (cookieSameSite) {
    process.env.COOKIE_SAME_SITE = cookieSameSite;
  } else if (corsOrigin && new URL(corsOrigin).origin !== origin) {
    process.env.COOKIE_SAME_SITE = "none";
  }
}