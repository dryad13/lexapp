import { describe, it, expect } from "vitest";
import { apiFetch } from "../helpers/api.js";
import { SEED_USERS, randomSuffix } from "../helpers/env.js";

describe("login rate limit", () => {
  it("six failed logins with rate-limit enabled return 429", async () => {
    // Use a unique username so account lockout (10 fails) does not fire first.
    const username = `ratelimit.${randomSuffix()}`;
    const headers = { "X-Test-Enable-Rate-Limit": "1" };
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers,
        body: JSON.stringify({ username, password: "wrong-password" }),
      });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
    expect(statuses[5]).toBe(429);
  });

  it("without the opt-in header, test env does not 429 within six attempts", async () => {
    const username = `nolimit.${randomSuffix()}`;
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password: "wrong-password" }),
      });
      statuses.push(res.status);
    }
    expect(statuses.every((s) => s === 401)).toBe(true);
  });
});
