import path from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

const repositoryRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.join(repositoryRoot, ".env") });

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
    ADMIN_MOCK_DATA: z.preprocess((value) => {
      if (value === undefined || value === "") return undefined;
      if (value === "true" || value === "1") return true;
      if (value === "false" || value === "0") return false;
      return value;
    }, z.boolean().optional()),
    YERIA_BASE_URL: z.string().url().default("https://yeria.app"),
    YERIA_APP_ID: z.string().trim().min(1).optional(),
    YERIA_SERVICE_ID: z.string().trim().min(1).optional(),
    SERVICE_ED25519_PRIVATE_KEY: z.string().trim().min(1).optional(),
    YERIA_DEV_KEY_ID: z.string().trim().min(1).optional(),
  })
  .superRefine((values, context) => {
    if (values.NODE_ENV === "production" && values.ADMIN_MOCK_DATA) {
      context.addIssue({
        code: "custom",
        path: ["ADMIN_MOCK_DATA"],
        message: "Mock admin data must stay disabled in production",
      });
    }
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
    }
  });

export type AppConfig = z.infer<typeof environmentSchema> & {
  ADMIN_MOCK_DATA: boolean;
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
  return Object.freeze({
    ...data,
    ADMIN_MOCK_DATA: data.ADMIN_MOCK_DATA ?? data.NODE_ENV === "development",
  });
}

export const config = parseEnvironment();
