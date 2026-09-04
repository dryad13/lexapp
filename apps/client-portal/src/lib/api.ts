const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, { ...init, cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res;
}

export async function getProgress(token: string) {
  return apiFetch(`/api/v1/onboarding/client/${token}`);
}

export async function saveProgress(token: string, payload: any) {
  return apiFetch(`/api/v1/onboarding/client/${token}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function uploadDoc(token: string, category: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  return apiFetch(`/api/v1/documents/client/${token}/upload?category=${encodeURIComponent(category)}`, {
    method: "POST",
    body: fd
  });
}
