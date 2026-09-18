import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, renameSync, copyFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { describeUrl } from "./foundry-env.mjs";

export async function sha256File(filePath) {
  const hash = createHash("sha256");
  hash.update(await readFile(filePath));
  return hash.digest("hex");
}

export async function ensureDistribution(paths, result, { requireChecksum = false } = {}) {
  mkdirSync(paths.distDir, { recursive: true });
  const dest = join(paths.distDir, paths.versions.cacheFileName);

  if (!existsSync(dest)) {
    if (result.releaseArchive) {
      console.log(`Copying licensed Foundry archive into ${paths.distDir}.`);
      copyFileSync(result.releaseArchive, dest);
    } else if (result.cacheUrl || result.releaseUrl) {
      const url = result.cacheUrl || result.releaseUrl;
      console.log(`Downloading licensed Foundry archive from ${describeUrl(url)}.`);
      await downloadTo(url, dest);
    } else {
      throw new Error(
        `Missing ${paths.versions.cacheFileName} and no download source is configured.`,
      );
    }
  }

  const digest = await sha256File(dest);
  if (result.releaseSha256) {
    if (digest !== result.releaseSha256.toLowerCase()) {
      const error = new Error(
        `Foundry archive checksum mismatch for ${paths.versions.cacheFileName}. Expected the configured SHA-256.`,
      );
      error.code = "CHECKSUM";
      throw error;
    }
    console.log(`Foundry archive checksum verified (${digest.slice(0, 12)}…).`);
  } else if (requireChecksum) {
    throw new Error("A SHA-256 checksum is required for this provision run.");
  } else {
    console.log(
      `Foundry archive is present. Record SHA-256 ${digest} in FOUNDRY_RELEASE_SHA256 or foundry/versions.json.`,
    );
  }

  return { path: dest, sha256: digest };
}

async function downloadTo(url, dest) {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok || !response.body) {
    throw new Error(`Foundry download failed with status ${response.status}.`);
  }

  const temp = `${dest}.partial`;
  await pipeline(Readable.fromWeb(response.body), createWriteStream(temp));
  renameSync(temp, dest);
}
