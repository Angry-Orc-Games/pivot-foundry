// Refuse to promote a package that needs a newer Foundry than the production runtime.
// Run from the directory that holds the candidate system.json.
// Reads PIVOT_PRODUCTION_MANIFEST_URL, falling back to the public production manifest.
import { readFileSync } from "node:fs";

const MAX_FOUNDRY_MAJOR = 14;
// Same fallback as the wait step in promote-production.yml: the job's PIVOT_FOUNDRY_BASE_URL.
const base = process.env.PIVOT_FOUNDRY_BASE_URL;
const url =
  process.env.PIVOT_PRODUCTION_MANIFEST_URL ||
  (base ? `${base}/systems/pivot-fantasy/system.json` : undefined);
if (!url) {
  console.error("::error::Set PIVOT_PRODUCTION_MANIFEST_URL or PIVOT_FOUNDRY_BASE_URL.");
  process.exit(1);
}

let data;
try {
  const response = await fetch(url, {
    redirect: "error",
    signal: globalThis.AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  data = await response.text();
} catch (error) {
  console.error(
    `::error::Could not read the production manifest: ${error.cause?.message ?? error.message}`,
  );
  process.exit(1);
}
if (!data.trim()) {
  console.error("Production manifest was empty.");
  process.exit(1);
}

const current = JSON.parse(data);
const next = JSON.parse(readFileSync("system.json", "utf8"));
const minimum = String(next.compatibility?.minimum ?? "");
const major = minimum.match(/^(\d+)(?:\.\d+)*$/);
if (minimum && (!major || Number(major[1]) > MAX_FOUNDRY_MAJOR)) {
  console.error(
    `Refusing to promote a package that requires Foundry newer than ${MAX_FOUNDRY_MAJOR} without a separate runtime upgrade.`,
  );
  process.exit(4);
}
console.log("Current production package", current.version || "unknown", "->", next.version);
