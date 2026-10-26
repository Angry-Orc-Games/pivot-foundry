import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  containerStartupProblem,
  describeStartupFailure,
  prepareDataDir,
  waitForHttp,
} from "../scripts/foundry-compose.mjs";
import { createPrivilegeDouble, removeSandbox } from "./helpers/privilege-double.mjs";

const abortLog = [
  "Volume write test failed.",
  "Volume read test failed.",
  "Aborting due to insufficient permissions on /data",
  "Container running as uid:gid: 1000:1000",
  "FOUNDRY_LICENSE_KEY=super-secret-license",
].join("\n");

describe("Foundry data directory", () => {
  it("creates the bind mount and chowns it to 1000:1000", () => {
    const calls = [];
    prepareDataDir("/tmp/pivot-foundry-data", {
      execFileSync(command, args) {
        calls.push([command, ...args]);
      },
      statSync() {
        return { uid: 1001, gid: 1001 };
      },
    });

    expect(calls).toEqual([
      ["mkdir", "-p", "/tmp/pivot-foundry-data"],
      ["chown", "-R", "1000:1000", "/tmp/pivot-foundry-data"],
    ]);
  });

  it("uses sudo only when chown is not permitted", () => {
    const calls = [];
    prepareDataDir("/tmp/pivot-foundry-data", {
      execFileSync(command, args) {
        calls.push([command, ...args]);
        if (command === "chown") {
          const error = new Error("Operation not permitted");
          error.status = 1;
          error.stderr = "chown: changing ownership: Operation not permitted";
          throw error;
        }
      },
      statSync() {
        return { uid: 1001, gid: 121 };
      },
    });

    expect(calls.at(-1)).toEqual([
      "sudo",
      "-n",
      "chown",
      "-R",
      "1000:1000",
      "/tmp/pivot-foundry-data",
    ]);
    expect(calls.filter((call) => call[0] === "sudo")).toHaveLength(1);
  });

  it("does not chown a directory that is already 1000:1000", () => {
    const calls = [];
    prepareDataDir("/tmp/pivot-foundry-data", {
      execFileSync(command, args) {
        calls.push([command, ...args]);
      },
      statSync() {
        return { uid: 1000, gid: 1000 };
      },
    });

    expect(calls.map((call) => call[0])).toEqual(["mkdir"]);
  });
});

describe("Foundry startup abort", () => {
  it("names a permissions abort without copying secrets from the log", () => {
    expect(describeStartupFailure(abortLog, "running 0")).toBe(
      "Foundry container aborted: insufficient permissions on /data",
    );
    expect(describeStartupFailure(abortLog, "running 0")).not.toContain("super-secret-license");
    expect(describeStartupFailure("still booting", "running 0")).toBeNull();
    expect(describeStartupFailure("", "exited 1")).toMatch(/stopped/);
  });

  it("reads the abort from docker logs", async () => {
    const root = await mkdtemp(join(tmpdir(), "pivot-docker-"));
    const bin = join(root, "bin");
    await spawnSync("mkdir", ["-p", bin]);
    const stub = `#!/bin/sh
if [ "$1" = "logs" ]; then
  printf '%s\\n' "Volume write test failed."
  printf '%s\\n' "Aborting due to insufficient permissions on /data"
  exit 0
fi
if [ "$1" = "inspect" ]; then
  printf '%s\\n' "running 0"
  exit 0
fi
exit 1
`;
    await writeFile(join(bin, "docker"), stub);
    await chmod(join(bin, "docker"), 0o755);
    const previous = process.env.PATH;
    process.env.PATH = `${bin}:${previous}`;
    try {
      expect(containerStartupProblem({ role: "e2e", instanceId: "perm" })).toBe(
        "Foundry container aborted: insufficient permissions on /data",
      );
    } finally {
      process.env.PATH = previous;
    }
  });

  it("stops the http wait immediately and leaves a non-timeout error", async () => {
    const started = Date.now();
    let error;
    try {
      await waitForHttp("http://127.0.0.1:1/", 3_000, {
        inspect: () => describeStartupFailure(abortLog, "running 0"),
      });
    } catch (caught) {
      error = caught;
    }

    expect(error?.code).toBe("STARTUP_FAILED");
    expect(error?.message).toMatch(/insufficient permissions on \/data/);
    expect(error?.message).not.toContain("super-secret-license");
    expect(Date.now() - started).toBeLessThan(800);
  });
});

