/**
 * Shared test environment constants for LexAssist-3 API + Playwright suites.
 * Prefer Docker compose (port 54329); fall back to local Postgres `lexassist_test`.
 */
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, "../..");

export const TEST_ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ||
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

/** Defaults to 8080 so the existing Vite proxy (`localhost:8080`) works without product changes. */
export const API_PORT = Number(process.env.TEST_API_PORT || 8080);
export const WEB_PORT = Number(process.env.TEST_WEB_PORT || 21561);
export const OPENAI_MOCK_PORT = Number(process.env.TEST_OPENAI_MOCK_PORT || 18081);

export const API_BASE = process.env.TEST_API_BASE || `http://127.0.0.1:${API_PORT}`;
export const WEB_BASE = process.env.TEST_WEB_BASE || `http://127.0.0.1:${WEB_PORT}`;
export const OPENAI_MOCK_BASE =
  process.env.TEST_OPENAI_MOCK_BASE || `http://127.0.0.1:${OPENAI_MOCK_PORT}/v1`;

/** Docker compose default; override with DATABASE_URL if using local Postgres. */
export const DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.TEST_DATABASE_URL ||
  "postgresql://aaz@127.0.0.1:5432/lexassist_test";

export const REDIS_URL =
  process.env.REDIS_URL ||
  process.env.TEST_REDIS_URL ||
  "redis://127.0.0.1:63799";

export const STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_lexassist";

export const SEED_USERS = {
  admin: { username: "admin", password: "admin12", role: "admin" },
  feeEarner: { username: "hasinah.ahmed", password: "Ahmed12", role: "fee_earner" },
  readOnly: { username: "readonly", password: "Readonly12", role: "read_only" },
  zaid: { username: "zaid.khan", password: process.env.AUTH_PASSWORD || "HU51BAN", role: "admin" },
  otherAdmin: { username: "other.admin", password: "Other12", role: "admin" },
  platformAdmin: { username: "platform.admin", password: "PlatformAdmin12", role: "platform_admin" },
} as const;

export function apiEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: "development",
    PORT: String(API_PORT),
    DATABASE_URL,
    REDIS_URL,
    ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
    SESSION_SECRET: process.env.SESSION_SECRET || "test-session-secret",
    APP_ENV: "test",
    STRIPE_WEBHOOK_SECRET,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "sk_test_lexassist",
    STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID || "price_test_lexassist",
    AI_INTEGRATIONS_OPENAI_API_KEY: "test-key",
    AI_INTEGRATIONS_OPENAI_BASE_URL: OPENAI_MOCK_BASE,
    AI_MODEL: "gpt-4o",
    AUTH_PASSWORD: SEED_USERS.zaid.password,
    SEED_DEMO_USERS: "1",
    MFA_REQUIRED_FOR_ADMINS: "0",
    ...extra,
  };
}

export function webEnv(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: "development",
    PORT: String(WEB_PORT),
    ...extra,
  };
}

export function randomSuffix(): string {
  return crypto.randomBytes(4).toString("hex");
}
