import { Buffer } from "node:buffer";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const MAX_DEPTH = 8;

export function credentialLeakMessage(relativePath) {
  return `Found a credential in ${relativePath}. Diagnostics were not uploaded.`;
}

function scanError(label) {
  return new Error(`Could not scan ${label}. Diagnostics were not uploaded.`);
}

export function scanTree(root, secrets) {
  const values = secrets.filter((value) => typeof value === "string" && value.length > 0);
  if (values.length === 0) return null;
  return walk(root, root, needleBuffers(values));
}

function needleBuffers(secrets) {
  const needles = [];
  for (const secret of secrets) {
    needles.push(Buffer.from(secret));
    needles.push(Buffer.from(Buffer.from(secret).toString("base64")));
    const encoded = encodeURIComponent(secret);
    if (encoded !== secret) needles.push(Buffer.from(encoded));
  }
  return needles;
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
  let bytes;
  try {
    bytes = readFileSync(dir);
  } catch {
    throw scanError(label);
  }
  if (scanBytes(bytes, needles, label, 0)) return label;
  return null;
}

function containsNeedle(bytes, needles) {
  for (const needle of needles) {
    if (needle.length > 0 && bytes.includes(needle)) return true;
  }
  return false;
}

function isZip(bytes, label) {
  if (label.endsWith(".zip")) return true;
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

function scanBytes(bytes, needles, label, depth) {
  if (depth > MAX_DEPTH) throw scanError(label);
  if (containsNeedle(bytes, needles)) return true;
  if (/\.html?$/i.test(label) && htmlContains(bytes, needles, label, depth)) return true;
  if (isZip(bytes, label)) return zipBytesContain(bytes, needles, label, depth);
  return false;
}

function payloadDelimiter(char) {
  return char === undefined || /["'`<> ,)}\];\\]/.test(char);
}

function readDataPayload(text, start, label) {
  let index = start;
  let body = "";
  while (index < text.length) {
    const char = text[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (/[A-Za-z0-9+/]/.test(char) || char === "=") {
      body += char;
      index += 1;
      continue;
    }
    break;
  }
  if (body.length === 0) {
    if (payloadDelimiter(text[index])) return null;
    throw scanError(label);
  }
  if (body.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(body)) throw scanError(label);
  return Buffer.from(body, "base64");
}

function htmlContains(bytes, needles, label, depth) {
  const text = bytes.toString("latin1");
  const pattern = /data:[^;,\s"']+;base64,/g;
  for (const match of text.matchAll(pattern)) {
    const decoded = readDataPayload(text, match.index + match[0].length, label);
    if (!decoded) continue;
    const inner = isZip(decoded, "") ? `${label}#data.zip` : `${label}#data`;
    if (scanBytes(decoded, needles, inner, depth + 1)) return true;
  }
  return false;
}

function zipBytesContain(bytes, needles, label, depth) {
  const dir = mkdtempSync(join(tmpdir(), "e2e-scan-"));
  const zipPath = join(dir, "blob.zip");
  try {
    writeFileSync(zipPath, bytes);
    let listing;
    try {
      listing = execFileSync("unzip", ["-Z1", zipPath], {
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      throw scanError(label);
    }
    for (const entry of listing.toString("utf8").split("\n")) {
      if (!entry || entry.endsWith("/")) continue;
      let entryBytes;
      try {
        entryBytes = execFileSync("unzip", ["-p", zipPath, entry], {
          stdio: ["ignore", "pipe", "ignore"],
          maxBuffer: 32 * 1024 * 1024,
        });
      } catch {
        throw scanError(label);
      }
      if (scanBytes(entryBytes, needles, entry, depth + 1)) return true;
    }
    return false;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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
