import { describe, it, expect, beforeAll } from "vitest";
import { apiFetch, login, json, createMatter, type AuthSession } from "../helpers/api.js";

describe("reminders", () => {
  let admin: AuthSession;
  let matter: any;

  beforeAll(async () => {
    admin = await login();
    matter = await createMatter(admin.token);
  });

  it("CRUD reminders", async () => {
    const create = await apiFetch("/api/reminders", {
      method: "POST",
      token: admin.token,
      body: JSON.stringify({
        matterId: matter.id,
        title: "Chase searches",
        dueDate: new Date(Date.now() + 86400000).toISOString(),
      }),
    });
    expect([200, 201]).toContain(create.status);
    const reminder = await json(create);
    expect(reminder.id).toBeTruthy();

    const list = await apiFetch("/api/reminders", { token: admin.token });
    expect(list.status).toBe(200);
    expect((await json(list)).some((r: any) => r.id === reminder.id)).toBe(true);

    const patch = await apiFetch(`/api/reminders/${reminder.id}`, {
      method: "PATCH",
      token: admin.token,
      body: JSON.stringify({ title: "Chase searches ASAP" }),
    });
    expect(patch.status).toBe(200);

    const del = await apiFetch(`/api/reminders/${reminder.id}`, {
      method: "DELETE",
      token: admin.token,
    });
    expect([200, 204]).toContain(del.status);
  });

  it("POST /api/reminders/:id/complete returns completed reminder", async () => {
    const create = await json(
      await apiFetch("/api/reminders", {
        method: "POST",
        token: admin.token,
        cookie: admin.cookie,
        body: JSON.stringify({
          matterId: matter.id,
          title: "Complete me",
          dueDate: new Date(Date.now() + 86400000).toISOString(),
        }),
      }),
    );

    const res = await apiFetch(`/api/reminders/${create.id}/complete`, {
      method: "POST",
      token: admin.token,
      cookie: admin.cookie,
    });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.completed).toBe(true);
  });
});
