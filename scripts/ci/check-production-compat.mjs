// Refuse to promote a package that needs a newer Foundry than the production runtime.
// Run from the directory that holds the candidate system.json.
// Reads PIVOT_PRODUCTION_MANIFEST_URL, falling back to the public production manifest.
import { readFileSync } from "node:fs";

const MAX_FOUNDRY_MAJOR = 14;
const DEFAULT_URL = "https://foundry.angryorcgames.com/systems/pivot-fantasy/system.json";
const url = process.env.PIVOT_PRODUCTION_MANIFEST_URL || DEFAULT_URL;

let data;
try {
  const response = await fetch(url, { signal: globalThis.AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  data = await response.text();
} catch {
  console.error("::error::Could not read the production manifest.");
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
