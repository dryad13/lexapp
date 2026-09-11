import { describe, it, expect } from "vitest";
import { buildPoolConfig } from "../../artifacts/api-server/src/lexassist/pool-config.ts";

describe("pg pool config", () => {
  it("sets max and timeouts without SSL by default", () => {
    const cfg = buildPoolConfig({
      DATABASE_URL: "postgres://lexassist:lexassist@127.0.0.1:5432/lexassist_test",
    } as NodeJS.ProcessEnv);
    expect(cfg.max).toBe(10);
    expect(cfg.idleTimeoutMillis).toBe(30_000);
    expect(cfg.connectionTimeoutMillis).toBe(5_000);
    expect(cfg.ssl).toBeUndefined();
  });

  it("enables TLS 1.3 when DATABASE_SSL=true", () => {
    const cfg = buildPoolConfig({
      DATABASE_URL: "postgres://lexassist:lexassist@127.0.0.1:5432/lexassist_test",
      DATABASE_SSL: "true",
    } as NodeJS.ProcessEnv);
    expect(cfg.ssl).toMatchObject({
      rejectUnauthorized: true,
      minVersion: "TLSv1.3",
    });
  });
});
