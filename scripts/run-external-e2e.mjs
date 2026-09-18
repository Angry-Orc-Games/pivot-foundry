import { execFileSync } from "node:child_process";

import { EXIT, assertSafeTarget, repoRoot } from "./foundry-env.mjs";

const target = process.argv[2] || process.env.PIVOT_FOUNDRY_TARGET;
if (target !== "staging" && target !== "production") {
  console.error("Usage: node scripts/run-external-e2e.mjs <staging|production>");
  process.exit(EXIT.usage);
}

const baseUrl =
  process.env.PIVOT_FOUNDRY_BASE_URL ||
  (target === "production"
    ? "https://foundry.angryorcgames.com"
    : "https://build.angryorcgames.com");

assertSafeTarget({
  target,
  baseUrl,
  destructive: false,
  reset: false,
});

if (process.env.PIVOT_E2E_DESTRUCTIVE === "1") {
  console.error("External smoke tests refuse PIVOT_E2E_DESTRUCTIVE=1.");
  process.exit(EXIT.unsafe);
}

execFileSync("npx", ["playwright", "test", "--config", "e2e/external/playwright.config.ts"], {
  cwd: repoRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    PIVOT_FOUNDRY_TARGET: target,
    PIVOT_FOUNDRY_BASE_URL: baseUrl,
    PIVOT_E2E_DESTRUCTIVE: "0",
  },
});
