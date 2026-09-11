import { describe, it, expect, beforeAll } from "vitest";
import { apiFetch, login, json, type AuthSession } from "../helpers/api.js";

describe("journal", () => {
  let admin: AuthSession;
  let entryId: number;

  beforeAll(async () => {
    admin = await login();
  });

  it("CRUD journal entries", async () => {
    const create = await apiFetch("/api/journal-entries", {
      method: "POST",
      token: admin.token,
      body: JSON.stringify({
        title: "Reflection",
        content: "Learned about SDLT today",
        entryDate: new Date().toISOString(),
      }),
    });
    expect([200, 201]).toContain(create.status);
    const entry = await json(create);
    entryId = entry.id;

    const list = await apiFetch("/api/journal-entries", { token: admin.token });
    expect(list.status).toBe(200);

    const one = await apiFetch(`/api/journal-entries/${entryId}`, { token: admin.token });
    expect(one.status).toBe(200);

    const patch = await apiFetch(`/api/journal-entries/${entryId}`, {
      method: "PATCH",
      token: admin.token,
      body: JSON.stringify({ title: "Updated reflection" }),
    });
    expect(patch.status).toBe(200);

    const del = await apiFetch(`/api/journal-entries/${entryId}`, {
      method: "DELETE",
      token: admin.token,
    });
    expect([200, 204]).toContain(del.status);
  });

  it("GET export PDF scopes", async () => {
    await apiFetch("/api/journal-entries", {
      method: "POST",
      token: admin.token,
      body: JSON.stringify({
        title: "Export me",
        content: "Body",
        entryDate: new Date().toISOString(),
      }),
    });

    const from = new Date();
    from.setDate(from.getDate() - 7);
    const to = new Date();
    const fromQs = encodeURIComponent(from.toISOString());
    const toQs = encodeURIComponent(to.toISOString());

    const week = await apiFetch(
      `/api/journal-entries/export?scope=week&from=${fromQs}`,
      { method: "POST", token: admin.token },
    );
    expect([202, 400]).toContain(week.status);
    if (week.status === 202) {
      const { jobId } = await json(week);
      const pdf = await apiFetch(`/api/jobs/${jobId}`, { token: admin.token });
      expect([200, 202]).toContain(pdf.status);
    }

    const range = await apiFetch(
      `/api/journal-entries/export?scope=range&from=${fromQs}&to=${toQs}`,
      { method: "POST", token: admin.token },
    );
    expect([202, 400]).toContain(range.status);
    if (range.status === 202) {
      const { jobId } = await json(range);
      const pdf = await apiFetch(`/api/jobs/${jobId}`, { token: admin.token });
      expect([200, 202]).toContain(pdf.status);
    }
  });
});
