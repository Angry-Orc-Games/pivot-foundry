import { describe, expect, it } from "vitest";

import {
  normalizeSheetSubmitData,
  prepareCharacterSheetContext,
  resolveSheetRoll,
  type ActorLike,
} from "../../src/sheets/character-sheet";

function specialist(): ActorLike {
  return {
    name: "Grawl",
    type: "character",
    system: {
      progression: { level: 5 },
      abilities: {
        str: { score: 16, primary: true },
        dex: { score: 10, primary: false },
        con: { score: 10, primary: false },
        int: { score: 10, primary: false },
        wis: { score: 13, primary: true },
        cha: { score: 10, primary: false },
      },
      magic: { awakened: true, ability: "wis" },
      skills: {
        controlMagic: {
          ability: "int",
          proficient: true,
          deepening: 0,
          expertise: false,
          bonus: 0,
        },
      },
      skillSpecializations: {
        academia: [
          {
            name: "History",
            ability: "int",
            proficient: true,
            deepening: 0,
            expertise: false,
            bonus: 0,
          },
        ],
        crafting: [
          {
            name: "Armourer",
            ability: "int",
            proficient: true,
            deepening: 1,
            expertise: false,
            bonus: 2,
          },
          {
            name: "Glassblowing",
            ability: "wis",
            proficient: true,
            deepening: 0,
            expertise: false,
            bonus: 0,
          },
        ],
      },
    },
    items: [],
  };
}

describe("Academia and Crafting rows", () => {
  it("gives each stored Academia and Crafting entry its own rollable ability", () => {
    const context = prepareCharacterSheetContext(specialist());
    const armourer = context.skillRows.find((row) => row.label === "Armourer");
    const history = context.skillRows.find((row) => row.label === "History");
    const glass = context.skillRows.find((row) => row.label === "Glassblowing");
    const control = context.skillRows.find((row) => row.id === "controlMagic");

    expect(armourer).toMatchObject({ ability: "Str", proficient: true, bonus: 2, deepening: 1 });
    expect(history).toMatchObject({ ability: "Int" });
    expect(glass).toMatchObject({ ability: "Wis" });
    expect(control).toMatchObject({ ability: "Wis" });

    const armourerRoll = resolveSheetRoll(
      { dataset: { rollKind: "skill", key: armourer?.id, label: "Armourer" } },
      context,
    );
    expect(armourerRoll).toMatchObject({ kind: "d20", modifier: 9 });
    const controlRoll = resolveSheetRoll(
      { dataset: { rollKind: "skill", key: "controlMagic", label: "Control Magic" } },
      context,
    );
    expect(controlRoll).toMatchObject({ kind: "d20", modifier: 4 });

    expect(
      normalizeSheetSubmitData({
        system: {
          skillSpecializations: {
            academiaText: "History, Theology",
            craftingText: "Armourer, Smithing",
          },
        },
      }),
    ).toMatchObject({
      system: {
        skillSpecializations: {
          academia: [
            { name: "History", ability: "int" },
            { name: "Theology", ability: "int" },
          ],
          crafting: [
            { name: "Armourer", ability: "str" },
            { name: "Smithing", ability: "int" },
          ],
        },
      },
    });
  });
});
