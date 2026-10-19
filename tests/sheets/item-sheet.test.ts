import { readFileSync } from "node:fs";
import { join } from "node:path";

import Handlebars from "handlebars";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import {
  ITEM_SHEET_POSITION,
  ITEM_SHEET_WINDOW,
  itemWindowTitle,
  prepareItemSheetContext,
} from "../../src/sheets/item-sheet";

Handlebars.registerHelper("localize", (key: string) => key);
Handlebars.registerHelper("checked", (value: unknown) => (value ? "checked" : ""));

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

describe("weapon item sheet", () => {
  it("renders an Equipped checkbox in the weapon section", () => {
    const template = Handlebars.compile(
      readFileSync(join(__dirname, "../../templates/items/item-sheet.hbs"), "utf8"),
    );
    const html = template({
      ...prepareItemSheetContext({
        name: "Flame Tongue",
        type: "weapon",
        system: { equipped: true },
      }),
      rootId: "weapon-sheet",
    });
    const document = new JSDOM(html).window.document;
    const weaponSection = [...document.querySelectorAll("section")].find((section) =>
      section.querySelector("h2")?.textContent?.includes("PIVOT.Sections.Attack"),
    );
    const checkbox = weaponSection?.querySelector('label.pf-check input[name="system.equipped"]');

    expect(checkbox?.getAttribute("type")).toBe("checkbox");
    expect(checkbox?.hasAttribute("checked")).toBe(true);
  });
});

describe("equipment item sheet", () => {
  it("renders an Equipped checkbox next to Carried", () => {
    const template = Handlebars.compile(
      readFileSync(join(__dirname, "../../templates/items/item-sheet.hbs"), "utf8"),
    );
    const html = template({
      ...prepareItemSheetContext({
        name: "Ring of Protection",
        type: "equipment",
        system: { equipped: true, carried: true },
      }),
      rootId: "equipment-sheet",
    });
    const document = new JSDOM(html).window.document;
    const equipmentSection = [...document.querySelectorAll("section")].find((section) =>
      section.querySelector("h2")?.textContent?.includes("PIVOT.Sections.Inventory"),
    );
    const checkbox = equipmentSection?.querySelector(
      'label.pf-check input[name="system.equipped"]',
    );
    const carried = equipmentSection?.querySelector('label.pf-check input[name="system.carried"]');

    expect(checkbox?.getAttribute("type")).toBe("checkbox");
    expect(checkbox?.hasAttribute("checked")).toBe(true);
    expect(carried?.getAttribute("type")).toBe("checkbox");
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
