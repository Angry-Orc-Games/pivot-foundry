import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const script = fileURLToPath(new URL("../../scripts/ci/e2e-overlay.sh", import.meta.url));

const trustedNpmrc = "registry=https://registry.npmjs.org/\n";
const trustedPackage = '{"name":"trusted"}\n';

describe("e2e overlay denylist", () => {
  it("keeps the runner .npmrc and skips npmrc, postcss, and env files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "e2e-overlay-deny-"));
    const runner = join(dir, "runner");
    const system = join(dir, "system");
    await mkdir(runner);
    await mkdir(system);
    try {
      await writeFile(join(runner, ".npmrc"), trustedNpmrc);
      await writeFile(join(runner, "package.json"), trustedPackage);
      await writeFile(join(runner, "stale.txt"), "gone\n");

      await writeFile(join(system, ".npmrc"), "registry=https://evil.example/\n");
      await writeFile(join(system, "postcss.config.js"), "module.exports = {};\n");
      await writeFile(join(system, "postcss.config.cjs"), "module.exports = {};\n");
      await writeFile(join(system, ".env"), "SECRET=from-pr\n");
      await writeFile(join(system, ".env.local"), "SECRET_LOCAL=from-pr\n");
      await writeFile(join(system, "package.json"), '{"name":"untrusted"}\n');
      await writeFile(join(system, "sheet.txt"), "from-pr\n");

      const result = spawnSync("bash", [script, runner, system], { encoding: "utf8" });

      expect(result.status).toBe(0);
      expect(await readFile(join(runner, ".npmrc"), "utf8")).toBe(trustedNpmrc);
      expect(await readFile(join(runner, "package.json"), "utf8")).toBe(trustedPackage);
      expect(await readFile(join(runner, "sheet.txt"), "utf8")).toBe("from-pr\n");
      await expect(readFile(join(runner, "postcss.config.js"), "utf8")).rejects.toThrow();
      await expect(readFile(join(runner, "postcss.config.cjs"), "utf8")).rejects.toThrow();
      await expect(readFile(join(runner, ".env"), "utf8")).rejects.toThrow();
      await expect(readFile(join(runner, ".env.local"), "utf8")).rejects.toThrow();
      await expect(readFile(join(runner, "stale.txt"), "utf8")).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("does not copy nested .npmrc or .env files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "e2e-overlay-deny-"));
    const runner = join(dir, "runner");
    const system = join(dir, "system");
    await mkdir(runner);
    await mkdir(join(system, "nested"), { recursive: true });
    try {
      await writeFile(join(runner, ".npmrc"), trustedNpmrc);
      await writeFile(join(system, "nested", ".npmrc"), "registry=https://evil.example/\n");
      await writeFile(join(system, "nested", ".env.local"), "SECRET=from-pr\n");
      await writeFile(join(system, "nested", "sheet.txt"), "from-pr\n");

      const result = spawnSync("bash", [script, runner, system], { encoding: "utf8" });

      expect(result.status).toBe(0);
      expect(await readFile(join(runner, ".npmrc"), "utf8")).toBe(trustedNpmrc);
      expect(await readFile(join(runner, "nested", "sheet.txt"), "utf8")).toBe("from-pr\n");
      await expect(readFile(join(runner, "nested", ".npmrc"), "utf8")).rejects.toThrow();
      await expect(readFile(join(runner, "nested", ".env.local"), "utf8")).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
