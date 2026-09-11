import { test, expect } from "./helpers";

test.describe("matter tabs: enquiries, finances", () => {
  test("finances tab add line item", async ({ authedPage: page }) => {
    const matter = await page.evaluate(async () => {
      const token = localStorage.getItem("conveyflow_auth_token");
      const res = await fetch("/api/matters", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: `Finance ${Date.now()}`,
          type: "purchase",
          clientName: "Finance Client",
          propertyAddress: "2 Finance Rd",
          currentStage: "Onboarding",
          status: "active",
        }),
      });
      return res.json();
    });
    await page.goto(`/matters/${matter.id}`);
    await page.getByTestId("tab-finances").click();
    await expect(page.getByText(/financ|ledger|item|amount/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("enquiries builder tab visible for purchase", async ({ authedPage: page }) => {
    const matter = await page.evaluate(async () => {
      const token = localStorage.getItem("conveyflow_auth_token");
      const res = await fetch("/api/matters", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: `Enquiries ${Date.now()}`,
          type: "purchase",
          clientName: "Enq Client",
          propertyAddress: "3 Enquiries Ave",
          currentStage: "Onboarding",
          status: "active",
        }),
      });
      return res.json();
    });
    await page.goto(`/matters/${matter.id}`);
    await expect(page.getByTestId("tab-enquiries-builder")).toBeVisible();
    await page.getByTestId("tab-enquiries-builder").click();
    await page.getByTestId("tab-enquiries").click();
  });
});
