import { describe, it, expect } from "vitest";
import { apiFetch } from "../helpers/api.js";
import { SEED_USERS } from "../helpers/env.js";

describe("login rate limit", () => {
  it("six failed logins from the same IP return 429", async () => {
    const ip = `198.51.100.${Math.floor(Math.random() * 200) + 20}`;
    const headers = { "X-Forwarded-For": ip };
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers,
        body: JSON.stringify({ username: SEED_USERS.admin.username, password: "wrong-password" }),
      });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});
