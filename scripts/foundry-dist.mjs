import { Buffer } from "node:buffer";
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

const MAX_RELEASE_REDIRECTS = 5;

function releaseRequest(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Foundry download URL is invalid.");
  }

  let username;
  let password;
  try {
    username = decodeURIComponent(parsed.username);
    password = decodeURIComponent(parsed.password);
  } catch {
    throw new Error(`Foundry download URL is invalid for ${describeUrl(rawUrl)}.`);
  }

  parsed.username = "";
  parsed.password = "";
  const headers = {};
  if (username !== "" || password !== "") {
    headers.authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  }
  return { url: parsed.href, headers };
}

function nextReleaseRequest(currentUrl, headers, location) {
  let next;
  try {
    next = new URL(location, currentUrl);
  } catch {
    throw new Error(`Foundry download redirect is invalid for ${describeUrl(currentUrl)}.`);
  }

  const current = new URL(currentUrl);
  if (current.protocol === "https:" && next.protocol === "http:") {
    throw new Error(
      `Foundry download refused an https to http redirect for ${describeUrl(currentUrl)}.`,
    );
  }

  next.username = "";
  next.password = "";
  const nextHeaders = {};
  if (next.origin === current.origin && headers.authorization) {
    nextHeaders.authorization = headers.authorization;
  }
  return { url: next.href, headers: nextHeaders };
}

export async function downloadTo(url, dest, fetchImpl = fetch) {
  let request = releaseRequest(url);

  for (let followed = 0; ; followed += 1) {
    let response;
    try {
      response = await fetchImpl(request.url, {
        redirect: "manual",
        headers: request.headers,
      });
    } catch {
      throw new Error(`Foundry download failed for ${describeUrl(request.url)}.`);
    }

    if (
      response.status === 301 ||
      response.status === 302 ||
      response.status === 303 ||
      response.status === 307 ||
      response.status === 308
    ) {
      if (followed >= MAX_RELEASE_REDIRECTS) {
        throw new Error(
          `Foundry download exceeded ${MAX_RELEASE_REDIRECTS} redirects for ${describeUrl(request.url)}.`,
        );
      }
      const location = response.headers.get("location");
      if (!location) {
        throw new Error(
          `Foundry download redirect is missing a location for ${describeUrl(request.url)}.`,
        );
      }
      request = nextReleaseRequest(request.url, request.headers, location);
      continue;
    }

    if (!response.ok || !response.body) {
      throw new Error(
        `Foundry download failed with status ${response.status} for ${describeUrl(request.url)}.`,
      );
    }

    const temp = `${dest}.partial`;
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temp));
    renameSync(temp, dest);
    return;
  }
}
