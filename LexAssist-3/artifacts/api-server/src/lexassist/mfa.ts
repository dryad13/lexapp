import { redis, redisReady } from "./redis";
import { encrypt, decrypt } from "./encryption";
import { generateBackupCodes, generateTotpSecret, totpAuthUrl, verifyTotp } from "./totp";
import crypto from "crypto";

const PENDING_TTL = 5 * 60;
const memoryPending = new Map<string, { value: string; expiresAt: number }>();

export type PendingMfaPayload = {
  userId: number;
  username: string;
  organisationId: number;
  role: string;
  department: string;
  displayName: string;
  purpose: "verify" | "setup";
};

function pendingKey(token: string) {
  return `mfa:pending:${token}`;
}

async function pendingSet(token: string, payload: PendingMfaPayload) {
  const raw = JSON.stringify(payload);
  if (redisReady) {
    await redis.set(pendingKey(token), raw, "EX", PENDING_TTL);
    return;
  }
  memoryPending.set(token, { value: raw, expiresAt: Date.now() + PENDING_TTL * 1000 });
}

async function pendingGet(token: string): Promise<PendingMfaPayload | null> {
  let raw: string | null = null;
  if (redisReady) {
    raw = await redis.get(pendingKey(token));
  } else {
    const row = memoryPending.get(token);
    if (row && row.expiresAt >= Date.now()) raw = row.value;
    else if (row) memoryPending.delete(token);
  }
  if (!raw) return null;
  return JSON.parse(raw) as PendingMfaPayload;
}

async function pendingDel(token: string) {
  if (redisReady) await redis.del(pendingKey(token));
  else memoryPending.delete(token);
}

export function mfaRequiredForAdmins(): boolean {
  if (process.env.MFA_REQUIRED_FOR_ADMINS === "1") return true;
  if (process.env.MFA_REQUIRED_FOR_ADMINS === "0") return false;
  return process.env.NODE_ENV === "production" && process.env.APP_ENV !== "test";
}

/** Platform admins always require MFA outside test / explicit disable. */
export function mfaRequiredForPlatformAdmin(): boolean {
  if (process.env.APP_ENV === "test") return false;
  if (process.env.MFA_REQUIRED_FOR_PLATFORM === "0") return false;
  if (process.env.MFA_REQUIRED_FOR_PLATFORM === "1") return true;
  return true;
}

export async function createPendingMfaToken(payload: PendingMfaPayload): Promise<string> {
  const token = crypto.randomBytes(24).toString("hex");
  await pendingSet(token, payload);
  return token;
}

export async function consumePendingMfaToken(token: string): Promise<PendingMfaPayload | null> {
  const payload = await pendingGet(token);
  if (!payload) return null;
  await pendingDel(token);
  return payload;
}

export async function peekPendingMfaToken(token: string): Promise<PendingMfaPayload | null> {
  return pendingGet(token);
}

export function encryptMfaSecret(secret: string): string {
  return encrypt(secret);
}

export function decryptMfaSecret(ciphertext: string): string {
  return decrypt(ciphertext);
}

export function beginMfaEnrollment(accountName: string) {
  const secret = generateTotpSecret();
  const otpauthUrl = totpAuthUrl(secret, accountName);
  const backupCodes = generateBackupCodes();
  return { secret, otpauthUrl, backupCodes };
}

export function checkTotp(encryptedSecret: string, code: string): boolean {
  const secret = decryptMfaSecret(encryptedSecret);
  return verifyTotp(secret, code);
}

export function hashBackupCode(code: string): string {
  return crypto.createHash("sha256").update(code.trim().toLowerCase()).digest("hex");
}
