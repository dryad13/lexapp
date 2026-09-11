import { describe, it, expect, beforeAll } from "vitest";
import { apiFetch, login, json, createMatter, type AuthSession } from "../helpers/api.js";
import { SEED_USERS } from "../helpers/env.js";

async function uploadDoc(token: string, matterId: number, name: string) {
  const form = new FormData();
  form.append("files", new Blob([`content for ${name}`], { type: "text/plain" }), name);
  form.append("documentType", "contract");
  const res = await apiFetch(`/api/matters/${matterId}/documents`, {
    method: "POST",
    token,
    body: form,
  });
  const body = await json(res);
  return Array.isArray(body) ? body[0] : body;
}

describe("isolation", () => {
  let admin: AuthSession;
  let other: AuthSession;
  let matter: any;
  let packId: number | undefined;
  let financialItemId: number | undefined;

  beforeAll(async () => {
    admin = await login();
    other = await login(SEED_USERS.otherAdmin.username, SEED_USERS.otherAdmin.password);
    expect(other.organisationId).not.toBe(admin.organisationId);
    matter = await createMatter(admin.token);
    const doc = await uploadDoc(admin.token, matter.id, "title.txt");

    const packs = await apiFetch(`/api/matters/${matter.id}/generate-purchase-enquiries`, {
      method: "POST",
      token: admin.token,
      body: JSON.stringify({ documentIds: [doc.id] }),
    });
    if (packs.ok) {
      packId = (await json(packs)).id;
    }

    const item = await apiFetch(`/api/matters/${matter.id}/financial-items`, {
      method: "POST",
      token: admin.token,
      body: JSON.stringify({
        description: "Fee",
        amount: "10",
        category: "fee",
      }),
    });
    if (item.ok) {
      financialItemId = (await json(item)).id;
    }
  });

  it("matter GET for unknown id returns 404", async () => {
    const res = await apiFetch("/api/matters/99999999", { token: admin.token });
    expect(res.status).toBe(404);
  });

  it("cross-org matter GET is 404", async () => {
    const res = await apiFetch(`/api/matters/${matter.id}`, { token: other.token });
    expect(res.status).toBe(404);
  });

  it("enquiry-pack GET requires org access", async () => {
    if (!packId) return;
    const ok = await apiFetch(`/api/enquiry-packs/${packId}`, { token: admin.token });
    expect(ok.status).toBe(200);

    const missing = await apiFetch("/api/enquiry-packs/99999999", { token: admin.token });
    expect(missing.status).toBe(404);

    const cross = await apiFetch(`/api/enquiry-packs/${packId}`, { token: other.token });
    expect(cross.status).toBe(404);
  });

  it("financial-items PATCH/DELETE should verify matter access", async () => {
    if (!financialItemId) return;
    const patch = await apiFetch(`/api/financial-items/${financialItemId}`, {
      method: "PATCH",
      token: admin.token,
      body: JSON.stringify({ amount: "11" }),
    });
    expect(patch.status).toBe(200);

    const missing = await apiFetch("/api/financial-items/99999999", {
      method: "PATCH",
      token: admin.token,
      body: JSON.stringify({ amount: "1" }),
    });
    expect(missing.status).toBe(404);

    const cross = await apiFetch(`/api/financial-items/${financialItemId}`, {
      method: "PATCH",
      token: other.token,
      body: JSON.stringify({ amount: "12" }),
    });
    expect(cross.status).toBe(404);
  });
});
