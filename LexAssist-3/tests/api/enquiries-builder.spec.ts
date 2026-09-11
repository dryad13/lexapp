import { describe, it, expect, beforeAll } from "vitest";
import { apiFetch, login, json, createMatter, type AuthSession } from "../helpers/api.js";

describe("enquiries-builder", () => {
  let admin: AuthSession;
  let matter: any;

  beforeAll(async () => {
    admin = await login();
    matter = await createMatter(admin.token, { type: "purchase" });
  });

  it("GET library and templates", async () => {
    const lib = await apiFetch("/api/enquiries/library", { token: admin.token });
    expect(lib.status).toBe(200);

    const templates = await apiFetch("/api/enquiries/templates", { token: admin.token });
    expect(templates.status).toBe(200);
  });

  it("builder pack CRUD + export + create-task", async () => {
    const create = await apiFetch(`/api/matters/${matter.id}/builder-packs`, {
      method: "POST",
      token: admin.token,
      body: JSON.stringify({
        packType: "custom",
        selectedItemsJson: [
          { category: "Title", question: "Who owns the property?", selected: true },
        ],
      }),
    });
    expect([200, 201]).toContain(create.status);
    const pack = await json(create);

    const list = await apiFetch(`/api/matters/${matter.id}/builder-packs`, { token: admin.token });
    expect(list.status).toBe(200);

    const put = await apiFetch(`/api/builder-packs/${pack.id}`, {
      method: "PUT",
      token: admin.token,
      body: JSON.stringify({
        packType: "custom",
        selectedItemsJson: [
          { category: "Title", question: "Who owns the property?", selected: true },
        ],
      }),
    });
    expect(put.status).toBe(200);

    const exp = await apiFetch(`/api/builder-packs/${pack.id}/export`, {
      method: "POST",
      token: admin.token,
    });
    expect([200, 201]).toContain(exp.status);

    const task = await apiFetch(`/api/builder-packs/${pack.id}/create-task`, {
      method: "POST",
      token: admin.token,
    });
    expect([200, 201]).toContain(task.status);

    const del = await apiFetch(`/api/builder-packs/${pack.id}`, {
      method: "DELETE",
      token: admin.token,
    });
    expect([200, 204]).toContain(del.status);
  });
});
