import { describe, it, expect } from "vitest";
import { apiFetch, login, json } from "../helpers/api.js";
import { SEED_USERS } from "../helpers/env.js";
import { withTestDb } from "../helpers/db.js";

describe("sessions", () => {
  it("login sets an HttpOnly cookie and /me works without Authorization", async () => {
    const session = await login();
    expect(session.cookie).toMatch(/lexassist\.sid=/);
    const loginRes = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: SEED_USERS.admin.username,
        password: SEED_USERS.admin.password,
      }),
    });
    const setCookie = (loginRes.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.()
      || [loginRes.headers.get("set-cookie") || ""];
    expect(setCookie.join(";")).toMatch(/HttpOnly/i);

    const me = await apiFetch("/api/auth/me", { cookie: session.cookie });
    expect(me.status).toBe(200);
    const body = await json(me);
    expect(body.authenticated).toBe(true);
    expect(body.username).toBe("admin");
    expect(body.displayName).toBeTruthy();
    expect(me.headers.get("authorization")).toBeNull();
  });

  it("UA change invalidates the session", async () => {
    const session = await login(SEED_USERS.admin.username, SEED_USERS.admin.password, {
      "User-Agent": "LexAssistTest/1.0",
    });
    const ok = await apiFetch("/api/auth/me", {
      cookie: session.cookie,
      headers: { "User-Agent": "LexAssistTest/1.0" },
    });
    expect(ok.status).toBe(200);

    const bad = await apiFetch("/api/auth/me", {
      cookie: session.cookie,
      headers: { "User-Agent": "LexAssistTest/2.0" },
    });
    expect(bad.status).toBe(401);
  });

  it("IP change succeeds and is audited", async () => {
    const ua = "LexAssistTest/ip-change";
    const session = await login(SEED_USERS.admin.username, SEED_USERS.admin.password, {
      "User-Agent": ua,
      "X-Forwarded-For": "203.0.113.10",
    });
    const me = await apiFetch("/api/auth/me", {
      cookie: session.cookie,
      headers: {
        "User-Agent": ua,
        "X-Forwarded-For": "203.0.113.99",
      },
    });
    expect(me.status).toBe(200);

    const logs = await withTestDb(async (c) =>
      c.query(
        "SELECT action, details FROM audit_logs WHERE action = 'IP_CHANGE' ORDER BY id DESC LIMIT 5",
      ),
    );
    expect(logs.rows.some((r) => String(r.details || "").includes("203.0.113.99"))).toBe(true);
  });

  it("logout then /me is 401", async () => {
    const session = await login();
    const out = await apiFetch("/api/auth/logout", {
      method: "POST",
      cookie: session.cookie,
    });
    expect(out.status).toBe(200);
    const me = await apiFetch("/api/auth/me", { cookie: session.cookie });
    expect(me.status).toBe(401);
  });

  it("matters list works with cookie only (no Authorization bearer)", async () => {
    const session = await login();
    const res = await apiFetch("/api/matters", { cookie: session.cookie });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(Array.isArray(body)).toBe(true);
  });
});
