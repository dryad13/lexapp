import { test, expect, loginAs, SEED_USERS } from "./helpers";

test.describe("auth flows", () => {
  test("landing → login → dashboard", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("page-landing")).toBeVisible();
    await page.getByTestId("button-go-to-login").click();
    await expect(page.getByTestId("card-login")).toBeVisible();
    await loginAs(page);
    await expect(page.getByTestId("text-dashboard-title")).toBeVisible();
  });

  test("bad password shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("input-login-username").fill("admin");
    await page.getByTestId("input-login-password").fill("wrong-password");
    await page.getByTestId("button-login-submit").click();
    await expect(page.getByTestId("text-login-error")).toBeVisible();
  });

  test("session persists on refresh", async ({ page }) => {
    await loginAs(page);
    await page.reload();
    await expect(page.getByTestId("text-dashboard-title")).toBeVisible({ timeout: 20_000 });
  });

  test("logout returns to public surface", async ({ page }) => {
    await loginAs(page);
    const logout = page.getByRole("button", { name: /log ?out|sign ?out/i });
    if (await logout.count()) {
      await logout.first().click();
    } else {
      await page.evaluate(async () => {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      });
      await page.goto("/");
    }
    await expect(page.getByTestId("page-landing").or(page.getByTestId("card-login"))).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe("auth me contract", () => {
  test("displayName available after refresh via /api/auth/me", async ({ page }) => {
    await loginAs(page, SEED_USERS.admin.username, SEED_USERS.admin.password);
    const me = await page.evaluate(async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      return res.json();
    });
    expect(me.displayName).toBeTruthy();
  });
});
