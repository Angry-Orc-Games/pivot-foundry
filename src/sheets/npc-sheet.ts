import { SYSTEM_ID } from "../config";
import type { FoundryRuntime, TypeDataModelConstructor } from "../foundry-runtime";

const NPC_TEMPLATE = `systems/${SYSTEM_ID}/templates/actors/npc-sheet.hbs`;

export interface NpcActorLike {
  isOwner?: boolean;
  uuid?: string;
  id?: string;
  _id?: string;
  name: string;
  type: string;
  system: {
    schemaVersion?: number;
    tier: string;
    creatureType: string;
    overlay: string;
    attributes: {
      hp: {
        value: number;
        max: number;
      };
      ac: number;
      speed: number;
    };
    combatBonuses: {
      physical: number;
      intellectual: number;
    };
    cr: string;
    biography: string;
  };
  items?: Iterable<ItemLike> | { contents: ItemLike[] };
  update?: (data: Record<string, unknown>) => Promise<unknown>;
}

export interface ItemLike {
  id?: string;
  _id?: string;
  name: string;
  type: string;
  system: Record<string, unknown>;
}

export interface NpcSheetContext {
  actor: NpcActorLike;
  system: NpcActorLike["system"];
  items: ItemLike[];
  disabledAttr: string;
  rootId: string;
  config: {
    tierChoices: Record<string, string>;
    creatureTypeChoices: Record<string, string>;
    overlayChoices: Record<string, string>;
  };
}

export function prepareNpcSheetContext(actor: NpcActorLike): Omit<NpcSheetContext, "rootId"> {
  const isOwner = actor.isOwner ?? false;
  const disabledAttr = isOwner ? "" : "disabled";

  const itemsIterable =
    actor.items && "contents" in actor.items ? actor.items.contents : (actor.items ?? []);
  const items = Array.from(itemsIterable);

  return {
    actor,
    system: actor.system,
    items,
    disabledAttr,
    config: {
      tierChoices: {
        gonk: "PIVOT.Tier.Gonk",
        alphaGonk: "PIVOT.Tier.AlphaGonk",
        boss: "PIVOT.Tier.Boss",
        bbeg: "PIVOT.Tier.BBEG",
      },
      creatureTypeChoices: {
        beast: "PIVOT.CreatureType.Beast",
        humanoid: "PIVOT.CreatureType.Humanoid",
        monster: "PIVOT.CreatureType.Monster",
        undead: "PIVOT.CreatureType.Undead",
      },
      overlayChoices: {
        none: "PIVOT.Overlay.None",
        alpha: "PIVOT.Overlay.Alpha",
        giant: "PIVOT.Overlay.Giant",
        dire: "PIVOT.Overlay.Dire",
        undead: "PIVOT.Overlay.Undead",
      },
    },
  };
}

export function createPivotNpcSheetClass(foundry: FoundryRuntime): TypeDataModelConstructor {
  const base = foundry.applications.sheets.ActorSheetV2;
  const HandlebarsApplicationMixin = foundry.applications.api.HandlebarsApplicationMixin;

  class PivotNpcSheet extends HandlebarsApplicationMixin(base) {
    declare document: NpcActorLike;

    static DEFAULT_OPTIONS = {
      classes: ["pivot-fantasy", "sheet", "actor", "npc"],
      tag: "form",
      position: {
        width: 640,
        height: 720,
      },
      actions: {
        editItem: PivotNpcSheet.onEditItem,
        deleteItem: PivotNpcSheet.onDeleteItem,
      },
      form: {
        submitOnChange: true,
        handler: PivotNpcSheet.onSubmitDocumentForm,
      },
      window: {
        icon: "fa-solid fa-skull",
        resizable: true,
      },
    };

    static PARTS = {
      form: {
        template: NPC_TEMPLATE,
      },
    };

    get title(): string {
      return `NPC: ${this.document.name}`;
    }

    async _prepareContext(): Promise<NpcSheetContext> {
      const baseContext = prepareNpcSheetContext(this.document);
      const rootId = (this as { id?: string }).id ?? "pivot-npc";

      return {
        ...baseContext,
        rootId,
      };
    }

    static async onEditItem(
      this: PivotNpcSheet,
      _event: Event,
      target: HTMLElement,
    ): Promise<void> {
      const itemId = target.dataset.itemId;
      if (!itemId) return;

      const actor = this.document as NpcActorLike;
      const items =
        actor.items && "contents" in actor.items ? actor.items.contents : (actor.items ?? []);
      const item = Array.from(items).find((item) => (item.id ?? item._id) === itemId) as
        (ItemLike & { sheet?: { render?: (force?: boolean) => unknown } }) | undefined;

      if (item?.sheet?.render) {
        item.sheet.render(true);
      }
    }

    static async onDeleteItem(
      this: PivotNpcSheet,
      event: Event,
      target: HTMLElement,
    ): Promise<void> {
      event.preventDefault();
      const itemId = target.dataset.itemId;
      if (!itemId) return;

      const actor = this.document as NpcActorLike & {
        deleteEmbeddedDocuments?: (type: "Item", ids: string[]) => Promise<unknown>;
      };

      if (actor.deleteEmbeddedDocuments) {
        await actor.deleteEmbeddedDocuments("Item", [itemId]);
      }
    }

    static async onSubmitDocumentForm(
      this: PivotNpcSheet,
      _event: Event,
      _form: HTMLFormElement,
      formData: { object?: Record<string, unknown> },
    ): Promise<unknown> {
      const data = formData.object ?? {};
      return this.document.update?.(data);
    }
  }

  return PivotNpcSheet as unknown as TypeDataModelConstructor;
}
