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

describe("content record validators", () => {
  it("accepts the other item types and defaults a missing icon", () => {
    const weapon = validateContentRecord({
      contentId: "sample-sword",
      name: "Sample Sword",
      type: "weapon",
      system: {
        schemaVersion: 1,
        effects: [],
        category: "meleeLight",
        attack: { ability: "str", bonus: 1 },
        damage: { formula: "1d8", type: "slashing", ability: null, bonus: 0 },
        range: { normal: 5, long: 20 },
        weight: 3,
        quantity: 1,
        carried: true,
      },
    });
    expect(weapon.img).toBeUndefined();
    expect(weapon.system.damage).toMatchObject({ ability: null, formula: "1d8" });

    expect(
      validateContentRecord({
        contentId: "sample-mail",
        name: "Sample Mail",
        type: "armour",
        system: {
          schemaVersion: 1,
          effects: [],
          category: "medium",
          acBonus: 4,
          equipped: true,
          weight: 20,
          quantity: 1,
          carried: true,
        },
      }).system.acBonus,
    ).toBe(4);

    expect(
      validateContentRecord({
        contentId: "sample-rope",
        name: "Sample Rope",
        type: "equipment",
        system: {
          schemaVersion: 1,
          effects: [],
          quantity: 1,
          weight: 2,
          carried: true,
          equipped: false,
        },
      }).type,
    ).toBe("equipment");

    expect(
      validateContentRecord({
        contentId: "sample-stream",
        name: "Sample Stream",
        type: "magicStream",
        system: { schemaVersion: 1, effects: [], ability: "int", echelon: 1 },
      }).system.ability,
    ).toBe("int");

    const ability = validateContentRecord({
      contentId: "sample-bolt",
      name: "Sample Bolt",
      type: "magicAbility",
      system: {
        schemaVersion: 1,
        effects: [],
        stream: "sample",
        echelon: 1,
        mpCost: 2,
        roll: "1d20",
        damage: "2d6",
      },
    });
    expect(ability.system.damage).toBe("2d6");
    expect(
      validateContentRecord({
        ...exampleKeenSenses,
        contentId: "sample-feat",
        system: {
          ...exampleKeenSenses.system,
          cost: { pool: 1, mp: 0 },
          uses: { value: 1, max: 2 },
        },
      }).system.uses,
    ).toEqual({ value: 1, max: 2 });

    const documents = generateContentPackDocuments([ability, weapon]);
    expect(documents.map((document) => document.flags["pivot-fantasy"].contentId)).toEqual([
      "sample-bolt",
      "sample-sword",
    ]);
    expect(documents[0]?.img).toBe("icons/svg/item-bag.svg");
  });

  it("rejects malformed records before they can enter a pack", () => {
    expect(() => validateContentRecord(null)).toThrow(/plain object/);
    expect(() => validateContentRecord({ ...exampleKeenSenses, contentId: "Not Kebab" })).toThrow(
      /kebab-case/,
    );
    expect(() => validateContentRecord({ ...exampleKeenSenses, name: " <bad> " })).toThrow(
      /HTML or URLs/,
    );
    expect(() =>
      validateContentRecord({ ...exampleKeenSenses, img: "../icons/svg/eye.svg" }),
    ).toThrow(/relative Foundry icon path/);
    expect(() =>
      validateContentRecord({ ...exampleKeenSenses, img: "/icons/svg/eye.svg" }),
    ).toThrow(/relative Foundry icon path/);
    expect(() =>
      validateContentRecord({
        ...exampleKeenSenses,
        system: { ...exampleKeenSenses.system, schemaVersion: 0 },
      }),
    ).toThrow(/schemaVersion/);
    expect(() =>
      validateContentRecord({
        ...exampleKeenSenses,
        system: { ...exampleKeenSenses.system, effects: { type: "acBonus" } },
      }),
    ).toThrow(/effects must be an array/);
    expect(() =>
      validateContentRecord({
        ...exampleKeenSenses,
        system: { ...exampleKeenSenses.system, effects: [{ type: "nope" }] },
      }),
    ).toThrow(/system\.effects\[0\] is invalid/);
    expect(() =>
      validateContentRecord({
        contentId: "sample-sword",
        name: "Sample Sword",
        type: "weapon",
        system: {
          schemaVersion: 1,
          effects: [],
          cost: { pool: -1 },
        },
      }),
    ).toThrow(/Unexpected keys|must be >= 0/);
    expect(() =>
      validateContentRecord({
        contentId: "sample-sword",
        name: "Sample Sword",
        type: "weapon",
        system: {
          schemaVersion: 1,
          effects: [],
          damage: { formula: "1d8", bonus: 1.5 },
          weight: -1,
        },
      }),
    ).toThrow(/finite integer/);
    expect(() =>
      validateContentRecord({
        contentId: "sample-sword",
        name: "Sample Sword",
        type: "weapon",
        system: { schemaVersion: 1, effects: [], range: { normal: -1 }, weight: -1 },
      }),
    ).toThrow(/>= 0/);
    expect(() =>
      validateContentRecord({
        contentId: "sample-rope",
        name: "Sample Rope",
        type: "equipment",
        system: { schemaVersion: 1, effects: [], equipped: "yes" },
      }),
    ).toThrow(/boolean/);
    expect(() => validateContentCatalog([null])).toThrow(/Content record 0 is invalid/);
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
