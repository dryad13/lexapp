import { test, expect, loginAs, SEED_USERS } from "./helpers";

test.describe("hardening: cookie sessions", () => {
  test("login sets session cookie and does not rely on localStorage bearer", async ({ page, context }) => {
    await loginAs(page);

    const cookies = await context.cookies();
    const sid = cookies.find((c) => c.name === "lexassist.sid");
    expect(sid, "lexassist.sid cookie should be set").toBeTruthy();
    expect(sid!.httpOnly).toBe(true);

    const tokenInStorage = await page.evaluate(() => localStorage.getItem("conveyflow_auth_token"));
    expect(tokenInStorage).toBeNull();

    await page.goto("/matters");
    await expect(page.getByTestId("text-matters-title")).toBeVisible({ timeout: 20_000 });
  });

  test("session cookie survives refresh; /api/auth/me returns displayName", async ({ page }) => {
    await loginAs(page, SEED_USERS.admin.username, SEED_USERS.admin.password);
    await page.reload();
    await expect(page.getByTestId("text-dashboard-title")).toBeVisible({ timeout: 20_000 });

    const me = await page.evaluate(async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      return { status: res.status, body: await res.json() };
    });
    expect(me.status).toBe(200);
    expect(me.body.authenticated).toBe(true);
    expect(me.body.displayName).toBeTruthy();
  });

  test("journal PDF export uses async job flow", async ({ page }) => {
    await loginAs(page);
    await page.goto("/journal");
    await expect(page.getByRole("heading", { name: /reflective journal/i })).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: /export pdf/i }).click();
    const downloadPromise = page.waitForEvent("download", { timeout: 45_000 });
    await page.getByRole("button", { name: /^download pdf$/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  });
});
