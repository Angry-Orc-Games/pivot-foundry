import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "../../src");

function typescriptFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...typescriptFiles(path));
    else if (entry.name.endsWith(".ts")) files.push(path);
  }
  return files;
}

function toMessageCalls(text) {
  const calls = [];
  const needle = "toMessage(";
  let start = 0;
  while (start < text.length) {
    const at = text.indexOf(needle, start);
    if (at === -1) break;
    let index = at + needle.length;
    let depth = 1;
    while (index < text.length && depth > 0) {
      if (text[index] === "(") depth += 1;
      else if (text[index] === ")") depth -= 1;
      index += 1;
    }
    calls.push(text.slice(at, index));
    start = index;
  }
  return calls;
}

function passesRollModeToToMessage(call) {
  return (
    /\brollMode\s*:/.test(call) ||
    /["']rollMode["']\s*:/.test(call) ||
    /\{\s*rollMode\s*[,}]/.test(call) ||
    /,\s*rollMode\s*[,}]/.test(call)
  );
}

function usesRemovedRollMode(text) {
  const readsCoreRollMode =
    /["']core["']\s*,\s*["']rollMode["']/.test(text) || /\bcore\.rollMode\b/.test(text);
  return readsCoreRollMode || toMessageCalls(text).some(passesRollModeToToMessage);
}

describe("legacy roll mode", () => {
  it("does not read core.rollMode or pass rollMode to Roll.toMessage", () => {
    const hits = typescriptFiles(SRC).filter((file) =>
      usesRemovedRollMode(readFileSync(file, "utf8")),
    );
    expect(hits).toEqual([]);
  });

  it("flags shorthand and quoted rollMode passed to toMessage", () => {
    expect(passesRollModeToToMessage("toMessage(data, { rollMode })")).toBe(true);
    expect(passesRollModeToToMessage("toMessage(data, { rollMode, create: false })")).toBe(true);
    expect(passesRollModeToToMessage('toMessage(data, { "rollMode": "gm" })')).toBe(true);
    expect(passesRollModeToToMessage("toMessage(data, { messageMode, create: false })")).toBe(
      false,
    );
  });
});
