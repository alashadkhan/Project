import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const CLAIM = "Octopuses have three hearts.";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * Runs an axe scan and returns only violations that must block a release.
 * `serious` and `critical` are the gate; `minor` and `moderate` are reported by
 * the HTML report for triage but do not fail the pipeline.
 */
async function blockingViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();

  return results.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => {
      const targets = violation.nodes.map((node) => node.target.join(" ")).join(", ");
      return `${violation.id} (${violation.impact}): ${violation.help} → ${targets}`;
    });
}

test.describe("accessibility", () => {
  test("home page has no serious or critical WCAG violations", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    expect(await blockingViolations(page)).toEqual([]);
  });

  test("report view has no serious or critical WCAG violations", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel("Claim or question").fill(CLAIM);
    // The radio input is `sr-only`; a real user clicks the label card.
    await page.getByText("Quick", { exact: true }).click();
    await expect(page.getByRole("radio", { name: /Quick/ })).toBeChecked();
    await page.getByRole("button", { name: "Check this claim" }).click();

    await expect(page.getByRole("heading", { name: "Verification report" })).toBeVisible({
      timeout: 45_000,
    });

    expect(await blockingViolations(page)).toEqual([]);
  });

  test("exposes the verdict, confidence and citations to assistive technology", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel("Claim or question").fill(CLAIM);
    // The radio input is `sr-only`; a real user clicks the label card.
    await page.getByText("Quick", { exact: true }).click();
    await expect(page.getByRole("radio", { name: /Quick/ })).toBeChecked();
    await page.getByRole("button", { name: "Check this claim" }).click();

    const meter = page.getByRole("meter");
    await expect(meter).toBeVisible({ timeout: 45_000 });
    await expect(meter).toHaveAttribute("aria-label", "Confidence in this verdict");
    await expect(meter).toHaveAttribute("aria-valuetext", /percent confidence$/);

    const progress = page.getByRole("list", { name: "Agent pipeline progress" });
    await expect(progress).toBeVisible();

    // Every external citation must announce that it opens a new tab.
    const externalLinks = page.locator('a[target="_blank"]');
    const count = await externalLinks.count();
    expect(count).toBeGreaterThan(0);

    for (let index = 0; index < count; index += 1) {
      const link = externalLinks.nth(index);
      const name = (await link.textContent()) ?? "";
      expect(name).toContain("opens in a new tab");
    }
  });
});
