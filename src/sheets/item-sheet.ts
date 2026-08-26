import { armourCategories, featureCategories, SYSTEM_ID, weaponCategories } from "../config";
import type { FoundryRuntime, TypeDataModelConstructor } from "../foundry-runtime";

const ITEM_TEMPLATE = `systems/${SYSTEM_ID}/templates/items/item-sheet.hbs`;

export function createPivotItemSheetClass(foundry: FoundryRuntime): TypeDataModelConstructor {
  const BaseSheet = foundry.applications.api.HandlebarsApplicationMixin(
    foundry.applications.sheets.ItemSheetV2,
  );

  class PivotItemSheet extends BaseSheet {
    static DEFAULT_OPTIONS = {
      classes: [SYSTEM_ID, "sheet", "item"],
      position: { width: 560, height: 520 },
      tag: "form",
      window: {
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
        item: document,
        system: document.system ?? {},
        disabledAttr: parentContext.editable === false ? "disabled" : "",
        isWeapon: document.type === "weapon",
        isArmour: document.type === "armour",
        isEquipment: document.type === "equipment",
        isFeature: document.type === "feature",
        isMagicStream: document.type === "magicStream",
        isMagicAbility: document.type === "magicAbility",
        config: {
          weaponCategories,
          armourCategories,
          featureCategories,
        },
      };
    }
  }

  return PivotItemSheet;
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
