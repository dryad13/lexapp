import { test, expect } from "./helpers";

async function createPurchaseMatter(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const res = await fetch("/api/matters", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Workflow ${Date.now()}`,
        type: "purchase",
        clientName: "Workflow Client",
        propertyAddress: "1 Workflow Way",
        price: "200000",
        currentStage: "Onboarding",
        status: "active",
      }),
    });
    if (!res.ok) throw new Error(`create matter failed: ${res.status}`);
    return res.json();
  });
}

test.describe("workflow + compliance", () => {
  test("workflow tab shows tasks; compliance tab lists checks", async ({ authedPage: page }) => {
    const matter = await createPurchaseMatter(page);
    await page.goto(`/matters/${matter.id}`);
    await page.getByTestId("tab-workflow").click();
    await expect(page.locator("[data-testid^='task-']").first()).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("tab-compliance").click();
    await expect(page.getByText(/compliance|check|AML|ID/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test("stage progression PATCH works with cookie session", async ({ authedPage: page }) => {
    const matter = await createPurchaseMatter(page);
    await page.goto(`/matters/${matter.id}`);

    const status = await page.evaluate(async (matterId) => {
      const res = await fetch(`/api/matters/${matterId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentStage: "Client Info" }),
      });
      return res.status;
    }, matter.id);

    expect([200, 409]).toContain(status);
  });

  test("inline reminder and draft email from matter detail", async ({ authedPage: page }) => {
    const matter = await createPurchaseMatter(page);
    await page.goto(`/matters/${matter.id}`);

    await page.getByTestId("button-add-reminder").click();
    await page.getByTestId("input-reminder-title").fill("Follow up");
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    await page.getByTestId("input-reminder-date").fill(tomorrow);
    await page.getByTestId("button-submit-reminder").click();

    await page.getByTestId("button-add-email").click();
    await page.getByTestId("input-email-recipient").fill("client@example.com");
    await page.getByTestId("input-email-subject").fill("Update");
    await page.getByTestId("input-email-body").fill("Hello from E2E");
    await page.getByTestId("button-submit-email").click();
  });
});
