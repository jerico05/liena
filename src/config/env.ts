import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
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
  EMAIL_FROM: z.string().email().default("onboarding@resend.dev"),
  RESEND_API_KEY: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).optional(),
  ),
  ADMIN_BOOTSTRAP_TOKEN: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(32).optional(),
  ),
  COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
}).superRefine((values, context) => {
  const appUrl = new URL(values.APP_URL);
  if (!["http:", "https:"].includes(appUrl.protocol) || appUrl.origin !== values.APP_URL) {
    context.addIssue({
      code: "custom",
      path: ["APP_URL"],
      message: "Must be an HTTP(S) origin without a path",
    });
  }
  if (values.NODE_ENV === "production") {
    if (appUrl.protocol !== "https:") {
      context.addIssue({
        code: "custom",
        path: ["APP_URL"],
        message: "Production application URLs must use HTTPS",
      });
    }
    if (new URL(values.CORS_ORIGIN).protocol !== "https:") {
      context.addIssue({
        code: "custom",
        path: ["CORS_ORIGIN"],
        message: "Production origins must use HTTPS",
      });
    }
  }
});

export type AppConfig = z.infer<typeof environmentSchema>;

export function parseEnvironment(environment: NodeJS.ProcessEnv): AppConfig {
  const result = environmentSchema.safeParse(environment);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  return Object.freeze(result.data);
}

export const config = parseEnvironment(process.env);
