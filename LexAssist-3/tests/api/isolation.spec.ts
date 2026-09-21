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

  it("cross-org knowledge resource is invisible", async () => {
    const form = new FormData();
    form.append("file", new Blob(["firm-a-secret"], { type: "text/plain" }), "secret.txt");
    const upload = await apiFetch("/api/knowledge-resources", {
      method: "POST",
      token: admin.token,
      body: form,
    });
    expect([200, 201]).toContain(upload.status);
    const resource = await json(upload);

    const otherList = await apiFetch("/api/knowledge-resources", { token: other.token });
    expect(otherList.status).toBe(200);
    const items = await json(otherList);
    expect(items.find((r: any) => r.id === resource.id)).toBeUndefined();

    const otherDel = await apiFetch(`/api/knowledge-resources/${resource.id}`, {
      method: "DELETE",
      token: other.token,
    });
    expect(otherDel.status).toBe(404);
  });

  it("cross-org journal entry is 404", async () => {
    const create = await apiFetch("/api/journal-entries", {
      method: "POST",
      token: admin.token,
      body: JSON.stringify({
        title: "Firm A note",
        activity: "Review",
        learning: "Isolation",
        reflection: "Private",
        category: "general",
      }),
    });
    expect([200, 201]).toContain(create.status);
    const entry = await json(create);

    const cross = await apiFetch(`/api/journal-entries/${entry.id}`, { token: other.token });
    expect(cross.status).toBe(404);
  });

  it("cross-org conversation is 404", async () => {
    const create = await apiFetch("/api/conversations", {
      method: "POST",
      token: admin.token,
      body: JSON.stringify({ title: "Firm A chat" }),
    });
    expect([200, 201]).toContain(create.status);
    const convo = await json(create);

    const cross = await apiFetch(`/api/conversations/${convo.id}`, { token: other.token });
    expect(cross.status).toBe(404);
  });

  it("two orgs can share the same username", async () => {
    const suffix = Date.now().toString(36);
    const name = `shared.user.${suffix}`;
    const createA = await apiFetch("/api/users", {
      method: "POST",
      token: admin.token,
      body: JSON.stringify({
        username: name,
        displayName: "Shared A",
        password: "SharedPass12",
        role: "assistant",
      }),
    });
    expect([200, 201]).toContain(createA.status);

    const createB = await apiFetch("/api/users", {
      method: "POST",
      token: other.token,
      body: JSON.stringify({
        username: name,
        displayName: "Shared B",
        password: "SharedPass12",
        role: "assistant",
      }),
    });
    expect([200, 201]).toContain(createB.status);

    const ambiguous = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: name, password: "SharedPass12" }),
    });
    expect(ambiguous.status).toBe(401);

    const withOrg = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: name,
        password: "SharedPass12",
        organisation: "Gardner Champion",
      }),
    });
    expect(withOrg.status).toBe(200);
    const body = await json(withOrg);
    expect(body.organisationId).toBe(admin.organisationId);
  });
});
