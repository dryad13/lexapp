import { test, expect, loginAs, SEED_USERS } from "./helpers";

test.describe("e2e isolation + billing (G6)", () => {
  test("cross-org matter API returns 404", async ({ page, context }) => {
    await loginAs(page, SEED_USERS.admin.username, SEED_USERS.admin.password);

    const matterId = await page.evaluate(async () => {
      const res = await fetch("/api/matters", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `QA Isolation ${Date.now()}`,
          type: "purchase",
          clientName: "Isolation Client",
          clientEmail: "iso@example.com",
          propertyAddress: "1 Test Street",
          price: "100000",
          status: "active",
          currentStage: "Onboarding",
        }),
      });
      if (!res.ok) throw new Error(`create matter ${res.status}`);
      const body = await res.json();
      return body.id as number;
    });

    const own = await page.evaluate(async (id) => {
      const res = await fetch(`/api/matters/${id}`, { credentials: "include" });
      return res.status;
    }, matterId);
    expect(own).toBe(200);

    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    await loginAs(page, SEED_USERS.otherAdmin.username, SEED_USERS.otherAdmin.password);

    const cross = await page.evaluate(async (id) => {
      const res = await fetch(`/api/matters/${id}`, { credentials: "include" });
      return { status: res.status, text: await res.text() };
    }, matterId);
    expect(cross.status).toBe(404);
    expect(cross.text.toLowerCase()).not.toContain("isolation client");
  });

  test("admin billing status 200; fee earner checkout 403", async ({ page, context }) => {
    await loginAs(page, SEED_USERS.admin.username, SEED_USERS.admin.password);
    const adminStatus = await page.evaluate(async () => {
      const res = await fetch("/api/billing/status", { credentials: "include" });
      return { status: res.status, body: await res.json() };
    });
    expect(adminStatus.status).toBe(200);
    expect(adminStatus.body.organisationId).toBeTruthy();

    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    await loginAs(page, SEED_USERS.feeEarner.username, SEED_USERS.feeEarner.password);

    const checkout = await page.evaluate(async () => {
      const res = await fetch("/api/billing/checkout", { method: "POST", credentials: "include" });
      return res.status;
    });
    expect(checkout).toBe(403);
  });
});
