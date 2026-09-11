/**
 * HTTP helpers for API E2E tests against the running LexAssist server.
 */
import { API_BASE, SEED_USERS, randomSuffix } from "./env.js";

export type AuthSession = {
  token: string;
  cookie: string;
  username: string;
  role: string;
  organisationId: number;
  displayName?: string;
  department?: string;
};

function cookieHeaderFromResponse(res: Response): string {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const list = typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : (headers.get("set-cookie") ? [headers.get("set-cookie") as string] : []);
  return list
    .map((c) => c.split(";")[0])
    .filter(Boolean)
    .join("; ");
}

export async function apiFetch(
  path: string,
  options: RequestInit & { token?: string | null; cookie?: string | null } = {},
): Promise<Response> {
  const { token, cookie, headers, ...rest } = options;
  const h = new Headers(headers);
  if (token) h.set("Authorization", `Bearer ${token}`);
  if (cookie) h.set("Cookie", cookie);
  if (rest.body && !(rest.body instanceof FormData) && !h.has("Content-Type")) {
    h.set("Content-Type", "application/json");
  }
  return fetch(`${API_BASE}${path}`, { ...rest, headers: h, credentials: "include" });
}

export async function login(
  username = SEED_USERS.admin.username,
  password = SEED_USERS.admin.password,
  extraHeaders: Record<string, string> = {},
): Promise<AuthSession> {
  const res = await apiFetch("/api/auth/login", {
    method: "POST",
    headers: extraHeaders,
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${username}: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  return {
    token: data.token,
    cookie: cookieHeaderFromResponse(res),
    username: data.username,
    role: data.role,
    organisationId: data.organisationId,
    displayName: data.displayName,
    department: data.department,
  };
}

export async function json<T = any>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Expected JSON, got: ${text.slice(0, 200)}`);
  }
}

const IMMIGRATION_TYPES = new Set([
  "visa_application",
  "asylum",
  "appeal",
  "settlement",
  "naturalisation",
]);

export async function createMatter(
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<any> {
  const suffix = randomSuffix();
  const type = String(overrides.type || "purchase");
  const body = {
    title: `Test Matter ${suffix}`,
    type: "purchase",
    clientName: `Client ${suffix}`,
    clientEmail: `client-${suffix}@example.com`,
    propertyAddress: `${suffix} Test Street, London`,
    price: "250000",
    status: "active",
    currentStage: IMMIGRATION_TYPES.has(type)
      ? "Onboarding / Induction"
      : "Onboarding",
    ...overrides,
  };
  if (!body.currentStage) {
    body.currentStage = IMMIGRATION_TYPES.has(String(body.type))
      ? "Onboarding / Induction"
      : "Onboarding";
  }
  const res = await apiFetch("/api/matters", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`createMatter failed: ${res.status} ${await res.text()}`);
  }
  return json(res);
}

export async function waitForHealth(timeoutMs = 60_000): Promise<void> {
  const start = Date.now();
  let lastErr = "";
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${API_BASE}/api/healthz`);
      if (res.ok) return;
      lastErr = `status ${res.status}`;
    } catch (e: any) {
      lastErr = e.message || String(e);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`API healthz not ready at ${API_BASE}: ${lastErr}`);
}

export async function readSseText(res: Response): Promise<string> {
  const text = await res.text();
  const parts: string[] = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const parsed = JSON.parse(payload);
      if (typeof parsed.content === "string") parts.push(parsed.content);
      else if (typeof parsed.text === "string") parts.push(parsed.text);
      else if (typeof parsed.fullContent === "string" && parsed.done) {
        // final chunk already accumulated via content deltas
      } else {
        const delta =
          parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.message?.content;
        if (typeof delta === "string") parts.push(delta);
      }
    } catch {
      parts.push(payload);
    }
  }
  return parts.join("") || text;
}

export { cookieHeaderFromResponse };
