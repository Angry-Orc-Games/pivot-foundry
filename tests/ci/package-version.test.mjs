import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const script = fileURLToPath(new URL("../../scripts/ci/package-version.sh", import.meta.url));

async function versionOf(manifest) {
  const dir = await mkdtemp(join(tmpdir(), "package-version-"));
  const file = join(dir, "system.json");
  await writeFile(file, manifest);
  const result = spawnSync("bash", [script, file], { encoding: "utf8" });
  await rm(dir, { recursive: true, force: true });
  return result;
}

describe("package version", () => {
  it.each(["0.1.0", "1.2.3", "1.2.3-rc.1", "1.2.3+build.5", "1.2.3-rc.1+build.5"])(
    "prints %s from system.json",
    async (version) => {
      const result = await versionOf(JSON.stringify({ version }));

      expect(result.status).toBe(0);
      expect(result.stdout).toBe(`${version}\n`);
    },
  );

  it.each(["", "1.2", "latest", "v0.1.0", "../system", "0.1.0\n1.2.3"])(
    "rejects %j",
    async (version) => {
      const result = await versionOf(JSON.stringify({ version }));

      expect(result.status).not.toBe(0);
      expect(result.stdout).toBe("");
    },
  );

  it("rejects a missing version", async () => {
    const result = await versionOf("{}\n");

    expect(result.status).not.toBe(0);
    expect(result.stdout).toBe("");
  });
});
