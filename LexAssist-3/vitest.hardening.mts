import { defineConfig } from "vitest/config";
import path from "node:path";

/** Hardening / production-readiness API specs only. */
export default defineConfig({
  test: {
    root: path.resolve(__dirname),
    include: [
      "tests/api/stripe-webhook.spec.ts",
      "tests/api/billing.spec.ts",
      "tests/api/sessions.spec.ts",
      "tests/api/rate-limit.spec.ts",
      "tests/api/pdf-jobs.spec.ts",
      "tests/api/pool.spec.ts",
      "tests/api/isolation.spec.ts",
      "tests/api/redis-required.spec.ts",
    ],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    sequence: { concurrent: false },
    globalSetup: ["tests/helpers/global-setup.ts"],
    reporters: ["default"],
  },
});
