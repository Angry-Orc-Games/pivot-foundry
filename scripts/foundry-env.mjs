import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repoRoot = fileURLToPath(new URL("..", import.meta.url));
export const FOUNDRY_ENV_FILE = ".env.foundry.local";
export const SYSTEM_ID = "pivot-fantasy";
export const SYSTEM_LINK_ENTRIES = ["system.json", "dist", "lang", "packs", "styles", "templates"];
export const RETIRED_DATA_DIRS = ["foundry-app", "foundry-data"];
export const PERSISTENT_DATA_DIR = "foundry-data-v14";
export const DIST_DIR_NAME = "foundry-dist";
export const INSTANCE_ROOT_NAME = ".foundry";

export const EXIT = {
  ok: 0,
  usage: 2,
  credentials: 3,
  version: 4,
  runtime: 5,
  identity: 6,
  tests: 7,
  unsafe: 8,
  timeout: 10,
};

const SECRET_KEYS = [
  "FOUNDRY_ADMIN_KEY",
  "FOUNDRY_LICENSE_KEY",
  "FOUNDRY_RELEASE_URL",
  "FOUNDRY_RELEASE_ARCHIVE",
  "FOUNDRY_RELEASE_SHA256",
  "FOUNDRY_RELEASE_CACHE_URL",
];

export function loadVersions(root = repoRoot) {
  return JSON.parse(readFileSync(join(root, "foundry", "versions.json"), "utf8"));
}

