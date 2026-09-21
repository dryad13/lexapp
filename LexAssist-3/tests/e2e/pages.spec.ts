import { test, expect } from "./helpers";

test.describe("global pages", () => {
  test("draft emails page", async ({ authedPage: page }) => {
    await page.goto("/emails");
    await expect(page.getByText(/draft|email/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test("reminders page create + complete", async ({ authedPage: page }) => {
    await page.goto("/reminders");
    await expect(page.getByTestId("text-reminders-title")).toBeVisible();
    await page.getByTestId("button-new-reminder").click();
    await page.getByTestId("input-r-title").fill(`Reminder ${Date.now()}`);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    await page.getByTestId("input-r-date").fill(tomorrow);
    // matter select optional
    const matterSelect = page.getByTestId("select-reminder-matter");
    if (await matterSelect.count()) {
      await matterSelect.click();
      const opt = page.getByRole("option").nth(1);
      if (await opt.count()) await opt.click();
    }
    await page.getByTestId("button-submit-reminder").click();
    await expect(page.locator("[data-testid^='card-reminder-']").first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("journal page", async ({ authedPage: page }) => {
    await page.goto("/journal");
    await expect(page.getByText(/journal|reflection|learning/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("resources page is static", async ({ authedPage: page }) => {
    await page.goto("/resources");
    await expect(page.getByTestId("text-resources-title")).toBeVisible();
  });

  test("AI assistant page", async ({ authedPage: page }) => {
    await page.goto("/assistant");
    await expect(page.getByTestId("text-assistant-title")).toBeVisible();
    await page.getByTestId("input-ai-message").fill("What is SDLT?");
    await page.getByTestId("button-send-message").click();
    await expect(page.locator("[data-testid^='message-']").first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test("immigration iframe loads", async ({ authedPage: page }) => {
    await page.goto("/immigration");
    const frame = page.frameLocator("iframe").first();
    await expect(frame.locator("body")).toBeVisible({ timeout: 20_000 });
  });

  test("immigration AI from browser is disabled", async ({ authedPage: page }) => {
    await page.goto("/immigration");
    const frame = page.frameLocator("iframe").first();
    await expect(frame.locator("body")).toBeVisible({ timeout: 20_000 });
    const src = await page.locator("iframe").first().getAttribute("src");
    expect(src).toBeTruthy();
    const toolRes = await page.request.get(src!.startsWith("http") ? src! : new URL(src!, page.url()).toString());
    expect(toolRes.ok()).toBe(true);
    const html = await toolRes.text();
    expect(html).toContain("blockedImmigrationAi");
    expect(html).not.toMatch(/fetch\(\s*['"]https:\/\/api\.anthropic\.com/);
  });

  test("users page for admin", async ({ authedPage: page }) => {
    await page.goto("/users");
    await expect(page.getByTestId("text-users-title")).toBeVisible({ timeout: 15_000 });
  });

  test("compliance dashboard for admin", async ({ authedPage: page }) => {
    await page.goto("/compliance");
    await expect(page.getByTestId("text-compliance-dashboard-title")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("dashboard overview", async ({ authedPage: page }) => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("text-dashboard-title")).toBeVisible();
  });
});
