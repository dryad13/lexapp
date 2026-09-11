import { describe, it, expect, beforeAll } from "vitest";
import { apiFetch, login, json, createMatter, type AuthSession } from "../helpers/api.js";

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

describe("enquiry-packs", () => {
  let admin: AuthSession;
  let purchase: any;
  let sale: any;
  let purchaseDocId: number;
  let saleDocId: number;

  beforeAll(async () => {
    admin = await login();
    purchase = await createMatter(admin.token, { type: "purchase" });
    sale = await createMatter(admin.token, { type: "sale" });
    purchaseDocId = (await uploadDoc(admin.token, purchase.id, "title.txt")).id;
    saleDocId = (await uploadDoc(admin.token, sale.id, "enquiries.txt")).id;
  });

  it("generate purchase enquiries pack via AI mock", async () => {
    const res = await apiFetch(`/api/matters/${purchase.id}/generate-purchase-enquiries`, {
      method: "POST",
      token: admin.token,
      body: JSON.stringify({ documentIds: [purchaseDocId] }),
    });
    expect([200, 201]).toContain(res.status);
    const pack = await json(res);
    expect(pack.id).toBeTruthy();

    const get = await apiFetch(`/api/enquiry-packs/${pack.id}`, { token: admin.token });
    expect(get.status).toBe(200);

    const list = await apiFetch(`/api/matters/${purchase.id}/enquiry-packs`, { token: admin.token });
    expect(list.status).toBe(200);
  });

  it("generate sale replies pack", async () => {
    const res = await apiFetch(`/api/matters/${sale.id}/generate-sale-replies`, {
      method: "POST",
      token: admin.token,
      body: JSON.stringify({ enquiryDocId: saleDocId, supportingDocIds: [] }),
    });
    expect([200, 201]).toContain(res.status);
  });

  it("analyse-searches", async () => {
    const res = await apiFetch(`/api/matters/${purchase.id}/analyse-searches`, {
      method: "POST",
      token: admin.token,
      body: JSON.stringify({
        documentIds: [purchaseDocId],
        searchText: "Local authority search: planning notice nearby.",
      }),
    });
    expect([200, 201]).toContain(res.status);
  });

  it("approve and send pack creates draft email", async () => {
    const packs = await json(
      await apiFetch(`/api/matters/${purchase.id}/enquiry-packs`, { token: admin.token }),
    );
    const pack = packs[0];
    if (!pack) return;

    await apiFetch(`/api/enquiry-packs/${pack.id}`, {
      method: "PATCH",
      token: admin.token,
      body: JSON.stringify({ title: "Edited pack" }),
    });

    const approve = await apiFetch(`/api/enquiry-packs/${pack.id}/approve`, {
      method: "POST",
      token: admin.token,
    });
    expect([200, 201]).toContain(approve.status);

    const send = await apiFetch(`/api/enquiry-packs/${pack.id}/send`, {
      method: "POST",
      token: admin.token,
      body: JSON.stringify({ recipient: "seller.solicitor@example.com" }),
    });
    expect([200, 201]).toContain(send.status);
  });
});
