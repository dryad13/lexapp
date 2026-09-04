import { getAccessToken } from "./auth";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export async function apiFetch(path: string, init?: RequestInit) {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    ...(init?.headers as any),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!headers["Content-Type"] && init?.body && !(init.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res;
}

export async function login(email: string, password: string) {
  return apiFetch(`/api/v1/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}
