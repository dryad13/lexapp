import { describe, it, expect } from "vitest";
import { apiFetch, login, json } from "../helpers/api.js";

describe("redis-required health", () => {
  it("GET /api/healthz reports status ok and redis boolean", async () => {
    const res = await apiFetch("/api/healthz");
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.status).toBe("ok");
    expect(typeof body.redis).toBe("boolean");
  });

  it("when REQUIRE_REDIS=1, healthz.redis is true", async () => {
    if (process.env.REQUIRE_REDIS !== "1" && process.env.CI !== "true") {
      // Soft skip locally when Redis is optional
      return;
    }
    const res = await apiFetch("/api/healthz");
    const body = await json(res);
    expect(body.redis).toBe(true);
  });

  it("cookie session round-trip works after login", async () => {
    const session = await login();
    const me1 = await apiFetch("/api/auth/me", { cookie: session.cookie });
    expect(me1.status).toBe(200);
    const me2 = await apiFetch("/api/auth/me", { cookie: session.cookie });
    expect(me2.status).toBe(200);
    expect((await json(me2)).username).toBe(session.username);
  });
});
