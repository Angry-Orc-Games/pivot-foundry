import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "../../src");

function typescriptFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...typescriptFiles(path));
    else if (entry.name.endsWith(".ts")) files.push(path);
  }
  return files;
}

describe("legacy roll mode", () => {
  it("does not read core.rollMode or pass rollMode to Roll.toMessage", () => {
    const hits = typescriptFiles(SRC).filter((file) =>
      /\brollMode\b/.test(readFileSync(file, "utf8")),
    );
    expect(hits).toEqual([]);
  });
});
