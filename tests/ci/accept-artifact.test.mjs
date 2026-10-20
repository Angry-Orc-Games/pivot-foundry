import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { spawnSync } from "node:child_process";

const script = fileURLToPath(new URL("../../scripts/ci/accept-artifact.sh", import.meta.url));
const files = ["artifact-identity.json", "system.json", "system.zip"];

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "accept-artifact-"));
  const src = join(dir, "artifact");
  const dest = join(dir, "harness");
  await mkdir(src);
  return { dir, src, dest };
}

function accept(src, dest, names = files) {
  return spawnSync("bash", [script, src, dest, ...names], { encoding: "utf8" });
}

describe("accept-artifact", () => {
  it("copies exactly the expected regular files", async () => {
    const ctx = await fixture();
    for (const name of files) await writeFile(join(ctx.src, name), name);
    const result = accept(ctx.src, ctx.dest);
    expect(result.status).toBe(0);
    const copied = await Promise.all(files.map(async (name) => read(join(ctx.dest, name))));
    await rm(ctx.dir, { recursive: true, force: true });

    expect(copied).toEqual(files);
  });

  it("rejects an extra file", async () => {
    const ctx = await fixture();
    for (const name of files) await writeFile(join(ctx.src, name), name);
    await mkdir(join(ctx.src, "scripts"));
    await writeFile(join(ctx.src, "scripts", "deploy-package.mjs"), "pwned");
    const result = accept(ctx.src, ctx.dest);
    await rm(ctx.dir, { recursive: true, force: true });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("does not match");
  });

  it("rejects a symlink in the expected set", async () => {
    const ctx = await fixture();
    await writeFile(join(ctx.src, "system.json"), "{}");
    await writeFile(join(ctx.src, "artifact-identity.json"), "{}");
    await symlink("/etc/passwd", join(ctx.src, "system.zip"));
    const result = accept(ctx.src, ctx.dest);
    await rm(ctx.dir, { recursive: true, force: true });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("not a regular file");
  });

  it("rejects a directory where a file is required", async () => {
    const ctx = await fixture();
    await mkdir(join(ctx.src, "system.json"));
    await writeFile(join(ctx.src, "system.zip"), "zip");
    await writeFile(join(ctx.src, "artifact-identity.json"), "{}");
    const result = accept(ctx.src, ctx.dest);
    await rm(ctx.dir, { recursive: true, force: true });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("not a regular file");
  });
});

function read(path) {
  return import("node:fs/promises").then((fs) => fs.readFile(path, "utf8"));
}
