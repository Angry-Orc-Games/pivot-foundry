import { describe, expect, it } from "vitest";

import packSource from "../../packs/src/items.json";
import exampleKeenSenses from "../../src/content/items/features/example-keen-senses.json";
import {
  generateContentPackDocuments,
  validateContentCatalog,
  validateContentRecord,
} from "../../src/rules/content";
import { CURRENT_SCHEMA_VERSION } from "../../src/rules/schema-version";

describe("validateContentRecord", () => {
  it("accepts the example pipeline fixture", () => {
    expect(validateContentRecord(exampleKeenSenses)).toMatchObject({
      contentId: "example-keen-senses",
      type: "feature",
      system: {
        schemaVersion: 2,
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

describe("magic echelon content", () => {
  function magicAbility(echelon: unknown) {
    return {
      contentId: "spark",
      name: "Spark",
      type: "magicAbility" as const,
      system: {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        effects: [],
        stream: "Fire",
        echelon,
        mpCost: 1,
        roll: "1d20",
        damage: "1d4",
      },
    };
  }

  it("accepts Core in any case and echelons 1 through 5, stored canonically", () => {
    expect(validateContentRecord(magicAbility("core")).system.echelon).toBe("core");
    expect(validateContentRecord(magicAbility("Core")).system.echelon).toBe("core");
    expect(validateContentRecord(magicAbility("CORE")).system.echelon).toBe("core");
    expect(validateContentRecord(magicAbility(1)).system.echelon).toBe("1");
    expect(validateContentRecord(magicAbility(2)).system.echelon).toBe("2");
    expect(validateContentRecord(magicAbility(3)).system.echelon).toBe("3");
    expect(validateContentRecord(magicAbility(4)).system.echelon).toBe("4");
    expect(validateContentRecord(magicAbility(5)).system.echelon).toBe("5");
    expect(validateContentRecord(magicAbility("1")).system.echelon).toBe("1");
  });

  it("rejects echelon values outside Core and 1 through 5", () => {
    for (const echelon of [0, 6, -1, 1.5, "foo"]) {
      expect(() => validateContentRecord(magicAbility(echelon))).toThrow(/echelon/);
    }
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
