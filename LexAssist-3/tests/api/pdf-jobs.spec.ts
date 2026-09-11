import { describe, it, expect, beforeAll } from "vitest";
import { apiFetch, login, json, createMatter, type AuthSession } from "../helpers/api.js";
import { SEED_USERS } from "../helpers/env.js";

async function waitForPdf(jobId: string, token: string, cookie?: string) {
  for (let i = 0; i < 40; i++) {
    const res = await apiFetch(`/api/jobs/${jobId}`, { token, cookie });
    if (res.status === 200) return res;
    if (res.status !== 202) return res;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("PDF job timed out");
}

describe("pdf jobs", () => {
  let admin: AuthSession;
  let matter: any;

  beforeAll(async () => {
    admin = await login();
    matter = await createMatter(admin.token);
  });

  it("authenticated POST enqueues 202 and GET returns a PDF", async () => {
    const enqueue = await apiFetch(`/api/matters/${matter.id}/export-pdf`, {
      method: "POST",
      token: admin.token,
    });
    expect(enqueue.status).toBe(202);
    const { jobId } = await json(enqueue);
    expect(jobId).toBeTruthy();

    const pdf = await waitForPdf(jobId, admin.token);
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type") || "").toMatch(/pdf/);
    const buf = Buffer.from(await pdf.arrayBuffer());
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("unauthenticated enqueue is 401", async () => {
    const res = await apiFetch(`/api/matters/${matter.id}/export-pdf`, { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("other-org matter is 404", async () => {
    const other = await login(SEED_USERS.otherAdmin.username, SEED_USERS.otherAdmin.password);
    const res = await apiFetch(`/api/matters/${matter.id}/export-pdf`, {
      method: "POST",
      token: other.token,
    });
    expect(res.status).toBe(404);
  });
});
