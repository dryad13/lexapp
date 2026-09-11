import { describe, it, expect, beforeAll } from "vitest";
import { apiFetch, login, readSseText, type AuthSession } from "../helpers/api.js";

describe("ai", () => {
  let admin: AuthSession;

  beforeAll(async () => {
    admin = await login();
  });

  it("POST /api/ai/generate-email streams via mock", async () => {
    const res = await apiFetch("/api/ai/generate-email", {
      method: "POST",
      token: admin.token,
      body: JSON.stringify({
        context: "Write a chase email about search results",
        recipient: "client@example.com",
        subject: "Search results",
      }),
    });
    expect(res.status).toBe(200);
    const text = await readSseText(res);
    expect(text.length).toBeGreaterThan(0);
  });

  it("POST /api/ai/suggest streams via mock", async () => {
    const res = await apiFetch("/api/ai/suggest", {
      method: "POST",
      token: admin.token,
      body: JSON.stringify({
        question: "What is SDLT?",
      }),
    });
    expect(res.status).toBe(200);
    const text = await readSseText(res);
    expect(text.length).toBeGreaterThan(0);
  });
});
