import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { loadVersions, repoRoot } from "./foundry-env.mjs";

export function fileSha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

export function currentCommit(root = repoRoot) {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return process.env.GITHUB_SHA || "unknown";
  }
}

export function writeArtifactIdentity(root = repoRoot, extra = {}) {
  const zipPath = join(root, "system.zip");
  const manifest = JSON.parse(readFileSync(join(root, "system.json"), "utf8"));
  const versions = loadVersions(root);
  if (!existsSync(zipPath)) {
    throw new Error("system.zip is required before writing artifact identity.");
  }

  const identity = {
    schemaVersion: 1,
    packageId: manifest.id,
    packageVersion: manifest.version,
    commit: currentCommit(root),
    artifact: {
      file: "system.zip",
      sha256: fileSha256(zipPath),
    },
    foundry: {
      version: versions.foundryVersion,
      image: `${versions.container.image}:${versions.container.tag}@${versions.container.digest}`,
    },
    createdAt: new Date().toISOString(),
    ...extra,
  };

  const output = join(root, "artifact-identity.json");
  writeFileSync(output, `${JSON.stringify(identity, null, 2)}\n`);
  return identity;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const identity = writeArtifactIdentity();
  console.log(`Wrote artifact-identity.json for ${identity.commit} ${identity.artifact.sha256}`);
}
