import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import config from "../e2e/playwright.config.ts";
import { scanTree } from "../scripts/ci/scan-e2e-artifacts.mjs";

const FAKE_KEY = "fake-report-key-91c4e7";

function retargetReporter(reporter, dir) {
  return reporter.map((entry) => {
    if (!Array.isArray(entry)) return entry;
    const [name, options = {}] = entry;
    if (name === "html")
      return [name, { ...options, outputFolder: join(dir, "playwright-report") }];
    if (name === "json")
      return [name, { ...options, outputFile: join(dir, "playwright-report", "results.json") }];
    if (name === "junit")
      return [name, { ...options, outputFile: join(dir, "playwright-report", "results.xml") }];
    return entry;
  });
}

async function runPlaywright(dir, { reporter, body }) {
  const pageDir = join(dir, "page");
  await mkdir(pageDir, { recursive: true });
  await writeFile(join(pageDir, "index.html"), '<!doctype html><input id="pw" type="password">\n');
  await writeFile(join(dir, "secret.spec.ts"), body);
  const reporterLiteral = JSON.stringify(retargetReporter(reporter, dir));
  await writeFile(
    join(dir, "pw.config.ts"),
    `import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ${JSON.stringify(dir)},
  testMatch: "secret.spec.ts",
  reporter: ${reporterLiteral},
  outputDir: ${JSON.stringify(join(dir, "test-results"))},
  use: { trace: "off", screenshot: "only-on-failure", video: "off" },
});
`,
  );
  const run = spawnSync("npx", ["playwright", "test", "--config", join(dir, "pw.config.ts")], {
    cwd: new URL("..", import.meta.url).pathname,
    encoding: "utf8",
    env: {
      ...process.env,
      NODE_PATH: join(new URL("..", import.meta.url).pathname, "node_modules"),
      PIVOT_FAKE_E2E_SECRET: FAKE_KEY,
      PAGE_URL: `file://${join(pageDir, "index.html")}`,
    },
  });
  return { status: run.status, output: `${run.stdout ?? ""}\n${run.stderr ?? ""}` };
}

describe("Foundry reporter secrets", () => {
  it("ships the Foundry E2E config without an html reporter", () => {
    const names = (config.reporter ?? []).map((entry) => (Array.isArray(entry) ? entry[0] : entry));
    expect(names).not.toContain("html");
  });

  it("keeps a fake key out of the real reporter output when fillSecret sets the field", async () => {
    const dir = await mkdtemp(join(tmpdir(), "e2e-report-"));
    try {
      const helper = new URL("../e2e/helpers/foundry.ts", import.meta.url).pathname;
      const result = await runPlaywright(dir, {
        reporter: config.reporter,
        body: `import { test } from "@playwright/test";
import { fillSecret } from ${JSON.stringify(helper)};
test("seed", async ({ page }) => {
  await page.goto(process.env.PAGE_URL || "");
  const secret = process.env.PIVOT_FAKE_E2E_SECRET || "";
  await fillSecret(page.locator("#pw"), secret);
  const value = await page.locator("#pw").inputValue();
  if (value !== secret) throw new Error("secret field was empty");
});
`,
      });
      expect(result.status).toBe(0);
      expect(result.output).not.toContain(FAKE_KEY);
      expect(scanTree(dir, [FAKE_KEY])).toBeNull();
      await expect(
        readFile(join(dir, "playwright-report", "index.html"), "utf8"),
      ).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("catches locator.fill in an html report after the embedded zip is decoded", async () => {
    const dir = await mkdtemp(join(tmpdir(), "e2e-report-"));
    try {
      const result = await runPlaywright(dir, {
        reporter: [["html", { open: "never" }]],
        body: `import { test } from "@playwright/test";
test("leak", async ({ page }) => {
  await page.goto(process.env.PAGE_URL || "");
  await page.locator("#pw").fill(process.env.PIVOT_FAKE_E2E_SECRET || "");
});
`,
      });
      expect(result.status).toBe(0);
      expect(scanTree(dir, [FAKE_KEY])).toBe("playwright-report/index.html");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
