import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end configuration.
 *
 * The suite runs against `next dev` with the deterministic mock provider, so it
 * needs no API key and no network access to Wikipedia or Gemini. That keeps CI
 * fast and makes failures reproducible.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
// Use `localhost`, not `127.0.0.1`: Next.js treats a different host as a
// cross-origin dev request and blocks its own dev resources.
const ORIGIN = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: ORIGIN,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Set E2E_CHANNEL=msedge (or chrome) to reuse an installed browser
        // instead of Playwright's bundled Chromium.
        ...(process.env.E2E_CHANNEL ? { channel: process.env.E2E_CHANNEL } : {}),
      },
    },
  ],
  webServer: {
    // Test the production build, not the dev server: it is what ships, and it
    // avoids Turbopack/HMR differences between local runs and CI.
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `${ORIGIN}/api/health`,
    // Reuse a server you already started, but beware: it must have been started
    // with the env below (notably RATE_LIMIT_MAX). A server started with the
    // default limit of 8 will answer 429 after the sixth claim and every
    // report-flow test will time out. Kill it if in doubt.
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      AI_PROVIDER: "mock",
      NEXT_TELEMETRY_DISABLED: "1",
      // The suite makes several runs from one IP; keep the limiter out of the way.
      RATE_LIMIT_MAX: "100",
    },
  },
});
