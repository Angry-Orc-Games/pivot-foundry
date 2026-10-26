import { featureCategories, SYSTEM_ID } from "../config";
import type { FoundryRuntime, TypeDataModelConstructor } from "../foundry-runtime";
import { describeEffectRule, parseStoredEffect, type EffectRule } from "../rules/effects";
import {
  INVALID_CHOICE_LABEL,
  selectOptionRecord,
  type SelectBinding,
} from "../rules/item-choices";

const ITEM_TEMPLATE = `systems/${SYSTEM_ID}/templates/items/item-sheet.hbs`;

export const ITEM_SHEET_POSITION = { width: 560, height: "auto" as const };
export const ITEM_SHEET_WINDOW = {
  resizable: true,
};

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
  weaponCategorySelect: SelectBinding;
  attackAbilitySelect: SelectBinding;
  damageAbilitySelect: SelectBinding;
  damageTypeSelect: SelectBinding;
  armourCategorySelect: SelectBinding;
  config: {
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
      position: ITEM_SHEET_POSITION,
      tag: "form",
      window: ITEM_SHEET_WINDOW,
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

    get title(): string {
      return itemWindowTitle(this);
    }

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

export function itemWindowTitle(sheet: object): string {
  const candidate = sheet as {
    document?: { name?: unknown };
    item?: { name?: unknown };
  };
  const name = candidate.document?.name ?? candidate.item?.name;
  return typeof name === "string" ? name.trim() : "";
}

export function prepareItemSheetContext(
  document: { name: string; type: string; system: Record<string, unknown> },
  editable = true,
): ItemSheetContext {
  const disabledAttr = editable ? "" : "disabled";
  const system = document.system ?? {};
  return {
    item: document,
    system,
    disabledAttr,
    isWeapon: document.type === "weapon",
    isArmour: document.type === "armour",
    isEquipment: document.type === "equipment",
    isFeature: document.type === "feature",
    isMagicStream: document.type === "magicStream",
    isMagicAbility: document.type === "magicAbility",
    effects: readOnlyEffectRows(system),
    weaponCategorySelect: selectOptionRecord(
      "weaponCategory",
      system.category,
      INVALID_CHOICE_LABEL,
    ),
    attackAbilitySelect: selectOptionRecord(
      "attackAbility",
      nestedValue(system, ["attack", "ability"]),
      INVALID_CHOICE_LABEL,
    ),
    damageAbilitySelect: selectOptionRecord(
      "damageAbility",
      nestedValue(system, ["damage", "ability"]),
      INVALID_CHOICE_LABEL,
    ),
    damageTypeSelect: selectOptionRecord(
      "damageType",
      nestedValue(system, ["damage", "type"]),
      INVALID_CHOICE_LABEL,
    ),
    armourCategorySelect: selectOptionRecord(
      "armourCategory",
      system.category,
      INVALID_CHOICE_LABEL,
    ),
    config: {
      featureCategories,
    },
  };
}

function nestedValue(source: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = source;
  for (const part of path) {
    if (typeof current !== "object" || current === null || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
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
