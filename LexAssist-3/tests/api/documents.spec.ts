import { describe, it, expect, beforeAll } from "vitest";
import { apiFetch, login, json, createMatter, type AuthSession } from "../helpers/api.js";

describe("documents", () => {
  let admin: AuthSession;
  let matter: any;

  beforeAll(async () => {
    admin = await login();
    matter = await createMatter(admin.token);
  });

  it("GET /api/document-types", async () => {
    const res = await apiFetch("/api/document-types", { token: admin.token });
    expect(res.status).toBe(200);
    const types = await json(res);
    expect(Array.isArray(types) || typeof types === "object").toBe(true);
  });

  it("upload, list, delete document", async () => {
    const form = new FormData();
    form.append(
      "files",
      new Blob(["mock contract content"], { type: "text/plain" }),
      "contract.txt",
    );
    form.append("documentType", "contract");

    const upload = await apiFetch(`/api/matters/${matter.id}/documents`, {
      method: "POST",
      token: admin.token,
      body: form,
    });
    expect([200, 201]).toContain(upload.status);
    const uploaded = await json(upload);
    const docs = Array.isArray(uploaded) ? uploaded : uploaded.documents || [uploaded];
    expect(docs.length).toBeGreaterThan(0);

    const list = await apiFetch(`/api/matters/${matter.id}/documents`, { token: admin.token });
    expect(list.status).toBe(200);

    const id = docs[0].id;
    const del = await apiFetch(`/api/documents/${id}`, {
      method: "DELETE",
      token: admin.token,
    });
    expect([200, 204]).toContain(del.status);
  });
});
