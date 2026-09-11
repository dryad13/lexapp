import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const ROOT = process.cwd();

const API_PORT = Number(process.env.TEST_API_PORT || 8080);
const WEB_PORT = Number(process.env.TEST_WEB_PORT || 21561);
const OPENAI_MOCK_PORT = Number(process.env.TEST_OPENAI_MOCK_PORT || 18081);
const WEB_BASE = process.env.TEST_WEB_BASE || `http://127.0.0.1:${WEB_PORT}`;
const OPENAI_MOCK_BASE =
  process.env.TEST_OPENAI_MOCK_BASE || `http://127.0.0.1:${OPENAI_MOCK_PORT}/v1`;
const DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.TEST_DATABASE_URL ||
  "postgresql://aaz@127.0.0.1:5432/lexassist_test";
const TEST_ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ||
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || "HU51BAN";

export default defineConfig({
  testDir: path.join(ROOT, "tests/e2e"),
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: {
    baseURL: WEB_BASE,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm exec tsx tests/helpers/openai-mock-cli.ts",
      url: `http://127.0.0.1:${OPENAI_MOCK_PORT}/healthz`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      cwd: ROOT,
    },
    {
      command: `node --import tsx ${path.join(ROOT, "artifacts/api-server/src/lexassist/index.ts")}`,
      url: `http://127.0.0.1:${API_PORT}/api/healthz`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      cwd: path.join(ROOT, "artifacts/api-server"),
      env: {
        ...process.env,
        NODE_ENV: "development",
        APP_ENV: "test",
        PORT: String(API_PORT),
        DATABASE_URL,
        REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:63799",
        ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
        SESSION_SECRET: process.env.SESSION_SECRET || "test-session-secret",
        STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_lexassist",
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "sk_test_lexassist",
        STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID || "price_test_lexassist",
        AI_INTEGRATIONS_OPENAI_API_KEY: "test-key",
        AI_INTEGRATIONS_OPENAI_BASE_URL: OPENAI_MOCK_BASE,
        AI_MODEL: "gpt-4o",
        AUTH_PASSWORD,
        PATH: `${process.env.HOME}/.local/bin:/usr/local/bin:/opt/homebrew/bin:${process.env.PATH || ""}`,
      },
    },
    {
      command: "pnpm --filter @workspace/lexassist run dev",
      url: WEB_BASE,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      cwd: ROOT,
      env: {
        ...process.env,
        NODE_ENV: "development",
        PORT: String(WEB_PORT),
        API_PROXY_TARGET: `http://127.0.0.1:${API_PORT}`,
        PATH: `${process.env.HOME}/.local/bin:/usr/local/bin:/opt/homebrew/bin:${process.env.PATH || ""}`,
      },
    },
  ],
});
