import { readFile, writeFile } from "node:fs/promises";

const manifestPath = new URL("../system.json", import.meta.url);
const tagName = process.env.GITHUB_REF_NAME;

if (!tagName) {
  throw new Error("GITHUB_REF_NAME is required to prepare release metadata.");
}

if (!tagName.startsWith("v")) {
  throw new Error(`Release tag must start with "v": ${tagName}`);
}

const version = tagName.slice(1);

if (!/^[0-9]+[.][0-9]+[.][0-9]+(?:[-.+][0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Release tag must be a semantic version, such as v0.1.0: ${tagName}`);
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

if (typeof manifest.url !== "string" || !manifest.url.includes("/pivot-foundry")) {
  throw new Error("system.json url must point at the pivot-foundry GitHub repository.");
}

manifest.version = version;
manifest.manifest = `${manifest.url}/releases/latest/download/system.json`;
manifest.download = `${manifest.url}/releases/download/${tagName}/system.zip`;

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
