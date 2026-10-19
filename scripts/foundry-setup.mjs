import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const SETUP_FAILURE_MESSAGE =
  "Foundry setup failed. The End User License Agreement is on screen. Set FOUNDRY_E2E_ACCEPT_EULA=1 to sign it for this run. Tests were not run.";

export async function handleFoundryEula(page, env = process.env) {
  const checkbox = page.getByRole("checkbox", { name: "I agree to these terms" });
  if (!(await checkbox.isVisible())) return;

  if (env.FOUNDRY_E2E_ACCEPT_EULA !== "1") {
    const marker = env.PIVOT_E2E_SETUP_FAILURE;
    if (typeof marker === "string" && marker) {
      mkdirSync(dirname(marker), { recursive: true });
      writeFileSync(marker, `${SETUP_FAILURE_MESSAGE}\n`);
    }
    const error = new Error(SETUP_FAILURE_MESSAGE);
    error.code = "SETUP";
    throw error;
  }

  await checkbox.check();
  await page.getByRole("button", { name: "Agree", exact: true }).click();
  await page
    .getByRole("heading", { name: "End User License Agreement" })
    .waitFor({ state: "hidden" });
}
