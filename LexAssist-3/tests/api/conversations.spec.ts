import { describe, it, expect, beforeAll } from "vitest";
import { apiFetch, login, json, readSseText, type AuthSession } from "../helpers/api.js";

describe("conversations", () => {
  let admin: AuthSession;

  beforeAll(async () => {
    admin = await login();
  });

  it("conversation CRUD + SSE message", async () => {
    const create = await apiFetch("/api/conversations", {
      method: "POST",
      token: admin.token,
      body: JSON.stringify({ title: "Test chat" }),
    });
    expect([200, 201]).toContain(create.status);
    const conv = await json(create);

    const list = await apiFetch("/api/conversations", { token: admin.token });
    expect(list.status).toBe(200);

    const get = await apiFetch(`/api/conversations/${conv.id}`, { token: admin.token });
    expect(get.status).toBe(200);

    const msg = await apiFetch(`/api/conversations/${conv.id}/messages`, {
      method: "POST",
      token: admin.token,
      body: JSON.stringify({ content: "Hello AI" }),
    });
    expect(msg.status).toBe(200);
    const streamed = await readSseText(msg);
    expect(streamed.length).toBeGreaterThan(0);

    const del = await apiFetch(`/api/conversations/${conv.id}`, {
      method: "DELETE",
      token: admin.token,
    });
    expect([200, 204]).toContain(del.status);
  });
});
