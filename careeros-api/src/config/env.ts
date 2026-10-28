import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8080),
  LOG_LEVEL: z.string().default("info"),
  MONGODB_URI: z.string().min(1).default("mongodb://127.0.0.1:27017/careeros"),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 bytes (256 bits). Generate one with: openssl rand -base64 48"),
  JWT_ACCESS_EXPIRATION_MS: z.coerce.number().int().positive().default(900000),
  JWT_REFRESH_EXPIRATION_MS: z.coerce.number().int().positive().default(604800000),
  JWT_ISSUER: z.string().default("careeros"),
  CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:5173"),
  AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(60),
  AUTH_TRUSTED_PROXY_CIDRS: z.string().default("127.0.0.1/32,::1/128"),
  GOOGLE_CLIENT_ID: z.string().default(""),
  PRIVACY_POLICY_VERSION: z.string().default("2026-10-26"),
  APP_BUILD_COMMIT: z.string().default("unknown"),
  SERVICE_NAME: z.string().default("careeros-api"),
  SERVICE_VERSION: z.string().default("0.1.0"),
  ADMIN_EMAIL: z.string().default(""),
  ADMIN_PASSWORD: z.string().default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid environment configuration: ${details}`);
}

const raw = parsed.data;

export const env = {
  ...raw,
  isTest: raw.NODE_ENV === "test",
  isProduction: raw.NODE_ENV === "production",
  corsOrigins: raw.CORS_ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  trustedProxies: raw.AUTH_TRUSTED_PROXY_CIDRS.split(",")
    .map((cidr) => cidr.trim())
    .filter(Boolean),
  googleClientId: raw.GOOGLE_CLIENT_ID.trim(),
};

export type Env = typeof env;
