import { describe, it, expect, beforeAll } from "vitest";
import { apiFetch, login, json, type AuthSession } from "../helpers/api.js";

describe("permissions", () => {
  let admin: AuthSession;

  beforeAll(async () => {
    admin = await login();
  });

  it("GET /api/me/permissions returns role matrix flags", async () => {
    const res = await apiFetch("/api/me/permissions", { token: admin.token });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.role).toBe("admin");
    expect(body.permissions?.canManageUsers).toBe(true);
  });
});
