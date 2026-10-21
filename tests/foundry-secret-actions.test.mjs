import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = new URL("../e2e/", import.meta.url);

function sourceFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.(?:ts|mjs|js)$/.test(name)) out.push(path);
  }
  return out;
}

function recordedSecretCalls(source) {
  const hits = [];
  const pattern =
    /\.(?<method>fill|type|pressSequentially)\s*\((?<args>[^)]*)\)|keyboard\s*\.\s*(?<keyMethod>type|insertText)\s*\((?<keyArgs>[^)]*)\)/g;
  for (const match of source.matchAll(pattern)) {
    const method = match.groups.method || match.groups.keyMethod;
    const args = (match.groups.args ?? match.groups.keyArgs ?? "").trim();
    if (!args) continue;
    if (/^(['"])(?:\\.|(?!\1).)*\1$/.test(args)) continue;
    if (args === "e2eWorldId(") continue;
    const line = source.slice(0, match.index).split("\n").length;
    hits.push(`${method}(${args}) at line ${line}`);
  }
  return hits;
}

describe("recorded Playwright actions", () => {
  it("does not pass a secret variable to fill, type, pressSequentially, or keyboard input", () => {
    const hits = [];
    for (const file of sourceFiles(ROOT.pathname)) {
      const found = recordedSecretCalls(readFileSync(file, "utf8"));
      for (const hit of found) hits.push(`${relative(ROOT.pathname, file)}: ${hit}`);
    }
    expect(hits).toEqual([]);
  });
});
