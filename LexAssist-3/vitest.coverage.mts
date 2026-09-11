import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Coverage gate (G4): in-process unit coverage.
 * API integration tests spawn a separate Node process (not V8-instrumented here).
 * Broader module confidence is G2/G3 + G11 mutation.
 */
export default defineConfig({
  test: {
    root: path.resolve(__dirname),
    include: [
      "tests/api/pool.spec.ts",
      "tests/api/hardening-units.spec.ts",
    ],
    testTimeout: 30_000,
    fileParallelism: false,
    reporters: ["default"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: [
        "artifacts/api-server/src/lexassist/pool-config.ts",
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
      },
    },
  },
});
