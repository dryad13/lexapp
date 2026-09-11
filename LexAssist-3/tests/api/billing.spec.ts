import { describe, it, expect, beforeAll } from "vitest";
import { apiFetch, login, json, type AuthSession } from "../helpers/api.js";
import { SEED_USERS } from "../helpers/env.js";

describe("billing checkout", () => {
  let admin: AuthSession;
  let feeEarner: AuthSession;

  beforeAll(async () => {
    admin = await login();
    feeEarner = await login(SEED_USERS.feeEarner.username, SEED_USERS.feeEarner.password);
  });

  it("unauthenticated checkout is 401", async () => {
    const res = await apiFetch("/api/billing/checkout", { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("non-admin checkout is 403", async () => {
    const res = await apiFetch("/api/billing/checkout", {
      method: "POST",
      cookie: feeEarner.cookie,
    });
    expect(res.status).toBe(403);
  });

  it("admin checkout returns a stub session URL in test", async () => {
    const res = await apiFetch("/api/billing/checkout", {
      method: "POST",
      cookie: admin.cookie,
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.id).toMatch(/^cs_test_/);
    expect(body.url).toMatch(/billing=success/);
  });

  it("admin billing status is readable", async () => {
    const res = await apiFetch("/api/billing/status", { cookie: admin.cookie });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.organisationId).toBe(admin.organisationId);
    expect(typeof body.subscriptionPlan).toBe("string");
  });
});
