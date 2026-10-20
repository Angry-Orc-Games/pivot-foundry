import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { part7SkillCatalog } from "../../src/rules/part7-skills";

describe("Part 7 skills", () => {
  it("diffs the catalog against the book skill list", () => {
    const book = JSON.parse(
      readFileSync(join(__dirname, "../fixtures/part7-skills.json"), "utf8"),
    ) as unknown;
    expect(part7SkillCatalog()).toEqual(book);
  });
});
