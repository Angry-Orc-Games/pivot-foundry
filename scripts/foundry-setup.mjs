import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const SETUP_FAILURE_MESSAGE =
  "Foundry setup failed. The End User License Agreement is on screen. Set FOUNDRY_E2E_ACCEPT_EULA=1 to sign it for this run. Tests were not run.";

const SCREEN_TIMEOUT_MS = 15_000;

function firstScreen(entries, timeout) {
  return new Promise((resolve, reject) => {
    let pending = entries.length;
    let settled = false;
    const fail = () => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timer);
      const error = new Error(
        "Foundry setup did not show the license agreement or the setup screen.",
      );
      error.code = "SETUP";
      reject(error);
    };
    const timer = globalThis.setTimeout(fail, timeout);
    for (const [name, locator] of entries) {
      Promise.resolve()
        .then(() => locator.waitFor({ state: "visible", timeout }))
        .then(() => {
          if (settled) return;
          settled = true;
          globalThis.clearTimeout(timer);
          resolve(name);
        })
        .catch(() => {
          pending -= 1;
          if (!settled && pending === 0) fail();
        });
    }
  });
}

export async function handleFoundryEula(page, env = process.env) {
  const checkbox = page.getByRole("checkbox", { name: "I agree to these terms" });
  const screen = await firstScreen(
    [
      ["eula", checkbox],
      ["setup", page.getByRole("button", { name: /create world|new world/i })],
      ["setup", page.getByRole("heading", { name: "Setup", exact: true })],
    ],
    SCREEN_TIMEOUT_MS,
  );
  if (screen !== "eula") return;

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
