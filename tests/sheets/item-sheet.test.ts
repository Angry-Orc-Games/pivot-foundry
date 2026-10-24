import { describe, expect, it } from "vitest";

import {
  ITEM_SHEET_POSITION,
  ITEM_SHEET_WINDOW,
  itemWindowTitle,
  prepareItemSheetContext,
} from "../../src/sheets/item-sheet";

describe("prepareItemSheetContext", () => {
  it("shows a read-only summary of valid stored effects", () => {
    const context = prepareItemSheetContext({
      name: "Example Keen Senses",
      type: "feature",
      system: {
        category: "feat",
        effects: [
          {
            type: "skillBonus",
            skill: "perception",
            amount: 2,
            ability: null,
            category: null,
          },
          { type: "unknown" },
        ],
      },
    });

    expect(context.isFeature).toBe(true);
    expect(context.effects).toEqual([
      {
        type: "skillBonus",
        typeLabelKey: "PIVOT.Effects.SkillBonus",
        detail: "Perception +2",
      },
    ]);
  });

  it("reopens an equipment edit from persisted source when prepared data is stale", () => {
    const item = {
      name: "Rope",
      type: "equipment",
      system: { quantity: 1, weight: 1, carried: true, notes: "" },
      toObject() {
        return {
          name: "Silk Rope",
          type: "equipment",
          system: { quantity: 4, weight: 2, carried: true, notes: "coiled" },
        };
      },
    };

    const context = prepareItemSheetContext(item);

    expect(context.item.name).toBe("Silk Rope");
    expect(context.system).toMatchObject({ quantity: 4, weight: 2, notes: "coiled" });
    expect(context.isEquipment).toBe(true);
  });

  it("shows an empty effects list when none are present", () => {
    const context = prepareItemSheetContext({
      name: "Rope",
      type: "equipment",
      system: {},
    });

    expect(context.effects).toEqual([]);
    expect(context.isEquipment).toBe(true);
  });
});

describe("PivotItemSheet window", () => {
  it("fits content height and stays resizable so the form is not clipped", () => {
    expect(ITEM_SHEET_POSITION).toEqual({ width: 560, height: "auto" });
    expect(ITEM_SHEET_WINDOW.resizable).toBe(true);
  });

  it("uses the item name as the window title without a type prefix", () => {
    expect(itemWindowTitle({ document: { name: "New Armour" } })).toBe("New Armour");
    expect(itemWindowTitle({ item: { name: "  Rope  " } })).toBe("Rope");
    expect(itemWindowTitle({})).toBe("");
  });
});
