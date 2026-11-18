import { expect, test } from "@playwright/test";

const CLAIM = "Octopuses have three hearts.";

test.describe("home", () => {
  test("renders the hero, the console and the scoring explanation", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Check the claim.");
    await expect(page.getByRole("heading", { name: "Run a check" })).toBeVisible();
    await expect(page.getByLabel("Claim or question")).toBeVisible();
    await expect(page.getByRole("heading", { name: "How the verdict is scored" })).toBeVisible();
  });

  test("health endpoint reports a provider without leaking secrets", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBe(true);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.status).toBe("ok");
    expect(["mock", "gemini"]).toContain(body.provider);
    expect(JSON.stringify(body).toLowerCase()).not.toContain("apikey");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["content-security-policy"]).toContain("default-src 'self'");
  });

  test("runs a claim end to end and shows an evidence trail", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel("Claim or question").fill(CLAIM);
    // Click the visible label, exactly like a user: the radio itself is
    // `sr-only` so it cannot receive a synthetic pointer click.
    await page.getByText("Quick", { exact: true }).click();
    await expect(page.getByRole("radio", { name: /Quick/ })).toBeChecked();
    await page.getByRole("button", { name: "Check this claim" }).click();

    const reportHeading = page.getByRole("heading", { name: "Verification report" });
    await expect(reportHeading).toBeVisible({ timeout: 45_000 });
    await expect(reportHeading).toBeFocused();

    await expect(page.getByRole("meter")).toHaveAttribute("aria-valuenow", /^\d+$/);
    await expect(page.locator("main")).toContainText(
      /Supported|Contradicted|Mixed evidence|Insufficient evidence/,
    );
    await expect(page.getByRole("heading", { name: "Claim by claim" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();

    const citation = page.getByRole("link", { name: /Photosynthesis|Chlorophyll|Plant/ }).first();
    await expect(citation).toBeVisible();
    await expect(citation).toHaveAttribute("target", "_blank");
    expect(await citation.getAttribute("rel")).toContain("noopener");
  });

  test("validates short input without calling the API", async ({ page }) => {
    await page.goto("/");

    await page.getByLabel("Claim or question").fill("short");
    await page.getByRole("button", { name: "Check this claim" }).click();

    // Next.js renders its own route announcer with role="alert", so scope the
    // query to the inline validation message rather than matching both.
    const error = page.getByRole("alert").filter({ hasText: /at least 8 characters/ });
    await expect(error).toBeVisible();
    await expect(page.getByRole("heading", { name: "Verification report" })).toHaveCount(0);
  });

  test("serves a repeat claim from cache", async ({ request }) => {
    const payload = { claim: CLAIM, depth: "quick" };
    const first = await request.post("/api/research", { data: payload });
    expect(first.ok()).toBe(true);
    expect(await first.text()).toContain('"type":"report"');

    const second = await request.post("/api/research", { data: payload });
    expect(await second.text()).toContain("Served from cache");
  });

  test("rejects non-POST and malformed bodies with a safe error", async ({ request }) => {
    const notAllowed = await request.get("/api/research");
    expect(notAllowed.status()).toBe(405);

    const malformed = await request.post("/api/research", { data: { claim: "short" } });
    expect(malformed.status()).toBe(400);
    const body = (await malformed.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe("INVALID_INPUT");
  });

  test("is operable with the keyboard alone", async ({ page }) => {
    await page.goto("/");

    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeVisible();

    await page.getByLabel("Claim or question").focus();
    await page.keyboard.type(CLAIM);
    await expect(page.getByLabel("Claim or question")).toHaveValue(CLAIM);
  });
});
