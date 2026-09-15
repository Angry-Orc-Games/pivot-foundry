import { planSurvivalMigration } from "./m002";
import {
  planActorMigration,
  planItemMigration,
  SCHEMA_MIGRATION_ID,
  type MigrationPlan,
} from "./m001";

export interface MigratableDocument {
  id?: string;
  name?: string;
  type?: string;
  system?: unknown;
  _source?: { system?: unknown };
  toObject?: () => { system?: unknown };
  items?: Iterable<MigratableDocument> | { contents: Iterable<MigratableDocument> };
  update?: (data: Record<string, unknown>) => Promise<unknown>;
}

export interface WorldMigrationGame {
  user?: { isGM?: boolean };
  actors?: Iterable<MigratableDocument> | { contents: Iterable<MigratableDocument> };
  items?: Iterable<MigratableDocument> | { contents: Iterable<MigratableDocument> };
  scenes?:
    | Iterable<{ tokens?: Iterable<{ actorLink?: boolean; actor?: MigratableDocument | null }> }>
    | {
        contents: Iterable<{
          tokens?: Iterable<{ actorLink?: boolean; actor?: MigratableDocument | null }>;
        }>;
      };
  i18n?: { localize?: (key: string) => string };
}

export interface WorldMigrationDependencies {
  game?: WorldMigrationGame;
  notify?: (level: "info" | "warn" | "error", message: string) => void;
  log?: (message: string, ...details: unknown[]) => void;
}

export interface WorldMigrationReport {
  skipped: boolean;
  updated: number;
  failed: number;
}

export async function runWorldMigrations(
  dependencies: WorldMigrationDependencies = {},
): Promise<WorldMigrationReport> {
  const game = dependencies.game;
  if (!game || game.user?.isGM === false) {
    return { skipped: true, updated: 0, failed: 0 };
  }

  let updated = 0;
  let failed = 0;

  for (const item of listDocuments(game.items)) {
    const result = await persistMigration(
      item,
      planItemMigration(readStoredSystem(item)),
      dependencies,
    );
    updated += result.updated;
    failed += result.failed;
  }

  const sceneList = game.scenes
    ? "contents" in game.scenes
      ? Array.from(game.scenes.contents)
      : Array.from(game.scenes)
    : [];
  const syntheticActors = sceneList.flatMap((scene) =>
    Array.from(scene.tokens ?? []).flatMap((token) =>
      token.actorLink === false && token.actor ? [token.actor] : [],
    ),
  );
  for (const actor of [...listDocuments(game.actors), ...syntheticActors]) {
    const actorResult = await persistMigration(
      actor,
      planAllActorMigrations(readStoredSystem(actor), actor.type),
      dependencies,
    );
    updated += actorResult.updated;
    failed += actorResult.failed;

    for (const item of listDocuments(actor.items)) {
      const itemResult = await persistMigration(
        item,
        planItemMigration(readStoredSystem(item)),
        dependencies,
      );
      updated += itemResult.updated;
      failed += itemResult.failed;
    }
  }

  if (updated > 0 || failed > 0) {
    const summary = formatMessage(
      "PIVOT.Migration.Complete",
      {
        id: `${SCHEMA_MIGRATION_ID} / M002`,
        updated: String(updated),
        failed: String(failed),
      },
      dependencies,
    );
    dependencies.notify?.(failed > 0 ? "warn" : "info", summary);
    dependencies.log?.(summary);
  }

  return { skipped: false, updated, failed };
}

export function readStoredSystem(document: MigratableDocument): unknown {
  if (typeof document.toObject === "function") {
    try {
      const object = document.toObject();
      if (object && typeof object === "object" && "system" in object) {
        return object.system;
      }
    } catch {
      // Fall through to source/prepared data.
    }
  }

  if (document._source && typeof document._source === "object") {
    return document._source.system;
  }

  return document.system;
}

async function persistMigration(
  document: MigratableDocument,
  plan: MigrationPlan,
  dependencies: WorldMigrationDependencies,
): Promise<{ updated: number; failed: number }> {
  if (!plan.ok) {
    reportFailure(document, plan.error, dependencies);
    return { updated: 0, failed: 1 };
  }
  if (!plan.changed) return { updated: 0, failed: 0 };

  try {
    if (!document.update) throw new Error("Document cannot be updated");
    await document.update(plan.update);
    return { updated: 1, failed: 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reportFailure(document, message, dependencies);
    return { updated: 0, failed: 1 };
  }
}

function reportFailure(
  document: MigratableDocument,
  error: string,
  dependencies: WorldMigrationDependencies,
): void {
  const message = formatMessage(
    "PIVOT.Migration.DocumentFailed",
    {
      id: SCHEMA_MIGRATION_ID,
      name: document.name ?? document.id ?? "unknown",
      error,
    },
    dependencies,
  );
  dependencies.notify?.("warn", message);
  dependencies.log?.(message, document);
}

function listDocuments(
  collection: Iterable<MigratableDocument> | { contents: Iterable<MigratableDocument> } | undefined,
): MigratableDocument[] {
  if (!collection) return [];
  if ("contents" in collection) return Array.from(collection.contents);
  return Array.from(collection);
}

function formatMessage(
  key: string,
  data: Record<string, string>,
  dependencies: WorldMigrationDependencies,
): string {
  const template = dependencies.game?.i18n?.localize?.(key) || key;
  return Object.entries(data).reduce(
    (text, [token, value]) => text.replaceAll(`{${token}}`, value),
    template,
  );
}

export function planAllActorMigrations(source: unknown, type?: string): MigrationPlan {
  const first = planActorMigration(source);
  if (!first.ok || (type && type !== "character")) return first;
  const second = planSurvivalMigration(source);
  if (!second.ok) return second;
  if (!first.changed && !second.changed) return { ok: true, changed: false };
  return {
    ok: true,
    changed: true,
    update: { ...(first.changed ? first.update : {}), ...(second.changed ? second.update : {}) },
  };
}
