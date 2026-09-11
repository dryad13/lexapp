import { test, expect } from "./helpers";

test.describe("matters workflows", () => {
  test("create purchase matter from matters page", async ({ authedPage: page }) => {
    await page.goto("/matters");
    await expect(page.getByTestId("text-matters-title")).toBeVisible();
    await page.getByTestId("button-new-matter").click();

    await page.getByTestId("select-practice-area").click();
    await page.getByRole("option", { name: /conveyancing/i }).click();
    await page.getByTestId("select-matter-type").click();
    await page.getByRole("option", { name: /purchase/i }).click();

    await page.getByTestId("input-matter-title").fill(`E2E Purchase ${Date.now()}`);
    await page.getByTestId("input-client-name").fill("E2E Client");
    await page.getByTestId("input-client-email").fill("e2e@example.com");
    await page.getByTestId("input-property-address").fill("10 Test Street, London");
    await page.getByTestId("input-price").fill("300000");
    await page.getByTestId("button-submit-matter").click();
    await expect(page.getByText(/E2E Purchase|E2E Client/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("create immigration matter as admin (dept both)", async ({ authedPage: page }) => {
    await page.goto("/matters");
    await page.getByTestId("button-new-matter").click();

    await page.getByTestId("select-practice-area").click();
    await page.getByRole("option", { name: /immigration/i }).click();
    await page.getByTestId("select-matter-type").click();
    await page.getByRole("option", { name: /visa/i }).click();

    await page.getByTestId("input-matter-title").fill(`E2E Visa ${Date.now()}`);
    await page.getByTestId("input-client-name").fill("Visa Client");
    await page.getByTestId("input-property-address").fill("1 Immigration Rd");
    await page.getByTestId("button-submit-matter").click();
    await expect(page.getByText(/E2E Visa|Visa Client/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("search and open matter detail + edit", async ({ authedPage: page }) => {
    await page.goto("/matters");
    const matter = await page.evaluate(async () => {
      const token = localStorage.getItem("conveyflow_auth_token");
      const res = await fetch("/api/matters", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: `Detail ${Date.now()}`,
          type: "purchase",
          clientName: "Detail Client",
          propertyAddress: "99 Detail Lane",
          price: "100000",
          currentStage: "Onboarding",
          status: "active",
        }),
      });
      return res.json();
    });
    await page.goto(`/matters/${matter.id}`);
    await expect(page.getByTestId("text-matter-title")).toBeVisible();
    await page.getByTestId("button-edit-matter").click();
    await page.getByTestId("input-edit-title").fill("Detail Updated");
    await page.getByTestId("button-submit-edit").click();
    await expect(page.getByTestId("text-matter-title")).toContainText("Detail Updated", {
      timeout: 15_000,
    });
  });
});
