import { describe, it, expect, beforeAll } from "vitest";
import { apiFetch, login, json, createMatter, type AuthSession } from "../helpers/api.js";
import { SEED_USERS, randomSuffix } from "../helpers/env.js";

describe("matters", () => {
  let admin: AuthSession;

  beforeAll(async () => {
    admin = await login();
  });

  it("GET /api/matters lists matters for org", async () => {
    const res = await apiFetch("/api/matters", { token: admin.token });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(Array.isArray(body)).toBe(true);
  });

  it("POST /api/matters creates purchase matter with tasks + compliance", async () => {
    const matter = await createMatter(admin.token, { type: "purchase" });
    expect(matter.id).toBeTruthy();
    expect(matter.type).toBe("purchase");
    expect(Array.isArray(matter.tasks)).toBe(true);
    expect(matter.tasks.length).toBeGreaterThan(0);

    const detail = await json(await apiFetch(`/api/matters/${matter.id}`, { token: admin.token }));
    expect(detail.clientName).toContain("Client");

    const compliance = await json(
      await apiFetch(`/api/matters/${matter.id}/compliance`, { token: admin.token }),
    );
    expect(Array.isArray(compliance)).toBe(true);
    expect(compliance.length).toBeGreaterThan(0);
  });

  it("POST /api/matters creates immigration matter with 8 tasks + compliance", async () => {
    const matter = await createMatter(admin.token, {
      type: "visa_application",
      title: `Visa ${randomSuffix()}`,
      propertyAddress: "1 Immigration Lane",
    });
    expect(matter.type).toBe("visa_application");
    expect(matter.tasks.length).toBe(8);
    expect(matter.tasks[0].stage).toBe("Onboarding / Induction");
    expect(matter.tasks[7].stage).toBe("Appeal / JR / AR (if applicable)");
    expect(matter.currentStage).toBe("Onboarding / Induction");

    const compliance = await json(
      await apiFetch(`/api/matters/${matter.id}/compliance`, { token: admin.token }),
    );
    expect(Array.isArray(compliance)).toBe(true);
    expect(compliance.length).toBeGreaterThan(0);
  });

  it("immigration induction blocks progression until AML check is complete", async () => {
    const matter = await createMatter(admin.token, {
      type: "settlement",
      title: `Settlement ${randomSuffix()}`,
    });

    const blocked = await apiFetch(`/api/matters/${matter.id}`, {
      method: "PATCH",
      token: admin.token,
      body: JSON.stringify({ currentStage: "Eligibility and Assessment" }),
    });
    expect(blocked.status).toBe(409);
    const blockedBody = await json(blocked);
    expect(blockedBody.error).toBe("COMPLIANCE_BLOCKED");
    expect(blockedBody.missing_checks.some((c: any) => /AML/i.test(c.ruleName))).toBe(true);

    const compliance = await json(
      await apiFetch(`/api/matters/${matter.id}/compliance`, { token: admin.token }),
    );
    const aml = compliance.find((c: any) => /AML/i.test(c.ruleName));
    expect(aml).toBeTruthy();
    const complete = await apiFetch(
      `/api/matters/${matter.id}/compliance/${aml.id}/complete`,
      { method: "POST", token: admin.token },
    );
    expect(complete.status).toBe(200);

    const ok = await apiFetch(`/api/matters/${matter.id}`, {
      method: "PATCH",
      token: admin.token,
      body: JSON.stringify({ currentStage: "Eligibility and Assessment" }),
    });
    expect(ok.status).toBe(200);
    expect((await json(ok)).currentStage).toBe("Eligibility and Assessment");
  });

  it("immigration stages after induction are not gated by incomplete checks", async () => {
    const matter = await createMatter(admin.token, {
      type: "visa_application",
      title: `Visa ${randomSuffix()}`,
    });
    // Complete AML so we can leave induction
    const compliance = await json(
      await apiFetch(`/api/matters/${matter.id}/compliance`, { token: admin.token }),
    );
    const aml = compliance.find((c: any) => /AML/i.test(c.ruleName));
    await apiFetch(`/api/matters/${matter.id}/compliance/${aml.id}/complete`, {
      method: "POST",
      token: admin.token,
    });
    await apiFetch(`/api/matters/${matter.id}`, {
      method: "PATCH",
      token: admin.token,
      body: JSON.stringify({ currentStage: "Eligibility and Assessment" }),
    });

    const res = await apiFetch(`/api/matters/${matter.id}`, {
      method: "PATCH",
      token: admin.token,
      body: JSON.stringify({ currentStage: "Advice on Viable Routes" }),
    });
    expect(res.status).toBe(200);
  });

  it("PATCH /api/matters/:id updates fields", async () => {
    const matter = await createMatter(admin.token);
    const res = await apiFetch(`/api/matters/${matter.id}`, {
      method: "PATCH",
      token: admin.token,
      body: JSON.stringify({ title: "Updated Title", notes: "note" }),
    });
    expect(res.status).toBe(200);
    const updated = await json(res);
    expect(updated.title).toBe("Updated Title");
  });

  it("DELETE /api/matters/:id removes matter", async () => {
    const matter = await createMatter(admin.token);
    const res = await apiFetch(`/api/matters/${matter.id}`, {
      method: "DELETE",
      token: admin.token,
    });
    expect([200, 204]).toContain(res.status);
    const get = await apiFetch(`/api/matters/${matter.id}`, { token: admin.token });
    expect(get.status).toBe(404);
  });

  it("department gating blocks conveyancing user from immigration types", async () => {
    const username = `conv_only_${randomSuffix()}`;
    const createUser = await apiFetch("/api/users", {
      method: "POST",
      token: admin.token,
      body: JSON.stringify({
        username,
        password: "ConvOnly12",
        displayName: "Conveyancing Only",
        role: "fee_earner",
        department: "conveyancing",
      }),
    });
    expect(createUser.status).toBe(201);

    const fe = await login(username, "ConvOnly12");
    const res = await apiFetch("/api/matters", {
      method: "POST",
      token: fe.token,
      body: JSON.stringify({
        title: "Blocked visa",
        type: "visa_application",
        clientName: "X",
        propertyAddress: "Y",
        currentStage: "Onboarding / Induction",
        status: "active",
      }),
    });
    expect(res.status).toBe(403);
  });

  it("read_only cannot create or mutate matters", async () => {
    let ro: AuthSession;
    try {
      ro = await login(SEED_USERS.readOnly.username, SEED_USERS.readOnly.password);
    } catch {
      const created = await apiFetch("/api/users", {
        method: "POST",
        token: admin.token,
        body: JSON.stringify({
          username: SEED_USERS.readOnly.username,
          password: SEED_USERS.readOnly.password,
          displayName: "Read Only",
          role: "read_only",
          department: "both",
        }),
      });
      expect([201, 409]).toContain(created.status);
      ro = await login(SEED_USERS.readOnly.username, SEED_USERS.readOnly.password);
    }
    expect(ro.role).toBe("read_only");

    const createRes = await apiFetch("/api/matters", {
      method: "POST",
      token: ro.token,
      body: JSON.stringify({
        title: "RO blocked",
        type: "visa_application",
        clientName: "X",
        propertyAddress: "Y",
        currentStage: "Onboarding / Induction",
        status: "active",
      }),
    });
    expect(createRes.status).toBe(403);

    const matter = await createMatter(admin.token, { type: "asylum" });
    const patchRes = await apiFetch(`/api/matters/${matter.id}`, {
      method: "PATCH",
      token: ro.token,
      body: JSON.stringify({ title: "Nope" }),
    });
    expect(patchRes.status).toBe(403);

    const getRes = await apiFetch(`/api/matters/${matter.id}`, { token: ro.token });
    expect(getRes.status).toBe(200);
  });
});
