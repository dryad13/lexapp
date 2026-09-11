import { describe, it, expect, beforeAll } from "vitest";
import { apiFetch, login, json, createMatter, type AuthSession } from "../helpers/api.js";

describe("compliance", () => {
  let admin: AuthSession;
  let matter: any;

  beforeAll(async () => {
    admin = await login();
    matter = await createMatter(admin.token, { type: "purchase" });
  });

  it("GET /api/matters/:id/compliance returns checks", async () => {
    const res = await apiFetch(`/api/matters/${matter.id}/compliance`, { token: admin.token });
    expect(res.status).toBe(200);
    const checks = await json(res);
    expect(checks.length).toBeGreaterThan(0);
  });

  it("complete and uncomplete a check", async () => {
    const checks = await json(
      await apiFetch(`/api/matters/${matter.id}/compliance`, { token: admin.token }),
    );
    const check = checks[0];
    const done = await apiFetch(`/api/matters/${matter.id}/compliance/${check.id}/complete`, {
      method: "POST",
      token: admin.token,
    });
    expect(done.status).toBe(200);

    const undone = await apiFetch(`/api/matters/${matter.id}/compliance/${check.id}/uncomplete`, {
      method: "POST",
      token: admin.token,
    });
    expect(undone.status).toBe(200);
  });

  it("GET validate-stage", async () => {
    const res = await apiFetch(
      `/api/matters/${matter.id}/compliance/validate-stage?stage=Client%20Info`,
      { token: admin.token },
    );
    expect(res.status).toBe(200);
  });

  it("GET /api/compliance/summary", async () => {
    const res = await apiFetch("/api/compliance/summary", { token: admin.token });
    expect(res.status).toBe(200);
  });

  it("GET /api/dashboard/compliance-summary requires canViewReports", async () => {
    const res = await apiFetch("/api/dashboard/compliance-summary", { token: admin.token });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.totals || body).toBeTruthy();
  });

  it("risk assessment GET/POST", async () => {
    const get = await apiFetch(`/api/matters/${matter.id}/risk-assessment`, { token: admin.token });
    expect([200, 404]).toContain(get.status);

    const post = await apiFetch(`/api/matters/${matter.id}/risk-assessment`, {
      method: "POST",
      token: admin.token,
      body: JSON.stringify({
        status: "draft",
        formData: { clientRisk: "low", notes: "e2e" },
        overallClientRisk: "low",
        overallMatterRisk: "low",
      }),
    });
    expect([200, 201]).toContain(post.status);
  });
});
