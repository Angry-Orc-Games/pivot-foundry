import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { EXIT, assertSafeTarget, repoRoot } from "./foundry-env.mjs";
import { fileSha256 } from "./artifact-identity.mjs";
import { preflightScript } from "./deploy-preflight.mjs";

const target = process.argv[2] || process.env.PIVOT_DEPLOY_TARGET;
const identityPath = process.argv[3] || join(repoRoot, "artifact-identity.json");
const zipPath = process.argv[4] || join(repoRoot, "system.zip");

if (target !== "staging" && target !== "production") {
  console.error(
    "Usage: node scripts/deploy-package.mjs <staging|production> [identity.json] [system.zip]",
  );
  process.exit(EXIT.usage);
}

assertSafeTarget({
  target,
  baseUrl: process.env.PIVOT_DEPLOY_PUBLIC_URL,
  destructive: false,
  reset: false,
});

if (target === "production" && process.env.PIVOT_ALLOW_PRODUCTION_DEPLOY !== "1") {
  console.error(
    "Production deploy requires PIVOT_ALLOW_PRODUCTION_DEPLOY=1 from the approval workflow.",
  );
  process.exit(EXIT.unsafe);
}

if (!existsSync(identityPath) || !existsSync(zipPath)) {
  console.error("Both artifact-identity.json and system.zip are required.");
  process.exit(EXIT.identity);
}

const identity = JSON.parse(readFileSync(identityPath, "utf8"));
const sha256 = fileSha256(zipPath);
if (identity.artifact?.sha256 !== sha256) {
  console.error("system.zip SHA-256 does not match artifact-identity.json. Refusing to deploy.");
  process.exit(EXIT.identity);
}

if (target === "production") {
  const recorded = process.env.PIVOT_STAGING_ARTIFACT_SHA256 || "";
  if (!/^[0-9a-f]{64}$/.test(recorded) || recorded !== sha256) {
    console.error(
      "Production promotion requires the staging run's recorded SHA-256 for this exact system.zip.",
    );
    process.exit(EXIT.identity);
  }
}

const host = requiredSecret("FOUNDRY_DEPLOY_SSH_HOST");
const user = requiredSecret("FOUNDRY_DEPLOY_SSH_USER");
const targetDir = requiredSecret("FOUNDRY_DEPLOY_TARGET_DIR");
const backupDir = requiredSecret("FOUNDRY_DEPLOY_BACKUP_DIR");
const service = requiredSecret("FOUNDRY_DEPLOY_SERVICE");
const key = process.env.FOUNDRY_DEPLOY_SSH_KEY;
const publicUrl = process.env.PIVOT_DEPLOY_PUBLIC_URL || "";

if (!host || !user || !targetDir || !backupDir || !service) {
  console.error(
    "Missing deploy secrets. Configure FOUNDRY_DEPLOY_SSH_HOST, FOUNDRY_DEPLOY_SSH_USER, FOUNDRY_DEPLOY_TARGET_DIR, FOUNDRY_DEPLOY_BACKUP_DIR, and FOUNDRY_DEPLOY_SERVICE on the GitHub Environment. Do not infer these from the public application URL.",
  );
  process.exit(EXIT.credentials);
}

if (process.env.PIVOT_DEPLOY_DRY_RUN === "1") {
  console.log(
    `Dry run: would deploy ${identity.packageId} ${identity.packageVersion} (${sha256}) to ${target}.`,
  );
  process.exit(EXIT.ok);
}

const keyFile = join(tmpdir(), `pivot-deploy-${process.pid}.key`);
if (key) {
  mkdirSync(tmpdir(), { recursive: true });
  writeFileSync(keyFile, `${key.endsWith("\n") ? key : `${key}\n`}`, { mode: 0o600 });
}

// scp and ssh share the same options: a fresh CI runner has no known_hosts, so scp must also accept
// a new host key instead of failing with "Host key verification failed".
const sshOptions = ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new"];
const ssh = ["ssh", ...sshOptions];
if (key) ssh.push("-i", keyFile);
const remote = `${user}@${host}`;
const stamp = new Date().toISOString().replaceAll(/[:.]/g, "");
const backup = `${backupDir}/pivot-fantasy-${stamp}`;
// A unique name per run: a fixed /tmp path can be left behind by another user and then cannot be overwritten.
const remoteZip = `/tmp/pivot-fantasy-system-${stamp}.zip`;

try {
  execFileSync(ssh[0], [...ssh.slice(1), remote, "sh", "-s"], {
    input: preflightScript({ targetDir, backupDir }),
    stdio: ["pipe", "inherit", "inherit"],
  });
  execFileSync(
    "scp",
    [...sshOptions, ...(key ? ["-i", keyFile] : []), zipPath, `${remote}:${remoteZip}`],
    {
      stdio: "inherit",
    },
  );
  execFileSync(
    ssh[0],
    [
      ...ssh.slice(1),
      remote,
      [
        "set -euo pipefail",
        `mkdir -p ${shellQuote(backupDir)}`,
        `if [ -d ${shellQuote(targetDir)} ]; then mv ${shellQuote(targetDir)} ${shellQuote(backup)}; fi`,
        `mkdir -p ${shellQuote(targetDir)}`,
        `unzip -q -o ${shellQuote(remoteZip)} -d ${shellQuote(targetDir)}`,
        `rm -f ${shellQuote(remoteZip)}`,
        `test -f ${shellQuote(`${targetDir}/system.json`)}`,
        `systemctl restart ${shellQuote(service)}`,
      ].join(" && "),
    ],
    { stdio: "inherit" },
  );
} finally {
  if (key) {
    try {
      writeFileSync(keyFile, "");
    } catch {
      // The key file lives in the runner tmpdir and is emptied even if unlink fails.
    }
  }
}

identity[target] = {
  result: "deployed",
  sha256,
  publicUrl,
  at: new Date().toISOString(),
  commit: identity.commit,
};
writeFileSync(identityPath, `${JSON.stringify(identity, null, 2)}\n`);
console.log(`Deployed ${identity.packageVersion} (${sha256}) to ${target}. Backup ${backup}.`);

function requiredSecret(name) {
  return process.env[name] || "";
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}
