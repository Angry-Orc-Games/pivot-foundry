import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { validate } from "../../src/import/pivot-character";
import { derive } from "./fixtures/pivot-chargen-c39605e/index";

// Real pivot-chargen #47 witness.
// Source: Angry-Orc-Games/pivot-chargen, branch cursor/module-scaffold-ci-c630,
// commit c39605e17648a316cf8d00b34e80a7ee66fcfecf.
// Vendored unmodified packages/rules/src/book.js (git blob 4a4c9bacbee2897097612aafe60940e04f54a859).
// derive() is that commit's api.derive: createSession(choices, false).derive().
const SAMPLES = [
  "human-veteran.pivot.json",
  "elf-street-mage.pivot.json",
  "dwarf-recluse.pivot.json",
  "custom-humanoid.pivot.json",
] as const;

describe("pivot-chargen #47 witness", () => {
  it.each(SAMPLES)("%s gives zero field warnings when the real module is active", (name) => {
    const file = JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
    const result = validate(file, { rederive: derive });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings?.filter((warning) => warning.code === "tampered")).toEqual([]);
    expect(result.warnings).toEqual([
      {
        code: "unverifiable",
        message: "Not checked against the character generator.",
      },
    ]);
  });
});
