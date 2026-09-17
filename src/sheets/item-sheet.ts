import { armourCategories, featureCategories, SYSTEM_ID, weaponCategories } from "../config";
import type { FoundryRuntime, TypeDataModelConstructor } from "../foundry-runtime";
import { describeEffectRule, parseStoredEffect, type EffectRule } from "../rules/effects";

const ITEM_TEMPLATE = `systems/${SYSTEM_ID}/templates/items/item-sheet.hbs`;

export interface ItemSheetEffectRow {
  type: EffectRule["type"];
  typeLabelKey: string;
  detail: string;
}

export interface ItemSheetContext {
  item: { name: string; type: string; system: Record<string, unknown> };
  system: Record<string, unknown>;
  disabledAttr: "" | "disabled";
  isWeapon: boolean;
  isArmour: boolean;
  isEquipment: boolean;
  isFeature: boolean;
  isMagicStream: boolean;
  isMagicAbility: boolean;
  effects: ItemSheetEffectRow[];
  config: {
    weaponCategories: typeof weaponCategories;
    armourCategories: typeof armourCategories;
    featureCategories: typeof featureCategories;
  };
}

export function createPivotItemSheetClass(foundry: FoundryRuntime): TypeDataModelConstructor {
  const BaseSheet = foundry.applications.api.HandlebarsApplicationMixin(
    foundry.applications.sheets.ItemSheetV2,
  );

  class PivotItemSheet extends BaseSheet {
    static DEFAULT_OPTIONS = {
      classes: [SYSTEM_ID, "sheet", "item"],
      position: { width: 560, height: "auto" },
      tag: "form",
      window: {
        resizable: true,
        title: "PIVOT.Sheets.Item.Title",
      },
      form: {
        closeOnSubmit: false,
        submitOnChange: true,
        handler: submitDocumentForm,
      },
    };

    static PARTS = {
      form: {
        template: ITEM_TEMPLATE,
      },
    };

    async _prepareContext(options: Record<string, unknown>): Promise<Record<string, unknown>> {
      const parentContext = await callOptionalSuper(this, "_prepareContext", options);
      const document = getSheetDocument(this);
      return {
        ...parentContext,
        ...prepareItemSheetContext(document, parentContext.editable !== false),
      };
    }
  }

  return PivotItemSheet;
}

export function prepareItemSheetContext(
  document: { name: string; type: string; system: Record<string, unknown> },
  editable = true,
): ItemSheetContext {
  const disabledAttr = editable ? "" : "disabled";
  return {
    item: document,
    system: document.system ?? {},
    disabledAttr,
    isWeapon: document.type === "weapon",
    isArmour: document.type === "armour",
    isEquipment: document.type === "equipment",
    isFeature: document.type === "feature",
    isMagicStream: document.type === "magicStream",
    isMagicAbility: document.type === "magicAbility",
    effects: readOnlyEffectRows(document.system),
    config: {
      weaponCategories,
      armourCategories,
      featureCategories,
    },
  };
}

function readOnlyEffectRows(system: Record<string, unknown>): ItemSheetEffectRow[] {
  const raw = system.effects;
  if (!Array.isArray(raw)) return [];

  const rows: ItemSheetEffectRow[] = [];
  for (const entry of raw) {
    const parsed = parseStoredEffect(entry);
    if (!parsed) continue;
    const described = describeEffectRule(parsed);
    rows.push({
      type: parsed.type,
      typeLabelKey: described.typeLabelKey,
      detail: described.detail,
    });
  }
  return rows;
}

async function submitDocumentForm(
  this: { document?: { update?: (data: Record<string, unknown>) => Promise<unknown> } },
  _event: Event,
  _form: HTMLFormElement,
  formData: { object?: Record<string, unknown> },
): Promise<unknown> {
  return this.document?.update?.(formData.object ?? {});
}

function getSheetDocument(sheet: object): {
  name: string;
  type: string;
  system: Record<string, unknown>;
} {
  const candidate = sheet as {
    document?: { name: string; type: string; system: Record<string, unknown> };
    item?: { name: string; type: string; system: Record<string, unknown> };
  };
  const document = candidate.document ?? candidate.item;
  if (!document) throw new Error("PivotItemSheet requires an Item document.");
  return document;
}

async function callOptionalSuper(
  instance: object,
  method: string,
  options: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const proto = Object.getPrototypeOf(Object.getPrototypeOf(instance)) as Record<
    string,
    unknown
  > | null;
  const fn = proto?.[method];
  if (typeof fn !== "function") return {};
  const result = (await Reflect.apply(fn, instance, [options])) as unknown;
  return typeof result === "object" && result !== null ? (result as Record<string, unknown>) : {};
}
