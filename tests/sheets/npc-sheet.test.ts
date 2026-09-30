import { describe, expect, it, vi } from "vitest";

import {
  prepareNpcSheetContext,
  type NpcActorLike,
  createPivotNpcSheetClass,
} from "../../src/sheets/npc-sheet";
import type { FoundryRuntime } from "../../src/foundry-runtime";

function sampleNpc(): NpcActorLike {
  return {
    name: "Angry Orc",
    type: "npc",
    system: {
      schemaVersion: 1,
      tier: "gonk",
      creatureType: "humanoid",
      overlay: "none",
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
    expect(context.config.tierChoices).toBeDefined();
    expect(context.config.creatureTypeChoices).toBeDefined();
    expect(context.config.overlayChoices).toBeDefined();
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

    expect(context.system.tier).toBe("gonk");
    expect(context.system.creatureType).toBe("humanoid");
    expect(context.system.overlay).toBe("none");
    expect(context.system.attributes.hp.value).toBe(25);
    expect(context.system.attributes.hp.max).toBe(30);
    expect(context.system.attributes.ac).toBe(14);
    expect(context.system.attributes.speed).toBe(10);
    expect(context.system.combatBonuses.physical).toBe(5);
    expect(context.system.combatBonuses.intellectual).toBe(2);
    expect(context.system.cr).toBe("1");
    expect(context.system.biography).toBe("An angry orc warrior.");
  });

  it("preserves classification fields when updated", () => {
    const npc = sampleNpc();
    npc.system.tier = "boss";
    npc.system.creatureType = "undead";
    npc.system.overlay = "dire";

    const context = prepareNpcSheetContext(npc);

    expect(context.system.tier).toBe("boss");
    expect(context.system.creatureType).toBe("undead");
    expect(context.system.overlay).toBe("dire");
  });

  describe("NPC Sheet class form submission", () => {
    it("calls actor.update with form data when form is submitted", async () => {
      const mockFoundry = createMockFoundryRuntime();
      const SheetClass = createPivotNpcSheetClass(mockFoundry) as unknown as {
        onSubmitDocumentForm: (
          event: Event,
          form: HTMLFormElement,
          formData: { object?: Record<string, unknown> },
        ) => Promise<unknown>;
      };
      const npc = sampleNpc();
      const updateSpy = vi.fn().mockResolvedValue(undefined);
      npc.update = updateSpy;

      const formData = {
        object: {
          "system.tier": "boss",
          "system.creatureType": "undead",
          "system.overlay": "dire",
        },
      };

      await SheetClass.onSubmitDocumentForm.call(
        { document: npc } as never,
        {} as Event,
        {} as HTMLFormElement,
        formData,
      );

      expect(updateSpy).toHaveBeenCalledWith({
        "system.tier": "boss",
        "system.creatureType": "undead",
        "system.overlay": "dire",
      });
    });
  });
});

function createMockFoundryRuntime(): FoundryRuntime {
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class
  class MockTypeDataModel {
    static defineSchema() {
      return {};
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class
  class MockActorSheetV2 {
    static DEFAULT_OPTIONS = {};
  }

  return {
    abstract: {
      TypeDataModel: MockTypeDataModel,
    },
    data: {
      fields: {},
    },
    applications: {
      sheets: {
        ActorSheetV2: MockActorSheetV2,
      },
      api: {
        HandlebarsApplicationMixin: (base: never) => base,
      },
    },
  } as never;
}