export function pinnedImageRef(versions) {
  return `${versions.container.image}:${versions.container.tag}@${versions.container.digest}`;
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

export function loadFoundryEnv(envPath, processEnv = process.env) {
  const values = new Map();

  if (envPath && existsSync(envPath)) {
    for (const [key, value] of parseEnv(readFileSync(envPath, "utf8"))) {
      values.set(key, value);
    }
  }

  for (const key of SECRET_KEYS) {
    if (processEnv[key]) values.set(key, processEnv[key]);
  }

  if (values.size === 0 && envPath && !existsSync(envPath)) {
    const missing = new Error(
      `Missing ${FOUNDRY_ENV_FILE} and no FOUNDRY_* process environment. Copy .env.foundry.local.example first.`,
    );
    missing.code = "ENOENT";
    throw missing;
  }

  return values;
}

export function describeUrl(raw) {
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}/<redacted>`;
  } catch {
    return "<invalid-url>";
  }
}

export function slug(value) {
  const normalized = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return normalized || "local";
}

export function resolveRole(processEnv = process.env) {
  const role = processEnv.PIVOT_FOUNDRY_ROLE || "dev";
  if (role !== "dev" && role !== "e2e") {
    throw new Error("PIVOT_FOUNDRY_ROLE must be 'dev' or 'e2e'.");
  }
  return role;
}

export function resolveTarget(processEnv = process.env) {
  return processEnv.PIVOT_FOUNDRY_TARGET || "local";
}

export function resolveInstanceId({
  role = "dev",
  root = repoRoot,
  processEnv = process.env,
} = {}) {
  if (processEnv.PIVOT_FOUNDRY_INSTANCE) {
    return slug(processEnv.PIVOT_FOUNDRY_INSTANCE);
  }

  if (processEnv.GITHUB_RUN_ID) {
    return slug(`gha-${role}-${processEnv.GITHUB_RUN_ID}-${processEnv.GITHUB_RUN_ATTEMPT || "1"}`);
  }

  const agent = processEnv.CURSOR_CONVERSATION_ID || processEnv.CURSOR_REQUEST_ID;
  const cwdHash = createHash("sha256").update(resolve(root)).digest("hex").slice(0, 8);
  if (agent) {
    return slug(`${role}-${String(agent).slice(0, 8)}-${cwdHash}`);
  }

  return slug(`${role}-${cwdHash}`);
}

export function createFoundryPaths({
  root = repoRoot,
  role = "dev",
  instanceId,
  processEnv = process.env,
} = {}) {
  const versions = loadVersions(root);
  const id = instanceId || resolveInstanceId({ role, root, processEnv });
  const instanceRoot = join(root, INSTANCE_ROOT_NAME, "instances", id);
  const persistentData = processEnv.PIVOT_FOUNDRY_DATA_DIR
    ? resolve(processEnv.PIVOT_FOUNDRY_DATA_DIR)
    : role === "dev"
      ? join(root, PERSISTENT_DATA_DIR)
      : join(instanceRoot, "data");

  return {
    root,
    versions,
    role,
    instanceId: id,
    envFile: processEnv.FOUNDRY_ENV_PATH || join(root, FOUNDRY_ENV_FILE),
    distDir: processEnv.PIVOT_FOUNDRY_DIST_DIR
      ? resolve(processEnv.PIVOT_FOUNDRY_DIST_DIR)
      : join(root, DIST_DIR_NAME),
    foundryData: persistentData,
    instanceRoot,
    runtimeFile: join(instanceRoot, "runtime.json"),
    composeEnvFile: join(instanceRoot, "compose.env"),
    diagnosticsDir: join(instanceRoot, "diagnostics"),
    retiredDirs: RETIRED_DATA_DIRS.map((name) => join(root, name)),
    composeFile: join(root, "foundry", "compose.yml"),
    composeDevFile: join(root, "foundry", "compose.dev.yml"),
  };
}

export function composeNames(paths) {
  const project = `pivot-${paths.role}-${paths.instanceId}`.replace(/[^a-z0-9-]/g, "");
  return {
    project,
    container: `${project}-foundry`.slice(0, 63),
    hostname: `${project}-host`.slice(0, 63),
  };
}

export function validateReleaseUrl(releaseUrl, versions) {
  let url;
  try {
    url = new URL(releaseUrl);
  } catch {
    return "FOUNDRY_RELEASE_URL is not a valid URL.";
  }

  const archivePath = decodeURIComponent(url.pathname);

  if (!/\/releases\/14\./.test(archivePath) && !archivePath.includes(versions.foundryVersion)) {
    return "FOUNDRY_RELEASE_URL must point to a Foundry v14 release.";
  }

  if (!/FoundryVTT-Node-14\./.test(archivePath) && !/foundryvtt-14\./.test(archivePath)) {
    return "FOUNDRY_RELEASE_URL must use the Foundry v14 Node.js archive.";
  }

  return null;
}

export function validateReleaseArchive(archivePath, versions) {
  if (!existsSync(archivePath)) {
    return "FOUNDRY_RELEASE_ARCHIVE does not exist.";
  }

  const name = basename(archivePath);
  if (!/FoundryVTT-Node-14\./.test(name) && name !== versions.cacheFileName) {
    return `FOUNDRY_RELEASE_ARCHIVE must be ${versions.archiveFileName} or ${versions.cacheFileName}.`;
  }

  return null;
}

export function cacheReady(distDir, versions) {
  return existsSync(join(distDir, versions.cacheFileName));
}

export function resolveReleaseSha256(env, versions, processEnv = process.env) {
  return (
    env.get("FOUNDRY_RELEASE_SHA256") ||
    processEnv.FOUNDRY_RELEASE_SHA256 ||
    versions.releaseSha256 ||
    ""
  );
}

export function validateFoundryEnv(env, options = {}) {
  const versions = options.versions || loadVersions(options.root || repoRoot);
  const errors = [];
  const warnings = [];
  const adminKey = env.get("FOUNDRY_ADMIN_KEY");
  const releaseUrl = env.get("FOUNDRY_RELEASE_URL");
  const releaseArchive = env.get("FOUNDRY_RELEASE_ARCHIVE");
  const cacheUrl = env.get("FOUNDRY_RELEASE_CACHE_URL");
  const cached = options.cacheReady === true;

  if (!adminKey || adminKey === "change-me-local-only") {
    errors.push("Set FOUNDRY_ADMIN_KEY in .env.foundry.local or the process environment.");
  }

  if (releaseUrl) {
    const urlError = validateReleaseUrl(releaseUrl, versions);
    if (urlError) errors.push(urlError);
  }

  if (releaseArchive) {
    const archiveError = validateReleaseArchive(releaseArchive, versions);
    if (archiveError) errors.push(archiveError);
  }

  if (env.get("FOUNDRY_USERNAME") || env.get("FOUNDRY_PASSWORD")) {
    warnings.push(
      "FOUNDRY_USERNAME/FOUNDRY_PASSWORD are ignored. Use a private archive cache and FOUNDRY_LICENSE_KEY.",
    );
  }

  if (!cached && !releaseUrl && !releaseArchive && !cacheUrl) {
    errors.push(
      `Provide ${versions.cacheFileName} in foundry-dist/, FOUNDRY_RELEASE_ARCHIVE, FOUNDRY_RELEASE_CACHE_URL, or FOUNDRY_RELEASE_URL.`,
    );
  }

  if (options.requireLicense && !env.get("FOUNDRY_LICENSE_KEY")) {
    errors.push("FOUNDRY_LICENSE_KEY is required for unattended setup and E2E.");
  }

  if (options.requireChecksum && !resolveReleaseSha256(env, versions, options.processEnv)) {
    errors.push(
      "Set FOUNDRY_RELEASE_SHA256 or foundry/versions.json releaseSha256 before CI provision.",
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    adminKey,
    releaseUrl,
    releaseArchive,
    cacheUrl,
    licenseKey: env.get("FOUNDRY_LICENSE_KEY"),
    releaseSha256: resolveReleaseSha256(env, versions, options.processEnv),
    versions,
  };
}

const PRODUCTION_HOSTS = ["foundry.angryorcgames.com"];
const STAGING_HOSTS = ["build.angryorcgames.com"];

export function assertSafeTarget({ target, baseUrl, destructive = false, reset = false } = {}) {
  const hostname = safeHostname(baseUrl);
  const isProduction = target === "production" || (hostname && PRODUCTION_HOSTS.includes(hostname));
  const isStaging = target === "staging" || (hostname && STAGING_HOSTS.includes(hostname));

  if ((destructive || reset) && isProduction) {
    const error = new Error(
      "Refusing destructive Foundry tests or resets against production (https://foundry.angryorcgames.com).",
    );
    error.code = "UNSAFE_TARGET";
    throw error;
  }

  if (reset && isStaging && target !== "e2e") {
    const error = new Error(
      "Refusing to reset the shared staging server. Reset only a designated local/E2E world.",
    );
    error.code = "UNSAFE_TARGET";
    throw error;
  }

  return { hostname, isProduction, isStaging };
}

export function safeHostname(baseUrl) {
  if (!baseUrl) return "";
  try {
    return new URL(baseUrl).hostname;
  } catch {
    return "";
  }
}

export function retiredLocations(root = repoRoot) {
  return RETIRED_DATA_DIRS.map((name) => ({
    name,
    path: join(root, name),
    present: existsSync(join(root, name)),
  }));
}
