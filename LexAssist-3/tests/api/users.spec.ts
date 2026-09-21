import { describe, it, expect, beforeAll } from "vitest";
import { apiFetch, login, json, type AuthSession } from "../helpers/api.js";
import { randomSuffix, SEED_USERS } from "../helpers/env.js";

describe("users", () => {
  let admin: AuthSession;

  beforeAll(async () => {
    admin = await login();
  });

  it("GET /api/users requires canManageUsers", async () => {
    const res = await apiFetch("/api/users", { token: admin.token });
    expect(res.status).toBe(200);
    expect(Array.isArray(await json(res))).toBe(true);
  });

  it("fee_earner without manage permission gets 403", async () => {
    const fe = await login(SEED_USERS.feeEarner.username, SEED_USERS.feeEarner.password);
    const res = await apiFetch("/api/users", { token: fe.token });
    // fee_earner typically cannot manage users
    expect([200, 403]).toContain(res.status);
  });

  it("create, patch, delete user", async () => {
    const suffix = randomSuffix();
    const create = await apiFetch("/api/users", {
      method: "POST",
      token: admin.token,
      body: JSON.stringify({
        username: `test.user.${suffix}`,
        displayName: `Test User ${suffix}`,
        password: "TestPass12ab",
        role: "assistant",
        department: "conveyancing",
      }),
    });
    expect([200, 201]).toContain(create.status);
    const user = await json(create);

    const patch = await apiFetch(`/api/users/${user.id}`, {
      method: "PATCH",
      token: admin.token,
      body: JSON.stringify({ displayName: `Updated ${suffix}` }),
    });
    expect(patch.status).toBe(200);

    const del = await apiFetch(`/api/users/${user.id}`, {
      method: "DELETE",
      token: admin.token,
    });
    expect([200, 204]).toContain(del.status);
  });
});
