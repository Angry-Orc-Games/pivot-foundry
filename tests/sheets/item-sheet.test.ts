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
