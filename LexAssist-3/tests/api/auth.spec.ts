import { describe, it, expect } from "vitest";
import { apiFetch, login, json } from "../helpers/api.js";
import { SEED_USERS } from "../helpers/env.js";

describe("auth", () => {
  it("GET /api/healthz is public", async () => {
    const res = await apiFetch("/api/healthz");
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.status).toBe("ok");
  });

  it("POST /api/auth/login succeeds for seed admin", async () => {
    const session = await login();
    expect(session.token).toBeTruthy();
    expect(session.username).toBe(SEED_USERS.admin.username);
    expect(session.role).toBe("admin");
    expect(session.displayName).toBeTruthy();
  });

  it("POST /api/auth/login rejects bad password", async () => {
    const res = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "admin", password: "wrong" }),
    });
    expect(res.status).toBe(401);
  });

  it("GET /api/auth/me returns session fields including displayName", async () => {
    const session = await login();
    const res = await apiFetch("/api/auth/me", { token: session.token });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.authenticated).toBe(true);
    expect(body.username).toBe("admin");
    expect(body.role).toBe("admin");
    expect(body).toHaveProperty("displayName");
    expect(body.displayName).toBeTruthy();
  });

  it("GET /api/auth/me returns authenticated session", async () => {
    const session = await login();
    const res = await apiFetch("/api/auth/me", { token: session.token });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.authenticated).toBe(true);
    expect(body.username).toBe("admin");
    expect(body.role).toBe("admin");
  });

  it("protected routes return 401 without token", async () => {
    const res = await apiFetch("/api/matters");
    expect(res.status).toBe(401);
  });

  it("POST /api/auth/logout invalidates token", async () => {
    const session = await login();
    const out = await apiFetch("/api/auth/logout", {
      method: "POST",
      token: session.token,
    });
    expect(out.status).toBe(200);
    const me = await apiFetch("/api/auth/me", { token: session.token });
    expect(me.status).toBe(401);
  });
});
