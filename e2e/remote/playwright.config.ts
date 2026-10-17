import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PIVOT_FOUNDRY_BASE_URL || "http://localhost:30002";

export default defineConfig({
  testDir: "./",
  testMatch: "remote.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  reporter: [["list"], ["html", { outputFolder: "playwright-report" }]],
  use: {
    baseURL,
    browserName: "chromium",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ignoreHTTPSErrors: false,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
