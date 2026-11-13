import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

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
Handlebars.registerHelper("selectOptions", (choices: Record<string, string> | undefined) => {
  const html = Object.entries(choices ?? {})
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join("");
  return new Handlebars.SafeString(html);
});

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
describe("magic echelon field", () => {
  const template = Handlebars.compile(
    readFileSync(join(__dirname, "../../templates/items/item-sheet.hbs"), "utf8"),
  );

  function rendered(type: "magicAbility" | "magicStream"): {
    html: string;
    root: Element | undefined;
  } {
    const html = template(
      prepareItemSheetContext({
        name: "Spark",
        type,
        system: { echelon: "core", stream: "Fire", ability: "int" },
      }),
    );
    const body = new JSDOM(html).window.document.body;
    return { html, root: body.children[0] };
  }

  it("renders one select of Core and Echelons 1 to 5 for abilities and streams", () => {
    for (const type of ["magicAbility", "magicStream"] as const) {
      const { html, root } = rendered(type);
      expect(bodyChildCount(html)).toBe(1);
      expect(root?.tagName).toBe("SECTION");
      const select = root?.querySelector("select[name='system.echelon']");
      expect(select).toBeTruthy();
      expect(select?.textContent).toContain("Core");
      expect(select?.textContent).toContain("Echelon 1");
      expect(select?.textContent).toContain("Echelon 5");
      expect(html).not.toContain('name="system.echelon"\n            type="number"');
    }
  });
});

function bodyChildCount(html: string): number {
  return new JSDOM(html).window.document.body.children.length;
}

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
