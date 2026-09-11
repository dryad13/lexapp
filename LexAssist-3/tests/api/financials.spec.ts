import { describe, it, expect, beforeAll } from "vitest";
import { apiFetch, login, json, createMatter, type AuthSession } from "../helpers/api.js";

describe("financials", () => {
  let admin: AuthSession;
  let matter: any;

  beforeAll(async () => {
    admin = await login();
    matter = await createMatter(admin.token);
  });

  it("financial items CRUD + summary + export", async () => {
    const get = await apiFetch(`/api/matters/${matter.id}/financials`, { token: admin.token });
    expect(get.status).toBe(200);

    const create = await apiFetch(`/api/matters/${matter.id}/financial-items`, {
      method: "POST",
      token: admin.token,
      body: JSON.stringify({
        description: "Search fees",
        amount: "150.00",
        category: "disbursement",
        vatRate: "20",
      }),
    });
    expect([200, 201]).toContain(create.status);
    const item = await json(create);

    const patch = await apiFetch(`/api/financial-items/${item.id}`, {
      method: "PATCH",
      token: admin.token,
      body: JSON.stringify({ amount: "175.00" }),
    });
    expect(patch.status).toBe(200);

    const summary = await apiFetch(`/api/matters/${matter.id}/financials-summary`, {
      method: "PATCH",
      token: admin.token,
      body: JSON.stringify({ purchasePrice: "250000", deposit: "25000" }),
    });
    expect(summary.status).toBe(200);

    const exp = await apiFetch(`/api/matters/${matter.id}/financials/export`, {
      token: admin.token,
    });
    expect(exp.status).toBe(200);

    const del = await apiFetch(`/api/financial-items/${item.id}`, {
      method: "DELETE",
      token: admin.token,
    });
    expect([200, 204]).toContain(del.status);
  });
});
