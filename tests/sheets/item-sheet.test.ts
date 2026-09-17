import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ITEM_SHEET_POSITION,
  ITEM_SHEET_WINDOW,
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
});

describe("item sheet layout CSS", () => {
  const css = readFileSync(resolve("styles/pivot-fantasy.css"), "utf8").replace(/\s+/g, " ");

  it("scrolls item windows instead of clipping them", () => {
    expect(css).toContain(".pivot-fantasy.sheet.actor .window-content { overflow: hidden; }");
    expect(css).toContain(
      ".pivot-fantasy.sheet.item .window-content { overflow-x: hidden; overflow-y: auto; }",
    );
    expect(css).not.toContain(".pivot-fantasy.sheet .window-content { overflow: hidden; }");
  });

  it("does not force item forms wider than the Foundry window", () => {
    expect(css).not.toMatch(/\.pivot-character-sheet, \.pivot-item-sheet \{[^}]*min-width: 620px/);
    expect(css).toContain(
      ".pivot-item-sheet { box-sizing: border-box; min-width: 0; width: 100%; }",
    );
  });
});
