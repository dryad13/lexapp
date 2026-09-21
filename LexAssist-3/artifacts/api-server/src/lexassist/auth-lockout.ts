import { redis, redisReady } from "./redis";

const FAIL_TTL_SEC = 15 * 60;
const MAX_FAILURES = 10;
const memoryFails = new Map<string, { count: number; expiresAt: number }>();

function failKey(username: string, organisationHint?: string) {
  const org = (organisationHint || "global").toLowerCase().trim() || "global";
  return `login:fail:${org}:${username.toLowerCase()}`;
}

async function getCount(key: string): Promise<number> {
  if (redisReady) {
    const raw = await redis.get(key);
    return raw ? Number(raw) || 0 : 0;
  }
  const row = memoryFails.get(key);
  if (!row) return 0;
  if (row.expiresAt < Date.now()) {
    memoryFails.delete(key);
    return 0;
  }
  return row.count;
}

async function setCount(key: string, count: number): Promise<void> {
  if (redisReady) {
    await redis.set(key, String(count), "EX", FAIL_TTL_SEC);
    return;
  }
  memoryFails.set(key, { count, expiresAt: Date.now() + FAIL_TTL_SEC * 1000 });
}

export async function isLoginLocked(username: string, organisationHint?: string): Promise<boolean> {
  const count = await getCount(failKey(username, organisationHint));
  return count >= MAX_FAILURES;
}

export async function recordLoginFailure(username: string, organisationHint?: string): Promise<number> {
  const key = failKey(username, organisationHint);
  const next = (await getCount(key)) + 1;
  await setCount(key, next);
  return next;
}

export async function clearLoginFailures(username: string, organisationHint?: string): Promise<void> {
  const key = failKey(username, organisationHint);
  if (redisReady) {
    await redis.del(key);
    return;
  }
  memoryFails.delete(key);
}

export const LOGIN_LOCKOUT = { MAX_FAILURES, FAIL_TTL_SEC };
