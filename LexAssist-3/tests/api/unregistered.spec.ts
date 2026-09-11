import { describe, it, expect, beforeAll } from "vitest";
import { apiFetch, login, type AuthSession } from "../helpers/api.js";

describe("unregistered routes", () => {
  let admin: AuthSession;

  beforeAll(async () => {
    admin = await login();
  });

  it("POST /api/generate-image is not mounted (404)", async () => {
    const res = await apiFetch("/api/generate-image", {
      method: "POST",
      token: admin.token,
      body: JSON.stringify({ prompt: "test" }),
    });
    expect(res.status).toBe(404);
  });

  it("voice-conversations routes are not mounted (404)", async () => {
    const res = await apiFetch("/api/voice-conversations", { token: admin.token });
    expect(res.status).toBe(404);
  });
});
