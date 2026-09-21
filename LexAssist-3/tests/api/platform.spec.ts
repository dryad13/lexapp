import { describe, it, expect, beforeAll } from "vitest";
import { apiFetch, login, json, type AuthSession } from "../helpers/api.js";
import { SEED_USERS, randomSuffix } from "../helpers/env.js";

describe("platform admin console", () => {
  let firmAdmin: AuthSession;
  let platform: AuthSession;

  beforeAll(async () => {
    firmAdmin = await login();
    platform = await login(SEED_USERS.platformAdmin.username, SEED_USERS.platformAdmin.password);
    expect(platform.role).toBe("platform_admin");
  });

  it("firm admin cannot access platform APIs", async () => {
    const res = await apiFetch("/api/platform/summary", { token: firmAdmin.token });
    expect(res.status).toBe(403);
  });

  it("platform admin can load summary and org list without PII fields", async () => {
    const summaryRes = await apiFetch("/api/platform/summary", { token: platform.token });
    expect(summaryRes.status).toBe(200);
    const summary = await json(summaryRes);
    expect(summary).toHaveProperty("organisationCount");
    expect(summary).toHaveProperty("userCount");
    expect(summary).toHaveProperty("matterCount");
    expect(JSON.stringify(summary)).not.toMatch(/clientName|propertyAddress|clientEmail/i);

    const listRes = await apiFetch("/api/platform/organisations", { token: platform.token });
    expect(listRes.status).toBe(200);
    const list = await json(listRes);
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
    expect(JSON.stringify(list)).not.toMatch(/clientName|propertyAddress|clientEmail/i);
    for (const row of list) {
      expect(row).toHaveProperty("userCount");
      expect(row).toHaveProperty("matterCount");
      expect(row).toHaveProperty("lastLoginAt");
      expect(row).toHaveProperty("lastMatterAt");
      expect(row).not.toHaveProperty("isPlatform");
    }
  });

  it("firm admin cannot access platform audit logs", async () => {
    const res = await apiFetch("/api/platform/audit-logs", { token: firmAdmin.token });
    expect(res.status).toBe(403);
  });

  it("platform admin cannot call firm matter APIs", async () => {
    const res = await apiFetch("/api/matters", { token: platform.token });
    expect(res.status).toBe(403);
  });

  it("platform admin can create an organisation", async () => {
    const suffix = randomSuffix();
    const res = await apiFetch("/api/platform/organisations", {
      method: "POST",
      token: platform.token,
      body: JSON.stringify({
        name: `Platform Spec Firm ${suffix}`,
        adminUser: `psadmin_${suffix}`,
        adminPass: "PlatformSpec12ab",
        adminDisplay: "PS Admin",
        plan: "basic",
      }),
    });
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.organisation.id).toBeTruthy();
    expect(body.admin.username).toBe(`psadmin_${suffix}`);

    const firmLogin = await login(`psadmin_${suffix}`, "PlatformSpec12ab");
    expect(firmLogin.organisationId).toBe(body.organisation.id);
    expect(firmLogin.role).toBe("admin");

    const audits = await json(
      await apiFetch("/api/platform/audit-logs?action=ORG_CREATED&limit=20", { token: platform.token }),
    );
    expect(audits.some((a: any) => a.action === "ORG_CREATED" && a.organisationId === body.organisation.id)).toBe(
      true,
    );
  });

  it("reset admin password forces change and audits", async () => {
    const suffix = randomSuffix();
    const created = await json(
      await apiFetch("/api/platform/organisations", {
        method: "POST",
        token: platform.token,
        body: JSON.stringify({
          name: `Reset Spec Firm ${suffix}`,
          adminUser: `rsadmin_${suffix}`,
          adminPass: "ResetSpecOld12",
          plan: "basic",
        }),
      }),
    );
    const orgId = created.organisation.id;
    const oldPass = "ResetSpecOld12";

    const resetRes = await apiFetch(`/api/platform/organisations/${orgId}/reset-admin-password`, {
      method: "POST",
      token: platform.token,
    });
    expect(resetRes.status).toBe(200);
    const reset = await json(resetRes);
    expect(reset.adminUsername).toBe(`rsadmin_${suffix}`);
    expect(reset.temporaryPassword).toBeTruthy();
    expect(String(reset.temporaryPassword).length).toBeGreaterThanOrEqual(12);

    const oldLogin = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: `rsadmin_${suffix}`, password: oldPass }),
    });
    expect(oldLogin.status).toBe(401);

    const tempLogin = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: `rsadmin_${suffix}`,
        password: reset.temporaryPassword,
      }),
    });
    expect(tempLogin.status).toBe(200);
    const tempBody = await json(tempLogin);
    expect(tempBody.mustChangePasswordRequired).toBe(true);
    expect(tempBody.token).toBeTruthy();

    const blocked = await apiFetch("/api/matters", { token: tempBody.token });
    expect(blocked.status).toBe(403);

    const changed = await apiFetch("/api/auth/change-password", {
      method: "POST",
      token: tempBody.token,
      body: JSON.stringify({
        currentPassword: reset.temporaryPassword,
        newPassword: "ResetSpecNew12ab",
      }),
    });
    expect(changed.status).toBe(200);
    const full = await json(changed);
    expect(full.token).toBeTruthy();
    expect(full.mustChangePasswordRequired).toBeUndefined();

    const mattersOk = await apiFetch("/api/matters", { token: full.token });
    expect(mattersOk.status).toBe(200);

    const audits = await json(
      await apiFetch("/api/platform/audit-logs?action=ADMIN_PASSWORD_RESET&limit=20", {
        token: platform.token,
      }),
    );
    expect(audits.some((a: any) => a.organisationId === orgId)).toBe(true);

    const list = await json(await apiFetch("/api/platform/organisations", { token: platform.token }));
    const row = list.find((o: any) => o.id === orgId);
    expect(row.lastLoginAt).toBeTruthy();
  });

  it("suspended organisation blocks login", async () => {
    const suffix = randomSuffix();
    const created = await json(
      await apiFetch("/api/platform/organisations", {
        method: "POST",
        token: platform.token,
        body: JSON.stringify({
          name: `Suspend Spec Firm ${suffix}`,
          adminUser: `susadmin_${suffix}`,
          adminPass: "SuspendSpec12ab",
          plan: "basic",
        }),
      }),
    );
    const orgId = created.organisation.id;

    const suspend = await apiFetch(`/api/platform/organisations/${orgId}`, {
      method: "PATCH",
      token: platform.token,
      body: JSON.stringify({ status: "suspended" }),
    });
    expect(suspend.status).toBe(200);
    expect((await json(suspend)).status).toBe("suspended");

    const loginRes = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: `susadmin_${suffix}`,
        password: "SuspendSpec12ab",
      }),
    });
    expect(loginRes.status).toBe(403);
    const err = await json(loginRes);
    expect(err.code).toBe("ORG_SUSPENDED");

    const activate = await apiFetch(`/api/platform/organisations/${orgId}`, {
      method: "PATCH",
      token: platform.token,
      body: JSON.stringify({ status: "active" }),
    });
    expect(activate.status).toBe(200);

    const again = await login(`susadmin_${suffix}`, "SuspendSpec12ab");
    expect(again.organisationId).toBe(orgId);
  });

  it("firm admin cannot assign platform_admin role", async () => {
    const res = await apiFetch("/api/users", {
      method: "POST",
      token: firmAdmin.token,
      body: JSON.stringify({
        username: `evil_${randomSuffix()}`,
        password: "EvilPlatform12",
        displayName: "Evil",
        role: "platform_admin",
      }),
    });
    expect(res.status).toBe(400);
  });
});