describe("chowned Foundry data", () => {
  it("does not grant privilege outside the temp sandbox", () => {
    const root = mkdtempSync(join(tmpdir(), "pivot-priv-guard-"));
    const hosts = statSync("/etc/hosts");
    const privilege = createPrivilegeDouble(root);
    expect(() =>
      privilege.execFileSync("sudo", ["-n", "chown", "0:0", "/etc/hosts"], { stdio: "ignore" }),
    ).toThrow(/outside sandbox/);
    const after = statSync("/etc/hosts");
    expect(after.mtimeMs).toBe(hosts.mtimeMs);
    expect(after.mode).toBe(hosts.mode);
    expect(after.uid).toBe(hosts.uid);
    expect(after.gid).toBe(hosts.gid);
    removeSandbox(root);
  });

  it("replaces a chowned packaged system and removes the data dir afterward", async () => {
    const { installPackagedSystem, removeFoundryTree } =
      await import("../scripts/foundry-compose.mjs");
    const root = await mkdtemp(join(tmpdir(), "pivot-data-lock-"));
    const privilege = createPrivilegeDouble(root);
    const dataDir = join(root, "foundry-data");
    const systemsDir = join(dataDir, "Data", "systems");
    const systemDir = join(systemsDir, "pivot-fantasy");
    const zipDir = join(root, "zip-src");
    const zipPath = join(root, "system.zip");
    mkdirSync(systemDir, { recursive: true });
    await writeFile(join(systemDir, "old.txt"), "stale");
    mkdirSync(zipDir, { recursive: true });
    await writeFile(join(zipDir, "system.json"), '{"id":"pivot-fantasy","title":"replaced"}\n');
    execFileSync("zip", ["-q", zipPath, "system.json"], { cwd: zipDir });
    chmodSync(systemDir, 0o555);
    chmodSync(systemsDir, 0o555);

    try {
      installPackagedSystem({ foundryData: dataDir }, zipPath, {
        execFileSync: privilege.execFileSync,
      });
      expect(readFileSync(join(systemDir, "system.json"), "utf8")).toContain('"title":"replaced"');
      expect(existsSync(join(systemDir, "old.txt"))).toBe(false);
      chmodSync(dataDir, 0o555);
      removeFoundryTree(dataDir, { execFileSync: privilege.execFileSync });
      expect(existsSync(dataDir)).toBe(false);
    } finally {
      removeSandbox(root);
    }
  });

  it("repairs ownership after a privileged unzip when the data dir is already 1000", async () => {
    const { installPackagedSystem } = await import("../scripts/foundry-compose.mjs");
    const root = await mkdtemp(join(tmpdir(), "pivot-data-owner-"));
    const privilege = createPrivilegeDouble(root);
    const io = { execFileSync: privilege.execFileSync, statSync: privilege.statSync };
    const dataDir = join(root, "foundry-data");
    const systemsDir = join(dataDir, "Data", "systems");
    const systemDir = join(systemsDir, "pivot-fantasy");
    const zipDir = join(root, "zip-src");
    const zipPath = join(root, "system.zip");
    const outside = join(root, "outside.txt");
    mkdirSync(join(zipDir, "packs"), { recursive: true });
    mkdirSync(systemDir, { recursive: true });
    await writeFile(join(zipDir, "system.json"), '{"id":"pivot-fantasy"}\n');
    await writeFile(join(zipDir, "packs", "module.json"), "{}\n");
    await writeFile(outside, "keep");
    execFileSync("zip", ["-q", "-r", zipPath, "system.json", "packs"], { cwd: zipDir });
    privilege.execFileSync("sudo", ["-n", "chown", "0:0", outside], { stdio: "ignore" });
    chmodSync(systemDir, 0o555);
    chmodSync(systemsDir, 0o555);

    try {
      installPackagedSystem({ foundryData: dataDir }, zipPath, io);
      prepareDataDir(dataDir, io);
      const systemFile = privilege.statSync(join(systemDir, "system.json"));
      const nested = privilege.statSync(join(systemDir, "packs", "module.json"));
      expect(systemFile.uid).toBe(1000);
      expect(systemFile.gid).toBe(1000);
      expect(nested.uid).toBe(1000);
      expect(nested.gid).toBe(1000);
      expect(privilege.statSync(outside).uid).toBe(0);
      expect(privilege.statSync(dataDir).uid).toBe(1000);
    } finally {
      removeSandbox(root);
    }
  });
});
