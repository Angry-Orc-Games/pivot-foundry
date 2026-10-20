import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

  it("shows an empty effects list when none are present", () => {
    const context = prepareItemSheetContext({
      name: "Rope",
      type: "equipment",
      system: {},
    });

    expect(context.effects).toEqual([]);
    expect(context.isEquipment).toBe(true);
  });

  it("keeps a stored rangedLight category selected on the weapon category select", () => {
    const context = prepareItemSheetContext({
      name: "Short Bow",
      type: "weapon",
      system: { category: "rangedLight" },
    });

    expect(context.weaponCategorySelect.selected).toBe("rangedLight");
    expect(context.weaponCategorySelect.options.rangedLight).toBe("Invalid, pick one");
    expect(context.weaponCategorySelect.options.bows).toBe("Bows");
  });
});

describe("item sheet template", () => {
  it("uses selects for weapon and armour closed fields", () => {
    const template = readFileSync(
      resolve(process.cwd(), "templates/items/item-sheet.hbs"),
      "utf8",
    ).replace(/\s+/g, " ");
    const weapon = template.slice(
      template.indexOf("{{#if isWeapon}}"),
      template.indexOf("{{#if isArmour}}"),
    );
    const armour = template.slice(
      template.indexOf("{{#if isArmour}}"),
      template.indexOf("{{#if isEquipment}}"),
    );
    const feature = template.slice(
      template.indexOf("{{#if isFeature}}"),
      template.indexOf("{{#if effects.length}}"),
    );

    expect(weapon).toContain('<select name="system.category"');
    expect(weapon).toContain('<select name="system.attack.ability"');
    expect(weapon).toContain('<select name="system.damage.ability"');
    expect(weapon).toContain('<select name="system.damage.type"');
    expect(weapon).not.toContain('<input name="system.category"');
    expect(weapon).not.toContain('<input name="system.attack.ability"');
    expect(weapon).not.toContain('<input name="system.damage.ability"');
    expect(weapon).not.toContain('<input name="system.damage.type"');
    expect(weapon).not.toContain("localize=true");
    expect(armour).toContain('<select name="system.category"');
    expect(feature).toContain('<input name="system.category"');
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
