import { describe, it, expect, beforeAll } from "vitest";
import { apiFetch, login, json, createMatter, type AuthSession } from "../helpers/api.js";

describe("draft-emails", () => {
  let admin: AuthSession;
  let matter: any;

  beforeAll(async () => {
    admin = await login();
    matter = await createMatter(admin.token);
  });

  it("CRUD draft emails", async () => {
    const create = await apiFetch("/api/draft-emails", {
      method: "POST",
      token: admin.token,
      body: JSON.stringify({
        matterId: matter.id,
        recipient: "client@example.com",
        subject: "Hello",
        body: "Test body",
      }),
    });
    expect([200, 201]).toContain(create.status);
    const email = await json(create);

    const list = await apiFetch("/api/draft-emails", { token: admin.token });
    expect(list.status).toBe(200);

    const patch = await apiFetch(`/api/draft-emails/${email.id}`, {
      method: "PATCH",
      token: admin.token,
      body: JSON.stringify({ subject: "Updated subject" }),
    });
    expect(patch.status).toBe(200);
    expect((await json(patch)).subject).toBe("Updated subject");

    const del = await apiFetch(`/api/draft-emails/${email.id}`, {
      method: "DELETE",
      token: admin.token,
    });
    expect([200, 204]).toContain(del.status);
  });
});
