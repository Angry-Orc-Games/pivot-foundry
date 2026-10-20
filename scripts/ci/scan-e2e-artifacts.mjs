import { Buffer } from "node:buffer";
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
  const bytes = readFileSync(dir);
  for (const needle of needles) {
    if (bytes.includes(Buffer.from(needle))) return relative(root, dir);
  }
  return null;
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
  const result = scanRoots(process.argv.slice(2));
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
