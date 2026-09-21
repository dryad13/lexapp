import { describe, it, expect, beforeAll } from "vitest";
import { apiFetch, login, json, type AuthSession } from "../helpers/api.js";
import { randomSuffix } from "../helpers/env.js";
import {
  generateTotpSecret,
  generateTotpCode,
  verifyTotp,
  totpAuthUrl,
} from "../../artifacts/api-server/src/lexassist/totp.ts";
import { LOGIN_LOCKOUT } from "../../artifacts/api-server/src/lexassist/auth-lockout.ts";

describe("security hardening", () => {
  let admin: AuthSession;

  beforeAll(async () => {
    admin = await login();
  });

  it("sets security headers on API responses", async () => {
    const res = await apiFetch("/api/healthz");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy") || "").toContain("default-src");
  });

  it("rejects short passwords on user create", async () => {
    const res = await apiFetch("/api/users", {
      method: "POST",
      token: admin.token,
      cookie: admin.cookie,
      body: JSON.stringify({
        username: `short.${randomSuffix()}`,
        displayName: "Short",
        password: "short1",
        role: "assistant",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("accepts policy-compliant passwords", async () => {
    const suffix = randomSuffix();
    const res = await apiFetch("/api/users", {
      method: "POST",
      token: admin.token,
      cookie: admin.cookie,
      body: JSON.stringify({
        username: `ok.${suffix}`,
        displayName: "Ok User",
        password: "CompliantPass12",
        role: "assistant",
      }),
    });
    expect([200, 201]).toContain(res.status);
    if (res.ok) {
      const user = await json(res);
      await apiFetch(`/api/users/${user.id}`, {
        method: "DELETE",
        token: admin.token,
        cookie: admin.cookie,
      });
    }
  });

  it("TOTP helpers generate verifiable codes", () => {
    const secret = generateTotpSecret();
    expect(secret.length).toBeGreaterThan(10);
    expect(totpAuthUrl(secret, "admin@test")).toContain("otpauth://totp/");
    const code = generateTotpCode(secret);
    expect(verifyTotp(secret, code)).toBe(true);
    expect(verifyTotp(secret, "000000")).toBe(false);
  });

  it("locks login after too many failures", async () => {
    const username = `lockout.${randomSuffix()}`;
    for (let i = 0; i < LOGIN_LOCKOUT.MAX_FAILURES; i++) {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password: "WrongPass99" }),
      });
      expect(res.status).toBe(401);
    }
    const locked = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password: "WrongPass99" }),
    });
    expect(locked.status).toBe(423);
    const body = await json(locked);
    expect(body.error).toMatch(/locked/i);
  });

  it("MFA setup → confirm → login challenge → verify", async () => {
    const suffix = randomSuffix();
    const username = `mfa.${suffix}`;
    const password = "MfaUserPass12";
    const create = await apiFetch("/api/users", {
      method: "POST",
      token: admin.token,
      cookie: admin.cookie,
      body: JSON.stringify({
        username,
        displayName: "MFA User",
        password,
        role: "fee_earner",
      }),
    });
    expect([200, 201]).toContain(create.status);
    const created = await json(create);

    const session = await login(username, password);
    const setup = await apiFetch("/api/auth/mfa/setup", {
      method: "POST",
      token: session.token,
      cookie: session.cookie,
    });
    expect(setup.status).toBe(200);
    const enrollment = await json(setup);
    expect(enrollment.secret).toBeTruthy();
    expect(enrollment.otpauthUrl).toContain("otpauth://totp/");

    const code = generateTotpCode(enrollment.secret);
    const confirm = await apiFetch("/api/auth/mfa/confirm", {
      method: "POST",
      token: session.token,
      cookie: session.cookie,
      body: JSON.stringify({ code }),
    });
    expect(confirm.status).toBe(200);
    const confirmed = await json(confirm);
    expect(confirmed.mfaEnabled).toBe(true);

    const challenge = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    expect(challenge.status).toBe(200);
    const challengeBody = await json(challenge);
    expect(challengeBody.mfaRequired).toBe(true);
    expect(challengeBody.mfaToken).toBeTruthy();

    const verifyCode = generateTotpCode(enrollment.secret);
    const verified = await apiFetch("/api/auth/mfa/verify", {
      method: "POST",
      body: JSON.stringify({ mfaToken: challengeBody.mfaToken, code: verifyCode }),
    });
    expect(verified.status).toBe(200);
    const verifiedBody = await json(verified);
    expect(verifiedBody.token || verifiedBody.ok).toBeTruthy();
    expect(verifiedBody.username).toBe(username);

    await apiFetch(`/api/users/${created.id}`, {
      method: "DELETE",
      token: admin.token,
      cookie: admin.cookie,
    });
  });
});
