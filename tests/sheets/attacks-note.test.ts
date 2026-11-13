import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("character sheet attacks note", () => {
  it("attacks note does not say exploding dice re-roll once", () => {
    const sheet = readFileSync(
      join(__dirname, "../../templates/actors/character/sheet.hbs"),
      "utf8",
    );
    const lang = JSON.parse(readFileSync(join(__dirname, "../../lang/en.json"), "utf8")) as Record<
      string,
      string
    >;
    const note = lang["PIVOT.Rolls.ExplodingDice"];

    expect(sheet).not.toMatch(/re-rolls once/i);
    expect(sheet).toContain('{{localize "PIVOT.Rolls.ExplodingDice"}}');
    expect(note).toBe("Exploding dice: a natural maximum is rolled again and added, with no cap.");
  });
});
