/**
 * Captures the two screenshots used in the README.
 *
 *   npm run build && npm run start -- --port 3100   # in one shell
 *   npm run screenshot                              # in another
 *
 * Uses the deterministic mock provider, so the capture is reproducible and
 * never depends on a live model or external network.
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const baseURL = process.env.BASE_URL ?? "http://localhost:3100";

await mkdir("docs", { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  colorScheme: "dark",
});

await page.goto(baseURL, { waitUntil: "networkidle" });
await page.screenshot({ path: "docs/screenshot.png" });

await page.getByLabel("Claim or question").fill("Octopuses have three hearts.");
// The radio input is `sr-only`; a real user clicks the label card.
await page.getByText("Quick", { exact: true }).click();
await page.getByRole("button", { name: "Check this claim" }).click();

const heading = page.getByRole("heading", { name: "Verification report" });
await heading.waitFor({ timeout: 60_000 });
await page.waitForTimeout(500);

await heading.scrollIntoViewIfNeeded();
await page.screenshot({ path: "docs/report.png" });

await browser.close();
process.stdout.write("Wrote docs/screenshot.png and docs/report.png\n");
