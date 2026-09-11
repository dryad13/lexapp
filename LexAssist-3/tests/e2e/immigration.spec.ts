import { test, expect, loginAs, SEED_USERS } from "./helpers";

const API_BASE = process.env.TEST_API_BASE || "http://127.0.0.1:8080";

test.describe("immigration workflow UI", () => {
  test("create flow requires practice area then type", async ({ authedPage: page }) => {
    await page.goto("/matters");
    await page.getByTestId("button-new-matter").click();

    await expect(page.getByTestId("select-practice-area")).toBeVisible();
    await page.getByTestId("select-practice-area").click();
    await page.getByRole("option", { name: /immigration/i }).click();

    await expect(page.getByTestId("select-matter-type")).toBeVisible();
    await page.getByTestId("select-matter-type").click();
    await page.getByRole("option", { name: /visa application/i }).click();

    const title = `E2E Imm ${Date.now()}`;
    await page.getByTestId("input-matter-title").fill(title);
    await page.getByTestId("input-client-name").fill("Imm Client");
    await page.getByTestId("input-property-address").fill("1 Immigration Rd");
    await page.getByTestId("button-submit-matter").click();
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 20_000 });
  });

  test("immigration matter shows practice badge, stages, compliance; hides enquiries builder", async ({
    authedPage: page,
  }) => {
    const matter = await page.evaluate(async () => {
      const token = localStorage.getItem("conveyflow_auth_token");
      const res = await fetch("/api/matters", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: `Imm Detail ${Date.now()}`,
          type: "visa_application",
          clientName: "Visa Client",
          propertyAddress: "2 Visa Lane",
          currentStage: "Onboarding / Induction",
          status: "active",
        }),
      });
      return res.json();
    });

    await page.goto(`/matters/${matter.id}`);
    await expect(page.getByTestId("badge-matter-practice-area")).toContainText("Immigration");
    await expect(page.getByText("Onboarding / Induction").first()).toBeVisible();
    await expect(page.getByTestId("tab-enquiries-builder")).toHaveCount(0);
    await expect(page.getByTestId("tab-enquiries")).toContainText("Documents");

    await page.getByTestId("tab-compliance").click();
    await expect(page.getByText(/Conflict check|AML|compliance/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("conveyancing matter still shows Conveyancing badge", async ({ authedPage: page }) => {
    const matter = await page.evaluate(async () => {
      const token = localStorage.getItem("conveyflow_auth_token");
      const res = await fetch("/api/matters", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: `Conv ${Date.now()}`,
          type: "purchase",
          clientName: "Buyer",
          propertyAddress: "9 High St",
          currentStage: "Onboarding",
          status: "active",
        }),
      });
      return res.json();
    });
    await page.goto(`/matters/${matter.id}`);
    await expect(page.getByTestId("badge-matter-practice-area")).toContainText("Conveyancing");
  });

  test("read_only cannot mutate immigration matter", async ({ page }) => {
    const adminLogin = await page.request.post(`${API_BASE}/api/auth/login`, {
      data: { username: SEED_USERS.admin.username, password: SEED_USERS.admin.password },
    });
    const adminAuth = await adminLogin.json();
    const matterRes = await page.request.post(`${API_BASE}/api/matters`, {
      headers: {
        Authorization: `Bearer ${adminAuth.token}`,
        "Content-Type": "application/json",
      },
      data: {
        title: `RO View ${Date.now()}`,
        type: "visa_application",
        clientName: "RO Client",
        propertyAddress: "3 Read Only Rd",
        currentStage: "Onboarding / Induction",
        status: "active",
      },
    });
    expect(matterRes.ok()).toBeTruthy();
    const matterBody = await matterRes.json();

    await loginAs(page, SEED_USERS.readOnly.username, SEED_USERS.readOnly.password);

    await page.goto("/matters");
    await expect(page.getByTestId("button-new-matter")).toHaveCount(0);

    await page.goto(`/matters/${matterBody.id}`);
    await expect(page.getByTestId("badge-matter-practice-area")).toContainText("Immigration");
    await expect(page.getByTestId("button-edit-matter")).toHaveCount(0);
    await expect(page.getByTestId("tab-finances")).toHaveCount(0);
    await expect(page.getByTestId("tab-compliance")).toBeVisible();
  });
});
