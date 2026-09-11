import { describe, it, expect, beforeAll } from "vitest";
import { apiFetch, login, json, createMatter, type AuthSession } from "../helpers/api.js";

describe("knowledge-audit", () => {
  let admin: AuthSession;
  let matter: any;

  beforeAll(async () => {
    admin = await login();
    matter = await createMatter(admin.token);
  });

  it("GET /api/matters/:id/audit-logs", async () => {
    const res = await apiFetch(`/api/matters/${matter.id}/audit-logs`, { token: admin.token });
    expect(res.status).toBe(200);
    expect(Array.isArray(await json(res))).toBe(true);
  });

  it("knowledge-resources list/upload/delete", async () => {
    const list = await apiFetch("/api/knowledge-resources", { token: admin.token });
    expect(list.status).toBe(200);

    const form = new FormData();
    form.append("file", new Blob(["GRACE guidance mock"], { type: "text/plain" }), "grace.txt");

    const upload = await apiFetch("/api/knowledge-resources", {
      method: "POST",
      token: admin.token,
      body: form,
    });
    expect([200, 201]).toContain(upload.status);
    const resource = await json(upload);

    const del = await apiFetch(`/api/knowledge-resources/${resource.id}`, {
      method: "DELETE",
      token: admin.token,
    });
    expect([200, 204]).toContain(del.status);
  });
});
