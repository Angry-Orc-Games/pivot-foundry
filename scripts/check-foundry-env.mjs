import { readFileSync } from "node:fs";

const envPath = ".env.foundry.local";

function parseEnv(contents) {
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

let env;

try {
  env = parseEnv(readFileSync(envPath, "utf8"));
} catch (error) {
  if (error?.code === "ENOENT") {
    console.error(`Missing ${envPath}. Copy .env.foundry.local.example first.`);
    process.exit(1);
  }

  throw error;
}

const releaseUrl = env.get("FOUNDRY_RELEASE_URL");
const username = env.get("FOUNDRY_USERNAME");
const password = env.get("FOUNDRY_PASSWORD");
const adminKey = env.get("FOUNDRY_ADMIN_KEY");

if (!adminKey || adminKey === "change-me-local-only") {
  console.error("Set FOUNDRY_ADMIN_KEY in .env.foundry.local before starting Foundry.");
  process.exit(1);
}

if (releaseUrl) {
  let url;
  try {
    url = new URL(releaseUrl);
  } catch {
    console.error("FOUNDRY_RELEASE_URL is not a valid URL.");
    process.exit(1);
  }

  const archivePath = decodeURIComponent(url.pathname);

  if (!/\/releases\/13\./.test(archivePath)) {
    console.error("FOUNDRY_RELEASE_URL must point to a Foundry v13 release.");
    process.exit(1);
  }

  if (!/FoundryVTT-Node-13\./.test(archivePath)) {
    console.error("FOUNDRY_RELEASE_URL must use the Foundry v13 Node.js archive.");
    process.exit(1);
  }

  console.log("Foundry env check passed: v13 Node.js timed URL configured.");
  process.exit(0);
}

if (username && password) {
  console.log("Foundry env check passed: account download credentials configured.");
  process.exit(0);
}

console.error("Set either FOUNDRY_RELEASE_URL or both FOUNDRY_USERNAME and FOUNDRY_PASSWORD.");
process.exit(1);
