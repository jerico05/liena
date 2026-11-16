import "./load-env";
import { z } from "zod";
import { resolveServicePrivateKey, resolveServicePublicKey } from "./yeria-keys";

const optionalTrimmedString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    DATABASE_URL: z
      .string()
      .url()
      .refine((value) => ["postgres:", "postgresql:"].includes(new URL(value).protocol), {
        message: "Must be a PostgreSQL connection URL",
      }),
    CORS_ORIGIN: z
      .string()
      .url()
      .refine((value) => new URL(value).origin === value, "Must be an origin without a path")
      .default("http://localhost:5173"),
    APP_URL: z.string().url().default("http://localhost:5173"),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
    ADMIN_USERNAME: z
      .string()
      .trim()
      .min(3)
      .max(64)
      .regex(/^[A-Za-z0-9._-]+$/, "Use letters, digits, dots, underscores or hyphens"),
    ADMIN_PASSWORD: z.string().min(4).max(128),
    YERIA_BASE_URL: z.string().url().default("https://yeria.app"),
    YERIA_APP_ID: optionalTrimmedString,
    YERIA_SERVICE_ID: optionalTrimmedString,
    YERIA_SERVICE_PRIVATE_KEY_PATH: z.string().trim().min(1).default("service_private.pem"),
    YERIA_SERVICE_PUBLIC_KEY_PATH: z.string().trim().min(1).default("service_public.pem"),
    SERVICE_ED25519_PRIVATE_KEY: optionalTrimmedString,
    SERVICE_ED25519_PUBLIC_KEY: optionalTrimmedString,
    YERIA_DEV_KEY_ID: optionalTrimmedString,
    CLOUDINARY_CLOUD_NAME: optionalTrimmedString,
    CLOUDINARY_API_KEY: optionalTrimmedString,
    CLOUDINARY_API_SECRET: optionalTrimmedString,
  })
  .superRefine((values, context) => {
    if (values.ADMIN_PASSWORD === values.ADMIN_USERNAME) {
      context.addIssue({
        code: "custom",
        path: ["ADMIN_PASSWORD"],
        message: "Must be different from the administrator username",
      });
    }
    if (values.NODE_ENV === "production" && values.ADMIN_PASSWORD.length < 12) {
      context.addIssue({
        code: "custom",
        path: ["ADMIN_PASSWORD"],
        message: "Production administrator passwords must contain at least 12 characters",
      });
    }
    if (values.NODE_ENV === "production") {
      const appUrl = new URL(values.APP_URL);
      if (appUrl.protocol !== "https:") {
        context.addIssue({ code: "custom", path: ["APP_URL"], message: "Production application URLs must use HTTPS" });
      }
      if (new URL(values.CORS_ORIGIN).protocol !== "https:") {
        context.addIssue({ code: "custom", path: ["CORS_ORIGIN"], message: "Production origins must use HTTPS" });
      }
      for (const key of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"] as const) {
        if (!values[key]) {
          context.addIssue({ code: "custom", path: [key], message: "Required in production" });
        }
      }
      if (!values.YERIA_APP_ID) {
        context.addIssue({ code: "custom", path: ["YERIA_APP_ID"], message: "Required in production for Yeria" });
      }
      if (!values.YERIA_SERVICE_ID) {
        context.addIssue({ code: "custom", path: ["YERIA_SERVICE_ID"], message: "Required in production for Yeria" });
      }
    }
  });

export type AppConfig = z.infer<typeof environmentSchema> & {
  servicePrivateKey: string | undefined;
  servicePublicKey: string | undefined;
};

export function parseEnvironment(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const data = result.data;
  const servicePrivateKey = resolveServicePrivateKey({
    inlineKey: data.SERVICE_ED25519_PRIVATE_KEY,
    keyPath: data.YERIA_SERVICE_PRIVATE_KEY_PATH,
  });
  const servicePublicKey = resolveServicePublicKey({
    inlineKey: data.SERVICE_ED25519_PUBLIC_KEY,
    keyPath: data.YERIA_SERVICE_PUBLIC_KEY_PATH,
  });
  if (data.NODE_ENV === "production" && !servicePrivateKey) {
    throw new Error(
      "Production requires SERVICE_ED25519_PRIVATE_KEY on Netlify (PEM files are not deployed).",
    );
  }
  return Object.freeze({
    ...data,
    servicePrivateKey,
    servicePublicKey,
  });
}

export const config = parseEnvironment();
