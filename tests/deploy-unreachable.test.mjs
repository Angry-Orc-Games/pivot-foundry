import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clearTimeout, setTimeout } from "node:timers";
import { describe, expect, it } from "vitest";

import { fileSha256 } from "../scripts/artifact-identity.mjs";

// 10.255.255.1 is a non-routable address: connections to it are dropped, never refused, so without
// ConnectTimeout ssh hangs until the CI job timeout (QA on PR #211). Real ssh, no network side effects.
const BLACKHOLE = "10.255.255.1";
const BOUND_MS = 30_000;

function deployTo(host, extraEnv = {}) {
  const dir = mkdtempSync(join(tmpdir(), "deploy-unreachable-"));
  const zipPath = join(dir, "system.zip");
  writeFileSync(zipPath, "not a real package");
  const identityPath = join(dir, "artifact-identity.json");
  writeFileSync(
    identityPath,
    JSON.stringify({
      packageId: "pivot-fantasy",
      packageVersion: "0.0.0-test",
      artifact: { sha256: fileSha256(zipPath) },
    }),
  );
  // Only what the script needs: no real deploy secrets or keys reach the child.
  const env = {
    PATH: process.env.PATH,
    HOME: dir,
    FOUNDRY_DEPLOY_SSH_HOST: host,
    FOUNDRY_DEPLOY_SSH_USER: "deploy",
    FOUNDRY_DEPLOY_TARGET_DIR: "/srv/foundry/Data/systems/pivot-fantasy",
    FOUNDRY_DEPLOY_BACKUP_DIR: "/srv/foundry/backups",
    FOUNDRY_DEPLOY_SERVICE: "foundry",
    ...extraEnv,
  };
  const started = Date.now();
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      ["scripts/deploy-package.mjs", "staging", identityPath, zipPath],
      { env, stdio: ["ignore", "pipe", "pipe"], detached: true },
    );
    let stderr = "";
    child.stderr.on("data", (chunk) => (stderr += chunk));
    // A regression must fail this test, not hang the suite: kill the script and its ssh together.
    const kill = setTimeout(() => process.kill(-child.pid, "SIGKILL"), BOUND_MS + 2_000);
    child.on("close", (status, signal) => {
      clearTimeout(kill);
      resolve({ status, signal, stderr, elapsedMs: Date.now() - started });
    });
  });
}

describe("deploy to an unreachable host", () => {
  it(
    "fails within the bound with 'cannot reach <host>' and a non-zero exit",
    async () => {
      const result = await deployTo(BLACKHOLE, { PIVOT_DEPLOY_SSH_CONNECT_TIMEOUT: "2" });
      expect(result.signal).toBeNull();
      expect(result.status).toBe(5); // EXIT.runtime
      expect(result.stderr).toContain(`cannot reach ${BLACKHOLE}`);
      expect(result.stderr).toContain("Nothing was uploaded");
      expect(result.elapsedMs).toBeLessThanOrEqual(BOUND_MS);
    },
    BOUND_MS + 10_000,
  );

  it(
    "uses a connect timeout inside the bound by default",
    async () => {
      const result = await deployTo(BLACKHOLE);
      expect(result.signal).toBeNull();
      expect(result.status).toBe(5);
      expect(result.stderr).toContain(`cannot reach ${BLACKHOLE}`);
      expect(result.stderr).toContain("within 15s");
      expect(result.elapsedMs).toBeLessThanOrEqual(BOUND_MS);
    },
    BOUND_MS + 10_000,
  );
});
