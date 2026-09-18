import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PIVOT_FOUNDRY_BASE_URL || "http://127.0.0.1:30000";
const target = process.env.PIVOT_FOUNDRY_TARGET || "e2e";

if (
  process.env.PIVOT_E2E_DESTRUCTIVE === "1" &&
  /foundry\.angryorcgames\.com$/i.test(new URL(baseURL).hostname)
) {
  throw new Error("Destructive Playwright tests cannot target production.");
}

if (target === "production" && process.env.PIVOT_E2E_DESTRUCTIVE === "1") {
  throw new Error("Destructive Playwright tests cannot use PIVOT_FOUNDRY_TARGET=production.");
}

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  forbidOnly: !!process.env.CI,
  reporter: [["list"], ["html", { open: "never", outputFolder: "../playwright-report" }]],
  outputDir: "../test-results",
  use: {
    baseURL,
    browserName: "chromium",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    ignoreHTTPSErrors: false,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
