import { Buffer } from "node:buffer";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

export function credentialLeakMessage(relativePath) {
  return `Found a credential in ${relativePath}. Diagnostics were not uploaded.`;
}

export function scanTree(root, secrets) {
  const needles = secrets.filter((value) => typeof value === "string" && value.length > 0);
  if (needles.length === 0) return null;
  return walk(root, root, needles);
}

function walk(root, dir, needles) {
  let stat;
  try {
    stat = statSync(dir);
  } catch {
    return null;
  }
  if (stat.isDirectory()) {
    for (const name of readdirSync(dir)) {
      const hit = walk(root, join(dir, name), needles);
      if (hit) return hit;
    }
    return null;
  }
  if (!stat.isFile()) return null;
  const label = relative(root, dir);
  if (dir.endsWith(".zip")) {
    if (zipContains(label, dir, needles)) return label;
    return null;
  }
  if (containsNeedle(readFileSync(dir), needles)) return label;
  return null;
}

function containsNeedle(bytes, needles) {
  for (const needle of needles) {
    if (bytes.includes(Buffer.from(needle))) return true;
  }
  return false;
}

function zipContains(label, zipPath, needles) {
  let listing;
  try {
    listing = execFileSync("unzip", ["-Z1", zipPath], {
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    throw new Error(`Could not scan ${label}. Diagnostics were not uploaded.`);
  }
  for (const entry of listing.toString("utf8").split("\n")) {
    if (!entry || entry.endsWith("/")) continue;
    let bytes;
    try {
      bytes = execFileSync("unzip", ["-p", zipPath, entry], {
        stdio: ["ignore", "pipe", "ignore"],
        maxBuffer: 32 * 1024 * 1024,
      });
    } catch {
      throw new Error(`Could not scan ${label}. Diagnostics were not uploaded.`);
    }
    if (containsNeedle(bytes, needles)) return true;
  }
  return false;
}

function secretsFromEnv(env) {
  return [env.FOUNDRY_ADMIN_KEY, env.FOUNDRY_LICENSE_KEY].filter(
    (value) => typeof value === "string" && value.length > 0,
  );
}

export function scanRoots(roots, env = process.env) {
  const secrets = secretsFromEnv(env);
  if (secrets.length === 0) {
    return { missingKeys: true, hit: null };
  }
  for (const root of roots) {
    const hit = scanTree(root, secrets);
    if (hit) return { missingKeys: false, hit: join(root, hit) };
  }
  return { missingKeys: false, hit: null };
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invoked) {
  let result;
  try {
    result = scanRoots(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Credential scan failed.";
    process.stderr.write(`::error::${message}\n`);
    process.exit(1);
  }
  if (result.missingKeys) {
    process.stderr.write(
      "::error::Credential scan had no admin or license key to search for. Diagnostics were not uploaded.\n",
    );
    process.exit(1);
  }
  if (result.hit) {
    process.stderr.write(`::error::${credentialLeakMessage(result.hit)}\n`);
    process.exit(1);
  }
}
