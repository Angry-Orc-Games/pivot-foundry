import { planSurvivalMigration } from "./m002";
import { planSchemaV2ActorMigration, planSchemaV2ItemMigration } from "./m003";
import {
  coreReviewLine,
  formatM006CoreReview,
  MAGIC_ECHELON_MIGRATION_ID,
  planMagicEchelonMigration,
} from "./m006";
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
  update?: (data: Record<string, unknown>, options?: { diff?: boolean }) => Promise<unknown>;
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
  // Snapshot every migration before writes so base Actor updates cannot hide token deltas.
  const coreReview: string[] = [];
  const planned: Array<{ document: MigratableDocument; plan: MigrationPlan }> = listDocuments(
    game.items,
  ).map((document) => {
    const stored = readStoredSystem(document);
    const raw = rawSystem(document);
    const line = coreReviewLine(document, stored, undefined, raw);
    if (line) coreReview.push(line);
    return {
      document,
      plan: combineItemMigrations(stored, raw),
    };
  });
  for (const actor of [...listDocuments(game.actors), ...syntheticActors]) {
    planned.push({
      document: actor,
      plan: planAllActorMigrations(readStoredSystem(actor), actor.type),
    });
    const actorName = actor.name ?? actor.id ?? "unknown";
    for (const item of listDocuments(actor.items)) {
      const stored = readStoredSystem(item);
      const raw = rawSystem(item);
      const line = coreReviewLine(item, stored, actorName, raw);
      if (line) coreReview.push(line);
      planned.push({
        document: item,
        plan: combineItemMigrations(stored, raw),
      });
    }
  }
  if (coreReview.length > 0) {
    const message = coreReviewMessage(coreReview, dependencies);
    dependencies.notify?.("warn", message);
    dependencies.log?.(message);
  }
  for (const entry of planned) {
    const result = await persistMigration(entry.document, entry.plan, dependencies);
    updated += result.updated;
    failed += result.failed;
  }

  if (updated > 0 || failed > 0) {
    const summary = formatMessage(
      "PIVOT.Migration.Complete",
      {
        id: `${SCHEMA_MIGRATION_ID} / M002 / M003 / ${MAGIC_ECHELON_MIGRATION_ID}`,
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
    await document.update(plan.update, plan.diff === false ? { diff: false } : undefined);
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
  const third = planSchemaV2ActorMigration(source);
  if (!third.ok) return third;
  if (!first.changed && !second.changed && !third.changed) return { ok: true, changed: false };
  return {
    ok: true,
    changed: true,
    update: {
      ...(first.changed ? first.update : {}),
      ...(second.changed ? second.update : {}),
      ...(third.changed ? third.update : {}),
    },
  };
}

function rawSystem(document: MigratableDocument): object | undefined {
  const system = document._source?.system;
  if (typeof system === "object" && system !== null && !Array.isArray(system)) return system;
  return undefined;
}

function combineItemMigrations(source: unknown, raw?: object): MigrationPlan {
  const first = planItemMigration(source);
  if (!first.ok) return first;
  const second = planSchemaV2ItemMigration(source);
  if (!second.ok) return second;
  const echelon = planMagicEchelonMigration(source, raw);
  if (!echelon.ok) return echelon;
  if (!first.changed && !second.changed && !echelon.changed) return { ok: true, changed: false };
  return {
    ok: true,
    changed: true,
    ...(echelon.changed && echelon.diff === false ? { diff: false as const } : {}),
    update: {
      ...(first.changed ? first.update : {}),
      ...(second.changed ? second.update : {}),
      ...(echelon.changed ? echelon.update : {}),
    },
  };
}

function coreReviewMessage(
  lines: readonly string[],
  dependencies: WorldMigrationDependencies,
): string {
  const localized = formatMessage("PIVOT.Migration.M006CoreReview", {}, dependencies);
  const instruction = localized === "PIVOT.Migration.M006CoreReview" ? undefined : localized;
  return instruction ? [instruction, ...lines].join("\n") : formatM006CoreReview(lines);
}
