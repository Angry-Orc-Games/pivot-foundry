import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("..", import.meta.url));
export const FOUNDRY_ENV_FILE = ".env.foundry.local";
export const FOUNDRY_PORT = 30000;
export const SYSTEM_ID = "pivot-fantasy";
export const SYSTEM_LINK_ENTRIES = ["system.json", "dist", "lang", "packs", "styles", "templates"];

export function createFoundryPaths(root = repoRoot) {
  return {
    root,
    envFile: process.env.FOUNDRY_ENV_PATH || join(root, FOUNDRY_ENV_FILE),
    foundryApp: process.env.PIVOT_FOUNDRY_APP_DIR || join(root, "foundry-app"),
    foundryData: process.env.PIVOT_FOUNDRY_DATA_DIR || join(root, "foundry-data"),
  };
}

export function parseEnv(contents) {
  const values = new Map();

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values.set(key, value);
  }

  return values;
}

export function loadFoundryEnv(envPath) {
  try {
    return parseEnv(readFileSync(envPath, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") {
      const missing = new Error(
        `Missing ${FOUNDRY_ENV_FILE}. Copy .env.foundry.local.example first.`,
      );
      missing.code = "ENOENT";
      throw missing;
    }

    throw error;
  }
}

export function resolveFoundryEntry(foundryAppDir) {
  for (const name of ["main.js", "main.mjs"]) {
    if (existsSync(join(foundryAppDir, name))) {
      return name;
    }
  }

  return null;
}

export function isFoundryInstalled(foundryAppDir) {
  return resolveFoundryEntry(foundryAppDir) !== null;
}

export function validateReleaseUrl(releaseUrl) {
  let url;
  try {
    url = new URL(releaseUrl);
  } catch {
    return "FOUNDRY_RELEASE_URL is not a valid URL.";
  }

  const archivePath = decodeURIComponent(url.pathname);

  if (!/\/releases\/14\./.test(archivePath)) {
    return "FOUNDRY_RELEASE_URL must point to a Foundry v14 release.";
  }

  if (!/FoundryVTT-Node-14\./.test(archivePath)) {
    return "FOUNDRY_RELEASE_URL must use the Foundry v14 Node.js archive.";
  }

  return null;
}

export function validateReleaseArchive(archivePath) {
  if (!existsSync(archivePath)) {
    return "FOUNDRY_RELEASE_ARCHIVE does not exist.";
  }

  try {
    if (!statSync(archivePath).isFile()) {
      return "FOUNDRY_RELEASE_ARCHIVE must be a zip file.";
    }
  } catch {
    return "FOUNDRY_RELEASE_ARCHIVE is not readable.";
  }

  if (!/FoundryVTT-Node-14\./.test(basename(archivePath))) {
    return "FOUNDRY_RELEASE_ARCHIVE must be a Foundry v14 Node.js zip (FoundryVTT-Node-14.*).";
  }

  return null;
}

export function validateFoundryEnv(env, { foundryInstalled }) {
  const errors = [];
  const adminKey = env.get("FOUNDRY_ADMIN_KEY");
  const releaseUrl = env.get("FOUNDRY_RELEASE_URL");
  const releaseArchive = env.get("FOUNDRY_RELEASE_ARCHIVE");

  if (!adminKey || adminKey === "change-me-local-only") {
    errors.push("Set FOUNDRY_ADMIN_KEY in .env.foundry.local before starting Foundry.");
  }

  if (releaseUrl) {
    const urlError = validateReleaseUrl(releaseUrl);
    if (urlError) errors.push(urlError);
  }

  if (releaseArchive) {
    const archiveError = validateReleaseArchive(releaseArchive);
    if (archiveError) errors.push(archiveError);
  }

  if (!foundryInstalled && !releaseUrl && !releaseArchive) {
    errors.push(
      "Set FOUNDRY_RELEASE_URL or FOUNDRY_RELEASE_ARCHIVE to install the Foundry v14 Node.js zip.",
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    adminKey,
    releaseUrl,
    releaseArchive,
    licenseKey: env.get("FOUNDRY_LICENSE_KEY"),
    foundryNode: env.get("FOUNDRY_NODE"),
  };
}
