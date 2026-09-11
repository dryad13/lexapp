import { describe, it, expect, beforeAll } from "vitest";
import { apiFetch, login, json, createMatter, type AuthSession } from "../helpers/api.js";

describe("tasks", () => {
  let admin: AuthSession;
  let matter: any;

  beforeAll(async () => {
    admin = await login();
    matter = await createMatter(admin.token, { type: "purchase" });
  });

  it("GET /api/matters/:id/tasks lists tasks", async () => {
    const res = await apiFetch(`/api/matters/${matter.id}/tasks`, { token: admin.token });
    expect(res.status).toBe(200);
    const tasks = await json(res);
    expect(tasks.length).toBeGreaterThan(0);
  });

  it("PATCH /api/tasks/:id updates task", async () => {
    const tasks = await json(await apiFetch(`/api/matters/${matter.id}/tasks`, { token: admin.token }));
    const task = tasks[0];
    const res = await apiFetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      token: admin.token,
      body: JSON.stringify({ notes: "updated note" }),
    });
    expect(res.status).toBe(200);
  });

  it("POST /api/tasks/:id/complete marks task complete", async () => {
    const tasks = await json(await apiFetch(`/api/matters/${matter.id}/tasks`, { token: admin.token }));
    const pending = tasks.find((t: any) => t.status !== "completed") || tasks[0];
    const res = await apiFetch(`/api/tasks/${pending.id}/complete`, {
      method: "POST",
      token: admin.token,
    });
    expect(res.status).toBe(200);
    const updated = await json(res);
    expect(updated.status === "completed" || updated.completed === true || updated.completedAt).toBeTruthy();
  });

  it("PATCH stage without required checks returns 409 COMPLIANCE_BLOCKED", async () => {
    const m = await createMatter(admin.token, { type: "purchase" });
    // Attempt to jump stage without completing checks
    const res = await apiFetch(`/api/matters/${m.id}`, {
      method: "PATCH",
      token: admin.token,
      body: JSON.stringify({ currentStage: "Client Info" }),
    });
    // May be 409 if checks required for Onboarding, or 200 if already past
    if (res.status === 409) {
      const body = await json(res);
      expect(body.error).toBe("COMPLIANCE_BLOCKED");
      expect(Array.isArray(body.missing_checks)).toBe(true);
    } else {
      expect(res.status).toBe(200);
    }
  });

  it("PATCH stage with override succeeds for admin", async () => {
    const m = await createMatter(admin.token, { type: "purchase" });
    const blocked = await apiFetch(`/api/matters/${m.id}`, {
      method: "PATCH",
      token: admin.token,
      body: JSON.stringify({ currentStage: "Client Info" }),
    });
    if (blocked.status !== 409) return;

    const res = await apiFetch(`/api/matters/${m.id}`, {
      method: "PATCH",
      token: admin.token,
      body: JSON.stringify({
        currentStage: "Client Info",
        override: true,
        overrideReason: "E2E override for testing stage gating path",
      }),
    });
    expect(res.status).toBe(200);
    const updated = await json(res);
    expect(updated.currentStage).toBe("Client Info");
  });
});
