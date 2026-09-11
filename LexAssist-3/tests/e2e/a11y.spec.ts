import AxeBuilder from "@axe-core/playwright";
import { test, expect, loginAs } from "./helpers";

/** Brand palette contrast is tracked separately; G7 gates name/label/structure rules. */
function axe(page: Parameters<typeof AxeBuilder>[0]["page"]) {
  return new AxeBuilder({ page }).disableRules(["color-contrast"]);
}

test.describe("a11y (G7)", () => {
  test("login page has no serious/critical axe violations", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByTestId("card-login")).toBeVisible();
    const results = await axe(page).analyze();
    const bad = results.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact || ""),
    );
    expect(bad, JSON.stringify(bad, null, 2)).toEqual([]);
  });

  test("dashboard and matters have no serious/critical axe violations", async ({ page }) => {
    await loginAs(page);
    await expect(page.getByTestId("text-dashboard-title")).toBeVisible();
    await expect(page.getByTestId("text-stat-active-matters")).toBeVisible({ timeout: 20_000 });
    const dash = await axe(page).analyze();
    const dashBad = dash.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact || ""),
    );
    expect(dashBad, JSON.stringify(dashBad, null, 2)).toEqual([]);

    await page.goto("/matters");
    await expect(page.getByTestId("text-matters-title")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("button-view-grid")).toBeVisible();
    const matters = await axe(page).analyze();
    const mattersBad = matters.violations.filter((v) =>
      ["serious", "critical"].includes(v.impact || ""),
    );
    expect(mattersBad, JSON.stringify(mattersBad, null, 2)).toEqual([]);
  });
});
