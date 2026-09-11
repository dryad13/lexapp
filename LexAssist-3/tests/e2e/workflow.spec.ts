import { test, expect } from "./helpers";

async function createPurchaseMatter(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const token = localStorage.getItem("conveyflow_auth_token");
    const res = await fetch("/api/matters", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
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

  test.fail("stage progression PATCH uses conveyflow auth token @broken", async ({
    authedPage: page,
  }) => {
    const matter = await createPurchaseMatter(page);
    await page.goto(`/matters/${matter.id}`);

    // Simulate the buggy updateStageMutation path: wrong localStorage key
    const status = await page.evaluate(async (matterId) => {
      const wrong = localStorage.getItem("auth_token");
      const right = localStorage.getItem("conveyflow_auth_token");
      // Reproduce product bug: matter-detail uses auth_token
      const res = await fetch(`/api/matters/${matterId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(wrong ? { Authorization: `Bearer ${wrong}` } : {}),
        },
        body: JSON.stringify({ currentStage: "Client Info" }),
      });
      return { status: res.status, hasWrong: !!wrong, hasRight: !!right };
    }, matter.id);

    expect(status.hasRight).toBe(true);
    // With correct token this would be 409 or 200; with wrong/missing token it's 401
    // Correct product behavior: UI should send conveyflow_auth_token → not 401
    const correct = await page.evaluate(async (matterId) => {
      const token = localStorage.getItem("conveyflow_auth_token");
      const res = await fetch(`/api/matters/${matterId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentStage: "Client Info" }),
      });
      return res.status;
    }, matter.id);
    expect([200, 409]).toContain(correct);

    // This assertion documents the bug: using auth_token yields 401
    expect(status.status).not.toBe(401);
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
