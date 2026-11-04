import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { preflightScript } from "../scripts/deploy-preflight.mjs";

function run(options) {
  return spawnSync("sh", ["-s"], { input: preflightScript(options), encoding: "utf8" });
}

describe("deploy preflight", () => {
  it("passes when every directory is writable", () => {
    const root = mkdtempSync(join(tmpdir(), "preflight-"));
    mkdirSync(join(root, "Data"));
    mkdirSync(join(root, "Backups"));
    const result = run({
      targetDir: join(root, "Data", "pivot"),
      backupDir: join(root, "Backups"),
      tmpDir: root,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("preflight ok");
  });

  it("reports every problem in one run", () => {
    const root = mkdtempSync(join(tmpdir(), "preflight-"));
    mkdirSync(join(root, "Data"));
    mkdirSync(join(root, "Backups"));
    chmodSync(join(root, "Backups"), 0o555);
    const result = run({
      targetDir: join(root, "Missing", "pivot"),
      backupDir: join(root, "Backups"),
      tmpDir: join(root, "no-tmp"),
    });
    chmodSync(join(root, "Backups"), 0o755);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Missing does not exist");
    expect(result.stderr).toContain("Backups is not writable");
    expect(result.stderr).toContain("no-tmp does not exist");
  });
});
