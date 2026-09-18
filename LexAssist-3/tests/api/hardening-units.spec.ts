import { describe, it, expect } from "vitest";
import { buildPoolConfig } from "../../artifacts/api-server/src/lexassist/pool-config.ts";
import { hashUserAgent, cookieOptions, SESSION_COOKIE } from "../../artifacts/api-server/src/lexassist/sessions.ts";

describe("hardening unit helpers (in-process coverage)", () => {
  it("buildPoolConfig defaults and TLS", () => {
    const plain = buildPoolConfig({
      DATABASE_URL: "postgres://u:p@localhost/db",
    } as NodeJS.ProcessEnv);
    expect(plain.max).toBe(10);
    expect(plain.ssl).toBeUndefined();

    const tls = buildPoolConfig({
      DATABASE_URL: "postgres://u:p@localhost/db",
      DATABASE_SSL: "true",
    } as NodeJS.ProcessEnv);
    expect(tls.ssl).toMatchObject({ rejectUnauthorized: false });

    const strict = buildPoolConfig({
      DATABASE_URL: "postgres://u:p@localhost/db",
      DATABASE_SSL: "true",
      DATABASE_SSL_REJECT_UNAUTHORIZED: "true",
    } as NodeJS.ProcessEnv);
    expect(strict.ssl).toMatchObject({ rejectUnauthorized: true });
  });

  it("hashUserAgent is stable and SESSION_COOKIE is set", () => {
    expect(hashUserAgent("Mozilla/5.0")).toBe(hashUserAgent("Mozilla/5.0"));
    expect(hashUserAgent("A")).not.toBe(hashUserAgent("B"));
    expect(SESSION_COOKIE).toBe("lexassist.sid");
  });

  it("cookieOptions are HttpOnly Lax", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";
    const opts = cookieOptions();
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
    expect(opts.secure).toBe(false);
    process.env.NODE_ENV = "production";
    expect(cookieOptions().secure).toBe(true);
    process.env.NODE_ENV = prev;
  });
});
