import { guardHpMaximum } from "./runtime/actor-guards";
import { initializeSurvival } from "./migrations/m002";
import { installHealthChatHook } from "./runtime/health-dialog";
import {
  updateTokenStatusEffects,
  guardSystemManagedEffectDeletion,
} from "./runtime/status-effects";
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

/**
 * Utility to check if a nested property exists in an object.
 * Mimics foundry.utils.hasProperty for nested path checking.
 */
function hasNestedProperty(obj: unknown, path: string): boolean {
  if (typeof obj !== "object" || obj === null) return false;
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (typeof current !== "object" || current === null || !(part in current)) {
      return false;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return true;
}

export function registerPivotFantasySystem(runtime: PivotRegistrationRuntime): void {
  installHealthChatHook(runtime.Hooks);
  runtime.Hooks.on?.("preCreateActor", initializeSurvival);
  runtime.Hooks.on?.("preUpdateActor", guardHpMaximum);

  // Sync token status effects after HP or death state changes
  // Foundry passes nested changes object: {system: {attributes: {hp: {value}}}}
  runtime.Hooks.on?.("updateActor", (actor: unknown, changes: Record<string, unknown>) => {
    const hpChanged = hasNestedProperty(changes, "system.attributes.hp.value");
    const statusChanged = hasNestedProperty(changes, "system.attributes.deathSaves.status");

    if (hpChanged || statusChanged) {
      const globals = globalThis as { game?: unknown };
      void updateTokenStatusEffects(
        actor as Parameters<typeof updateTokenStatusEffects>[0],
        globals.game as Parameters<typeof updateTokenStatusEffects>[1],
      );
    }
  });

  // Sync effects on actor creation so new dying characters show Unconscious immediately
  runtime.Hooks.on?.("createActor", (actor: unknown) => {
    const globals = globalThis as { game?: unknown };
    void updateTokenStatusEffects(
      actor as Parameters<typeof updateTokenStatusEffects>[0],
      globals.game as Parameters<typeof updateTokenStatusEffects>[1],
    );
  });

  // Block non-GM deletion of system-managed status effects (anti-cheat)
  runtime.Hooks.on?.("preDeleteActiveEffect", (effect: unknown) => {
    const globals = globalThis as { game?: unknown };
    return guardSystemManagedEffectDeletion(
      effect as Parameters<typeof guardSystemManagedEffectDeletion>[0],
      globals.game as Parameters<typeof guardSystemManagedEffectDeletion>[1],
    );
  });
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

    // Set CONFIG.Combat.initiative formula for Combat Tracker roll buttons
    // References actor.getRollData().initiative which includes Dex mod + bonus
    const config = runtime.CONFIG as typeof runtime.CONFIG & {
      Combat?: { initiative?: { formula?: string } };
    };
    if (!config.Combat) {
      config.Combat = {};
    }
    if (typeof config.Combat.initiative === "object") {
      config.Combat.initiative.formula = "1d20 + @initiative";
    } else {
      config.Combat.initiative = { formula: "1d20 + @initiative" };
    }

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

    // Sync effects for all existing characters on world load
    // This ensures dying/dead actors already in the world show the right icons
    const actors = globals.game?.actors;
    if (actors && Symbol.iterator in Object(actors)) {
      for (const actor of actors as Iterable<{ type?: string }>) {
        if (actor.type === "character") {
          void updateTokenStatusEffects(
            actor as Parameters<typeof updateTokenStatusEffects>[0],
            globals.game as Parameters<typeof updateTokenStatusEffects>[1],
          );
        }
      }
    }
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
