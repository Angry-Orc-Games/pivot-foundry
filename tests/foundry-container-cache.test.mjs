import { cp, mkdir, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { writeComposeEnv } from "../scripts/foundry-compose.mjs";
import { createFoundryPaths } from "../scripts/foundry-env.mjs";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

describe("writable Foundry release cache", () => {
  it("copies the verified zip into a 1000:1000 directory and mounts that", async () => {
    const { prepareContainerCache } = await import("../scripts/foundry-compose.mjs");
    expect(typeof prepareContainerCache).toBe("function");

    const root = await mkdtemp(join(tmpdir(), "pivot-cache-"));
    await mkdir(join(root, "foundry"), { recursive: true });
    await cp(join(repoRoot, "foundry", "versions.json"), join(root, "foundry", "versions.json"));
    const paths = createFoundryPaths({
      root,
      role: "e2e",
      instanceId: "cache",
      processEnv: {},
    });
    const cacheDir = join(paths.instanceRoot, "container-cache");
    const zipName = paths.versions.cacheFileName;
    const source = join(paths.distDir, zipName);
    const calls = [];
    const copies = [];

    prepareContainerCache(paths, {
      existsSync(path) {
        return path === source;
      },
      copyFileSync(from, to) {
        copies.push([from, to]);
      },
      execFileSync(command, args) {
        calls.push([command, ...args]);
      },
      statSync() {
        return { uid: 1001, gid: 1001 };
      },
    });

    expect(copies).toEqual([[source, join(cacheDir, zipName)]]);
    expect(calls).toEqual([
      ["mkdir", "-p", cacheDir],
      ["chown", "-R", "1000:1000", cacheDir],
    ]);
    expect(calls.some((call) => call.includes(paths.distDir))).toBe(false);
  });

  it("mounts the writable copy and leaves the built dist mount read-only", async () => {
    const root = await mkdtemp(join(tmpdir(), "pivot-cache-mount-"));
    await mkdir(join(root, "foundry"), { recursive: true });
    await cp(join(repoRoot, "foundry", "versions.json"), join(root, "foundry", "versions.json"));
    const paths = createFoundryPaths({
      root,
      role: "e2e",
      instanceId: "cache",
      processEnv: {},
    });
    const cacheDir = join(paths.instanceRoot, "container-cache");

    writeComposeEnv(paths, { adminKey: "local-admin", licenseKey: "" }, { port: 30000 });
    const env = await readFile(paths.composeEnvFile, "utf8");
    expect(env).toContain(`PIVOT_FOUNDRY_CONTAINER_CACHE=${cacheDir}`);
    expect(env).not.toContain(`PIVOT_FOUNDRY_DIST_DIR=${paths.distDir}`);

    const compose = await readFile(join(repoRoot, "foundry", "compose.yml"), "utf8");
    const cacheAt = compose.indexOf("target: /opt/foundry-dist");
    const cacheMount = compose.slice(Math.max(0, cacheAt - 120), cacheAt + 40);
    expect(cacheMount).toContain("source: ${PIVOT_FOUNDRY_CONTAINER_CACHE}");
    expect(cacheMount).not.toContain("read_only: true");

    const dev = await readFile(join(repoRoot, "foundry", "compose.dev.yml"), "utf8");
    const distAt = dev.indexOf("${PIVOT_REPO_ROOT}/dist");
    const distMount = dev.slice(distAt, distAt + 160);
    expect(distMount).toContain("target: /data/Data/systems/pivot-fantasy/dist");
    expect(distMount).toContain("read_only: true");
  });
});
