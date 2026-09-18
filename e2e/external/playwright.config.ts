import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PIVOT_FOUNDRY_BASE_URL || "";
const target = process.env.PIVOT_FOUNDRY_TARGET || "";

if (!baseURL) {
  throw new Error("PIVOT_FOUNDRY_BASE_URL is required for external smoke tests.");
}

if (target === "production" || /foundry\.angryorcgames\.com$/i.test(new URL(baseURL).hostname)) {
  if (process.env.PIVOT_E2E_DESTRUCTIVE === "1") {
    throw new Error("Destructive tests cannot run against production.");
  }
}

if (target !== "staging" && target !== "production") {
  throw new Error("External smoke tests require PIVOT_FOUNDRY_TARGET=staging or production.");
}

export default defineConfig({
  testDir: "./",
  testMatch: target === "production" ? "production.smoke.spec.ts" : "staging.smoke.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  reporter: [["list"]],
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
