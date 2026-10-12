#!/usr/bin/env node
/**
 * Verify that all localization keys referenced in code and templates
 * exist in lang/en.json to prevent raw keys from showing in the UI.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const referencedKeys = new Set();

/**
 * Extract localization keys from Handlebars templates.
 */
function extractFromTemplate(content) {
  // Match {{localize "KEY"}} and {{localize 'KEY'}}
  const doubleQuotedMatches = content.matchAll(/\{\{localize\s+"([^"]+)"/g);
  for (const match of doubleQuotedMatches) {
    referencedKeys.add(match[1]);
  }

  const singleQuotedMatches = content.matchAll(/\{\{localize\s+'([^']+)'/g);
  for (const match of singleQuotedMatches) {
    referencedKeys.add(match[1]);
  }
}

/**
 * Extract localization keys from TypeScript/JavaScript.
 */
function extractFromTS(content) {
  // Match "PIVOT.*" or "TYPES.*" string literals
  const stringMatches = content.matchAll(/"((?:PIVOT|TYPES)\.[^"]+)"/g);
  for (const match of stringMatches) {
    referencedKeys.add(match[1]);
  }

  // Match game.i18n.localize("KEY")
  const i18nMatches = content.matchAll(/game\.i18n\.localize\s*\(\s*"([^"]+)"/g);
  for (const match of i18nMatches) {
    referencedKeys.add(match[1]);
  }
}

/**
 * Recursively scan a directory for files with the given extensions.
 */
function scanDir(dir, extensions) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory() && !file.startsWith(".") && file !== "node_modules") {
      scanDir(fullPath, extensions);
    } else if (stat.isFile()) {
      const ext = path.extname(file);
      if (extensions.includes(ext)) {
        const content = fs.readFileSync(fullPath, "utf8");
        if (ext === ".hbs") {
          extractFromTemplate(content);
        } else {
          extractFromTS(content);
        }
      }
    }
  }
}

// Scan source and templates
scanDir(path.join(ROOT, "src"), [".ts", ".js"]);
scanDir(path.join(ROOT, "templates"), [".hbs"]);

// Load the English localization file
const langPath = path.join(ROOT, "lang", "en.json");
const langFile = JSON.parse(fs.readFileSync(langPath, "utf8"));
const definedKeys = new Set(Object.keys(langFile));

// Find missing keys
const missing = [];
for (const key of referencedKeys) {
  if (!definedKeys.has(key)) {
    missing.push(key);
  }
}

// Report results
if (missing.length > 0) {
  console.error("\n❌ Missing localization keys in lang/en.json:\n");
  for (const key of missing.sort()) {
    console.error(`  - ${key}`);
  }
  console.error(
    `\n${missing.length} key(s) missing. Add them to lang/en.json to fix this error.\n`,
  );
  process.exit(1);
} else {
  console.log("✅ All localization keys are defined in lang/en.json");
  process.exit(0);
}
