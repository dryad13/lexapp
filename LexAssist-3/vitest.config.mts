import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    root: path.resolve(__dirname),
    include: ["tests/api/**/*.spec.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    sequence: { concurrent: false },
    globalSetup: ["tests/helpers/global-setup.ts"],
    reporters: ["default"],
  },
});
