import { describe, expect, it } from "vitest";

import { prepareItemSheetContext } from "../../src/sheets/item-sheet";

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
