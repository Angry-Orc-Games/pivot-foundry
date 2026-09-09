import { describe, expect, it } from "vitest";

import packSource from "../../packs/src/items.json";
import exampleKeenSenses from "../../src/content/items/features/example-keen-senses.json";
import {
  generateContentPackDocuments,
  validateContentCatalog,
  validateContentRecord,
} from "../../src/rules/content";

describe("validateContentRecord", () => {
  it("accepts the example pipeline fixture", () => {
    expect(validateContentRecord(exampleKeenSenses)).toMatchObject({
      contentId: "example-keen-senses",
      type: "feature",
      system: {
        schemaVersion: 1,
        effects: [{ type: "skillBonus", skill: "perception", amount: 2 }],
      },
    });
  });

  it("rejects unknown keys, types, HTML, URLs, and formulas", () => {
    expect(() => validateContentRecord({ ...exampleKeenSenses, extra: true })).toThrow(
      /Unexpected keys/,
    );
    expect(() => validateContentRecord({ ...exampleKeenSenses, type: "npc" })).toThrow(
      /Unknown item type/,
    );
    expect(() =>
      validateContentRecord({
        ...exampleKeenSenses,
        system: { ...exampleKeenSenses.system, notes: "<script>alert(1)</script>" },
      }),
    ).toThrow(/HTML or URLs/);
    expect(() =>
      validateContentRecord({
        ...exampleKeenSenses,
        img: "https://evil.example/icon.png",
      }),
    ).toThrow(/relative Foundry icon path/);
    expect(() =>
      validateContentRecord({
        ...exampleKeenSenses,
        system: {
          ...exampleKeenSenses.system,
          effects: [{ type: "acBonus", amount: 1, formula: "1d4" }],
        },
      }),
    ).toThrow(/Unexpected keys/);
  });
});

describe("validateContentCatalog", () => {
  it("rejects duplicate contentId values", () => {
    expect(() => validateContentCatalog([exampleKeenSenses, exampleKeenSenses])).toThrow(
      /Duplicate contentId/,
    );
  });
});

describe("generateContentPackDocuments", () => {
  it("is deterministic and matches the committed pack source artifact", () => {
    const catalog = validateContentCatalog([exampleKeenSenses]);
    const generated = generateContentPackDocuments(catalog);
    const again = generateContentPackDocuments(catalog);

    expect(generated).toEqual(again);
    expect(generated).toEqual(packSource);
    expect(generated[0]).toMatchObject({
      name: "Example Keen Senses",
      type: "feature",
      flags: { "pivot-fantasy": { contentId: "example-keen-senses" } },
    });
    expect(generated[0]?._id).toMatch(/^[0-9a-f]{16}$/);
  });
});
