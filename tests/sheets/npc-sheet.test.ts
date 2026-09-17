import { describe, expect, it } from "vitest";

import { prepareNpcSheetContext, type NpcActorLike } from "../../src/sheets/npc-sheet";

function sampleNpc(): NpcActorLike {
  return {
    name: "Angry Orc",
    type: "npc",
    system: {
      schemaVersion: 1,
      attributes: {
        hp: {
          value: 25,
          max: 30,
        },
        ac: 14,
        speed: 10,
      },
      combatBonuses: {
        physical: 5,
        intellectual: 2,
      },
      cr: "1",
      biography: "An angry orc warrior.",
    },
    items: [
      {
        _id: "weapon1",
        name: "Greataxe",
        type: "weapon",
        system: {
          damage: "1d12",
        },
      },
      {
        _id: "armour1",
        name: "Hide Armour",
        type: "armour",
        system: {
          category: "medium",
        },
      },
    ],
  };
}

describe("prepareNpcSheetContext", () => {
  it("prepares basic context with actor data and items", () => {
    const npc = sampleNpc();
    const context = prepareNpcSheetContext(npc);

    expect(context.actor).toBe(npc);
    expect(context.system).toBe(npc.system);
    expect(context.items).toHaveLength(2);
    expect(context.items[0]?.name).toBe("Greataxe");
    expect(context.items[1]?.name).toBe("Hide Armour");
  });

  it("sets disabled attribute when actor is not owned", () => {
    const baseNpc = sampleNpc();
    const npc = { ...baseNpc, isOwner: false };
    const context = prepareNpcSheetContext(npc);

    expect(context.disabledAttr).toBe("disabled");
  });

  it("sets empty disabled attribute when actor is owned", () => {
    const baseNpc = sampleNpc();
    const npc = { ...baseNpc, isOwner: true };
    const context = prepareNpcSheetContext(npc);

    expect(context.disabledAttr).toBe("");
  });

  it("handles items as contents array", () => {
    const npc = sampleNpc();
    const weapon = {
      _id: "weapon1",
      name: "Greataxe",
      type: "weapon",
      system: { damage: "1d12" },
    };
    npc.items = { contents: [weapon] };

    const context = prepareNpcSheetContext(npc);

    expect(context.items).toHaveLength(1);
    expect(context.items[0]).toBe(weapon);
  });

  it("handles missing items gracefully", () => {
    const npc = { ...sampleNpc(), items: undefined };
    const context = prepareNpcSheetContext(npc);

    expect(context.items).toEqual([]);
  });

  it("includes required NPC fields in system data", () => {
    const npc = sampleNpc();
    const context = prepareNpcSheetContext(npc);

    expect(context.system.attributes.hp.value).toBe(25);
    expect(context.system.attributes.hp.max).toBe(30);
    expect(context.system.attributes.ac).toBe(14);
    expect(context.system.attributes.speed).toBe(10);
    expect(context.system.combatBonuses.physical).toBe(5);
    expect(context.system.combatBonuses.intellectual).toBe(2);
    expect(context.system.cr).toBe("1");
    expect(context.system.biography).toBe("An angry orc warrior.");
  });
});
