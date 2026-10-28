import { HP_LINK_MIGRATION_ID, planHpLinkMigration, planTokenDeltaHp } from "./m004";
import { planSurvivalMigration, SURVIVAL_MIGRATION_ID } from "./m002";
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
  _source?: { system?: unknown; prototypeToken?: { actorLink?: unknown } };
  toObject?: () => { system?: unknown; prototypeToken?: { actorLink?: unknown } };
  items?: Iterable<MigratableDocument> | { contents: Iterable<MigratableDocument> };
  update?: (data: Record<string, unknown>) => Promise<unknown>;
}

export interface WorldMigrationGame {
  user?: { isGM?: boolean };
  actors?: Iterable<MigratableDocument> | { contents: Iterable<MigratableDocument> };
  items?: Iterable<MigratableDocument> | { contents: Iterable<MigratableDocument> };
  scenes?:
    | Iterable<{ tokens?: Iterable<SceneToken> }>
    | {
        contents: Iterable<{
          tokens?: Iterable<SceneToken>;
        }>;
      };
  i18n?: { localize?: (key: string) => string };
}

interface SceneToken {
  actorLink?: boolean;
  actorId?: string;
  actor?: MigratableDocument | null;
  delta?: MigratableDocument | null;
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
  const sceneTokens = sceneList.flatMap((scene) => Array.from(scene.tokens ?? []));
  const actors = listDocuments(game.actors);
  const actorsById = new Map(
    actors.flatMap((actor) => (actor.id ? [[actor.id, actor] as const] : [])),
  );
  // Snapshot every migration before writes so base Actor updates cannot hide token deltas.
  const planned: Array<{ document: MigratableDocument; plan: MigrationPlan }> = listDocuments(
    game.items,
  ).map((document) => ({ document, plan: planItemMigration(readStoredSystem(document)) }));
  for (const actor of actors) {
    planned.push({
      document: actor,
      plan: planAllActorMigrations(readStoredSystem(actor), actor.type, prototypeLink(actor, true)),
    });
    for (const item of listDocuments(actor.items))
      planned.push({ document: item, plan: planItemMigration(readStoredSystem(item)) });
  }
  for (const token of sceneTokens) {
    if (token.actorLink !== false || !token.actor) continue;
    planned.push({
      document: token.actor,
      plan: planUnlinkedToken(token, actorsById),
    });
    for (const item of listDocuments(token.actor.items))
      planned.push({ document: item, plan: planItemMigration(readStoredSystem(item)) });
  }
  const wrote = new Set<MigratableDocument>();
  for (const entry of planned) {
    const result = await persistMigration(entry.document, entry.plan, dependencies);
    if (result.updated > 0) wrote.add(entry.document);
    updated += result.updated;
    failed += result.failed;
  }
  for (const token of sceneTokens) {
    if (token.actorLink !== false || token.actor?.type !== "character") continue;
    if (!token.actor || !wrote.has(token.actor)) continue;
    dependencies.log?.(
      formatMessage(
        "PIVOT.Migration.TokenLeftUnlinked",
        { name: token.actor.name ?? token.actor.id ?? "unknown" },
        dependencies,
      ),
    );
  }

  if (updated > 0 || failed > 0) {
    const summary = formatMessage(
      "PIVOT.Migration.Complete",
      {
        id: `${SCHEMA_MIGRATION_ID} / ${SURVIVAL_MIGRATION_ID} / ${HP_LINK_MIGRATION_ID}`,
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

export function planAllActorMigrations(
  source: unknown,
  type?: string,
  prototype?: { linkPrototype: boolean; hasPrototypeToken: boolean; actorLink?: unknown },
  options?: { repairHp?: boolean },
): MigrationPlan {
  const first = planActorMigration(source);
  if (!first.ok) return first;
  const survival =
    type && type !== "character"
      ? ({ ok: true, changed: false } as const)
      : planSurvivalMigration(source);
  if (!survival.ok) return survival;
  const hp =
    options?.repairHp === false
      ? ({ ok: true, changed: false } as const)
      : planHpLinkMigration({
          type,
          system: source,
          linkPrototype: prototype?.linkPrototype === true,
          hasPrototypeToken: prototype?.hasPrototypeToken === true,
          actorLink: prototype?.actorLink,
        });
  if (!hp.ok) return hp;
  if (!first.changed && !survival.changed && !hp.changed) return { ok: true, changed: false };
  return {
    ok: true,
    changed: true,
    update: {
      ...(first.changed ? first.update : {}),
      ...(survival.changed ? survival.update : {}),
      ...(hp.changed ? hp.update : {}),
    },
  };
}

function planUnlinkedToken(
  token: SceneToken,
  actorsById: Map<string, MigratableDocument>,
): MigrationPlan {
  const actor = token.actor;
  if (!actor) return { ok: true, changed: false };
  const merged = readStoredSystem(actor);
  const structural = planAllActorMigrations(merged, actor.type, prototypeLink(actor, false), {
    repairHp: false,
  });
  const base = token.actorId ? actorsById.get(token.actorId) : undefined;
  return mergeMigrationPlans(
    structural,
    planTokenDeltaHp({
      deltaSystem: token.delta ? readStoredSystem(token.delta) : undefined,
      baseSystem: base ? readStoredSystem(base) : undefined,
    }),
  );
}

function mergeMigrationPlans(left: MigrationPlan, right: MigrationPlan): MigrationPlan {
  if (!left.ok) return left;
  if (!right.ok) return right;
  if (!left.changed && !right.changed) return { ok: true, changed: false };
  return {
    ok: true,
    changed: true,
    update: {
      ...(left.changed ? left.update : {}),
      ...(right.changed ? right.update : {}),
    },
  };
}

function prototypeLink(
  actor: MigratableDocument,
  linkPrototype: boolean,
): { linkPrototype: boolean; hasPrototypeToken: boolean; actorLink?: unknown } {
  const token = readStoredPrototypeToken(actor);
  return {
    linkPrototype: linkPrototype && actor.type === "character",
    hasPrototypeToken: token !== undefined,
    actorLink: token?.actorLink,
  };
}

function readStoredPrototypeToken(
  document: MigratableDocument,
): { actorLink?: unknown } | undefined {
  const root = readStoredRoot(document);
  const token = root?.prototypeToken;
  if (!isRecord(token)) return undefined;
  return token;
}

function readStoredRoot(document: MigratableDocument): Record<string, unknown> | undefined {
  const object = callToObject(document);
  if (isRecord(object)) return object;
  if (isRecord(document._source)) return document._source;
  return undefined;
}

function callToObject(document: MigratableDocument): unknown {
  if (typeof document.toObject !== "function") return undefined;
  try {
    return document.toObject();
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
