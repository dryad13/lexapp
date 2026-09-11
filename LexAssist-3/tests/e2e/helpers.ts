import { test as base, expect, type Page } from "@playwright/test";

export const SEED_USERS = {
  admin: { username: "admin", password: "admin12", role: "admin" },
  feeEarner: { username: "hasinah.ahmed", password: "Ahmed12", role: "fee_earner" },
  readOnly: { username: "readonly", password: "Readonly12", role: "read_only" },
  otherAdmin: { username: "other.admin", password: "Other12", role: "admin" },
} as const;

export { expect };

export async function loginAs(
  page: Page,
  username = SEED_USERS.admin.username,
  password = SEED_USERS.admin.password,
) {
  await page.goto("/login");
  await page.getByTestId("input-login-username").fill(username);
  await page.getByTestId("input-login-password").fill(password);
  await page.getByTestId("button-login-submit").click();
  await expect(page.getByTestId("text-dashboard-title")).toBeVisible({ timeout: 20_000 });
}

export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    await loginAs(page);
    await use(page);
  },
});
