import { guardHpMaximum } from "./runtime/actor-guards";
import { initializeSurvival } from "./migrations/m002";
import { installHealthChatHook } from "./runtime/health-dialog";
import { createPivotCharacterDataModel } from "./data/character-data";
import { createPivotNpcDataModel } from "./data/npc-data";
import { createPivotItemDataModels } from "./data/item-data";
import type { PivotRegistrationRuntime } from "./foundry-runtime";
import { runWorldMigrations, type WorldMigrationGame } from "./migrations/world-migrations";
import { SYSTEM_ID } from "./config";
import { createPivotCharacterSheetClass } from "./sheets/character-sheet";
import { createPivotNpcSheetClass } from "./sheets/npc-sheet";
import { createPivotItemSheetClass } from "./sheets/item-sheet";

type PivotGlobals = typeof globalThis & Partial<PivotRegistrationRuntime>;

export function registerPivotFantasySystem(runtime: PivotRegistrationRuntime): void {
  installHealthChatHook(runtime.Hooks);
  runtime.Hooks.on?.("preCreateActor", initializeSurvival);
  runtime.Hooks.on?.("preUpdateActor", guardHpMaximum);
  runtime.Hooks.once("init", () => {
    runtime.CONFIG.Actor.dataModels.character = createPivotCharacterDataModel(runtime.foundry);
    runtime.CONFIG.Actor.dataModels.npc = createPivotNpcDataModel(runtime.foundry);

    const itemDataModels = createPivotItemDataModels(runtime.foundry);
    runtime.CONFIG.Item.dataModels.weapon = itemDataModels.weapon;
    runtime.CONFIG.Item.dataModels.armour = itemDataModels.armour;
    runtime.CONFIG.Item.dataModels.equipment = itemDataModels.equipment;
    runtime.CONFIG.Item.dataModels.feature = itemDataModels.feature;
    runtime.CONFIG.Item.dataModels.magicStream = itemDataModels.magicStream;
    runtime.CONFIG.Item.dataModels.magicAbility = itemDataModels.magicAbility;

    runtime.CONFIG.Actor.trackableAttributes = {
      character: {
        bar: ["attributes.hp", "resources.pool", "magic.mp"],
        value: ["progression.xp", "progression.level"],
      },
      npc: {
        bar: ["attributes.hp"],
        value: [],
      },
    };

    const documentSheetConfig = runtime.foundry.applications.apps.DocumentSheetConfig;
    documentSheetConfig.registerSheet(
      runtime.ActorDocument,
      SYSTEM_ID,
      createPivotCharacterSheetClass(runtime.foundry),
      {
        types: ["character"],
        makeDefault: true,
        label: "PIVOT.Sheets.Character.Label",
      },
    );
    documentSheetConfig.registerSheet(
      runtime.ActorDocument,
      SYSTEM_ID,
      createPivotNpcSheetClass(runtime.foundry),
      {
        types: ["npc"],
        makeDefault: true,
        label: "PIVOT.Sheets.NPC.Label",
      },
    );
    documentSheetConfig.registerSheet(
      runtime.ItemDocument,
      SYSTEM_ID,
      createPivotItemSheetClass(runtime.foundry),
      {
        types: ["weapon", "armour", "equipment", "feature", "magicStream", "magicAbility"],
        makeDefault: true,
        label: "PIVOT.Sheets.Item.Label",
      },
    );

    console.log("Pivot Fantasy | Initialized character sheet system");
  });

  runtime.Hooks.once("ready", () => {
    const globals = globalThis as typeof globalThis & {
      game?: WorldMigrationGame;
      ui?: {
        notifications?: {
          info?: (text: string) => void;
          warn?: (text: string) => void;
          error?: (text: string) => void;
        };
      };
    };

    void runWorldMigrations({
      game: globals.game,
      notify: (level, message) => {
        globals.ui?.notifications?.[level]?.(message);
      },
      log: (message, ...details) => {
        console.warn(message, ...details);
      },
    });
  });
}

const pivotGlobals = globalThis as PivotGlobals & {
  Actor?: unknown;
  Item?: unknown;
};

if (pivotGlobals.Hooks && pivotGlobals.CONFIG && pivotGlobals.foundry) {
  registerPivotFantasySystem({
    Hooks: pivotGlobals.Hooks,
    CONFIG: pivotGlobals.CONFIG,
    foundry: pivotGlobals.foundry,
    ActorDocument: pivotGlobals.Actor,
    ItemDocument: pivotGlobals.Item,
  });
}
