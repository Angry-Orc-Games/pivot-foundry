import { describe, expect, it, vi } from "vitest";

import type { FoundryRuntime } from "../../src/foundry-runtime";
import {
  ITEM_SHEET_POSITION,
  ITEM_SHEET_WINDOW,
  createPivotItemSheetClass,
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

describe("PivotItemSheet class", () => {
  it("merges the parent context and submits the form object", async () => {
    const Sheet = createPivotItemSheetClass(itemFoundry()) as unknown as {
      new (): {
        document?: { name: string; type: string; system: Record<string, unknown> };
        title: string;
        _prepareContext(options: Record<string, unknown>): Promise<Record<string, unknown>>;
      };
      DEFAULT_OPTIONS: {
        form: {
          handler: (
            this: { document?: { update?: (data: Record<string, unknown>) => Promise<unknown> } },
            event: Event,
            form: HTMLFormElement,
            formData: { object?: Record<string, unknown> },
          ) => Promise<unknown>;
        };
      };
    };
    const sheet = new Sheet();
    sheet.document = { name: "Rope", type: "equipment", system: { notes: "hemp" } };
    expect(sheet.title).toBe("Rope");
    await expect(sheet._prepareContext({})).resolves.toMatchObject({
      fromParent: true,
      editable: false,
      isEquipment: true,
      disabledAttr: "disabled",
    });

    const update = vi.fn(async () => "saved");
    await expect(
      Sheet.DEFAULT_OPTIONS.form.handler.call(
        { document: { update } },
        {} as Event,
        {} as HTMLFormElement,
        { object: { name: "Rope" } },
      ),
    ).resolves.toBe("saved");
    expect(update).toHaveBeenCalledWith({ name: "Rope" });
    await expect(
      Sheet.DEFAULT_OPTIONS.form.handler.call({}, {} as Event, {} as HTMLFormElement, {}),
    ).resolves.toBeUndefined();
  });

  it("requires an item document", async () => {
    const Sheet = createPivotItemSheetClass(itemFoundry(false)) as unknown as {
      new (): { _prepareContext(options: Record<string, unknown>): Promise<unknown> };
    };
    await expect(new Sheet()._prepareContext({})).rejects.toThrow(/Item document/);
  });
});

function itemFoundry(withParent = true): FoundryRuntime {
  // eslint-disable-next-line @typescript-eslint/no-extraneous-class
  class MockTypeDataModel {}
  class MockItemSheetV2 {
    static DEFAULT_OPTIONS = {};
    async _prepareContext(): Promise<unknown> {
      return withParent ? { editable: false, fromParent: true } : "nope";
    }
  }

  return {
    abstract: { TypeDataModel: MockTypeDataModel },
    data: { fields: {} },
    applications: {
      sheets: { ItemSheetV2: MockItemSheetV2 },
      api: { HandlebarsApplicationMixin: (base: never) => base },
    },
  } as never;
}
