import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { redis, redisReady } from "./redis";
import type { UserRole } from "../shared/schema";

export const SESSION_COOKIE = "lexassist.sid";
export const SESSION_TTL_SEC = 60 * 60;
const SESSION_PREFIX = "sess:";

function sessionKey(id: string) {
  return `${SESSION_PREFIX}${id}`;
}

export interface SessionData {
  username: string;
  userId: number;
  organisationId: number;
  role: UserRole;
  department: string;
  displayName: string;
  uaHash: string;
  ip: string;
  createdAt: number;
}

function isTestEnv() {
  return process.env.APP_ENV === "test";
}

export function hashUserAgent(ua: string | undefined): string {
  return crypto.createHash("sha256").update(ua || "").digest("hex");
}

export function clientIp(req: Request): string {
  return req.ip || (req.socket?.remoteAddress ?? "");
}

const memorySessions = new Map<string, { value: string; expiresAt: number }>();

async function sessionSet(id: string, value: string) {
  if (redisReady) {
    await redis.set(sessionKey(id), value, "EX", SESSION_TTL_SEC);
    return;
  }
  memorySessions.set(id, { value, expiresAt: Date.now() + SESSION_TTL_SEC * 1000 });
}

async function sessionGet(id: string): Promise<string | null> {
  if (redisReady) {
    return redis.get(sessionKey(id));
  }
  const row = memorySessions.get(id);
  if (!row) return null;
  if (row.expiresAt < Date.now()) {
    memorySessions.delete(id);
    return null;
  }
  return row.value;
}

async function sessionDel(id: string) {
  if (redisReady) {
    await redis.del(sessionKey(id));
    return;
  }
  memorySessions.delete(id);
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    signed: true,
    maxAge: SESSION_TTL_SEC * 1000,
  };
}

export async function createSession(
  req: Request,
  res: Response,
  data: Omit<SessionData, "uaHash" | "ip" | "createdAt">,
): Promise<string> {
  const id = crypto.randomBytes(32).toString("hex");
  const session: SessionData = {
    ...data,
    uaHash: hashUserAgent(req.headers["user-agent"]),
    ip: clientIp(req),
    createdAt: Date.now(),
  };
  await sessionSet(id, JSON.stringify(session));
  res.cookie(SESSION_COOKIE, id, cookieOptions());
  return id;
}

export async function destroySession(req: Request, res: Response): Promise<void> {
  const id = sessionIdFromRequest(req);
  if (id) {
    await sessionDel(id);
  }
  res.clearCookie(SESSION_COOKIE, { path: "/", httpOnly: true, sameSite: "lax" });
}

export function sessionIdFromRequest(req: Request): string | null {
  const signed = req.signedCookies?.[SESSION_COOKIE];
  if (typeof signed === "string" && signed) return signed;
  const unsigned = req.cookies?.[SESSION_COOKIE];
  if (typeof unsigned === "string" && unsigned) return unsigned;
  if (isTestEnv()) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      return authHeader.slice(7);
    }
  }
  return null;
}

export type LoadedSession = SessionData & { id: string; ipChanged: boolean; previousIp?: string };

export async function loadSession(req: Request): Promise<LoadedSession | null> {
  const id = sessionIdFromRequest(req);
  if (!id) return null;
  const raw = await sessionGet(id);
  if (!raw) return null;
  const session = JSON.parse(raw) as SessionData;
  const uaHash = hashUserAgent(req.headers["user-agent"]);
  if (session.uaHash && session.uaHash !== uaHash) {
    await sessionDel(id);
    return null;
  }
  const ip = clientIp(req);
  const ipChanged = !!(session.ip && ip && session.ip !== ip);
  const previousIp = session.ip;
  if (ipChanged) {
    session.ip = ip;
  }
  await sessionSet(id, JSON.stringify(session));
  return { ...session, id, ipChanged, previousIp };
}

export function attachSession(req: Request, session: LoadedSession) {
  (req as any).username = session.username;
  (req as any).userId = session.userId;
  (req as any).organisationId = session.organisationId;
  (req as any).role = session.role;
  (req as any).department = session.department;
  (req as any).displayName = session.displayName;
  (req as any).sessionId = session.id;
  (req as any).sessionIpChanged = session.ipChanged;
  (req as any).previousIp = session.previousIp;
}

export async function sessionMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    const session = await loadSession(req);
    if (session) attachSession(req, session);
    next();
  } catch (err) {
    next(err);
  }
}

export function isPublicApiPath(req: Request): boolean {
  const path = req.originalUrl.split("?")[0];
  if (path === "/api/healthz") return true;
  if (path === "/api/stripe/webhook") return true;
  if (path === "/api/auth/login" || path === "/api/auth/logout" || path === "/api/auth/me") return true;
  return false;
}
