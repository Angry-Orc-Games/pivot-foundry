import { SURVIVAL_WRITE_OPTIONS } from "../config";
import { HP_LINK_MIGRATION_ID, planHpLinkMigration, planTokenDeltaHp } from "./m004";
import { planMpClampMigration } from "./m005";
import {
  planWeaponEquippedMigration,
  WEAPON_EQUIPPED_MIGRATION_ID,
  weaponEquippedMigrationNotice,
} from "./m008";
import { planSpeciesSpeedMigration } from "./m007";
import { planSurvivalMigration, SURVIVAL_MIGRATION_ID } from "./m002";
import {
  planSchemaV2ActorMigration,
  planSchemaV2ItemMigration,
  SCHEMA_V2_MIGRATION_ID,
} from "./m003";
import {
  coreReviewLine,
  formatM006CoreReview,
  MAGIC_ECHELON_MIGRATION_ID,
  planMagicEchelonMigration,
} from "./m006";
import {
  FIELD_MIGRATION_ID,
  planSlingsProficiencyMigration,
  planWeaponFieldItemMigration,
} from "./m009";
import {
  planActorMigration,
  planItemMigration,
  SCHEMA_MIGRATION_ID,
  type MigrationNotice,
  type MigrationPlan,
} from "./m001";

export interface MigratableDocument {
  id?: string;
  name?: string;
  type?: string;
  system?: unknown;
  _source?: { system?: unknown; prototypeToken?: { actorLink?: unknown } };
  toObject?: () => {
    system?: unknown;
    flags?: unknown;
    prototypeToken?: { actorLink?: unknown };
  };
  flags?: unknown;
  items?: Iterable<MigratableDocument> | { contents: Iterable<MigratableDocument> };
  update?: (data: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown>;
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
  const coreReview: string[] = [];
  const planned: Array<{ document: MigratableDocument; plan: MigrationPlan; notice?: string }> =
    listDocuments(game.items).map((document) => itemMigrationEntry(document, coreReview));
  for (const actor of actors) {
    const mpClamp = planMpClampMigration(actorForMpClamp(actor));
    planned.push({
      document: actor,
      plan: mergeMigrationPlans(
        planAllActorMigrations(readStoredSystem(actor), actor.type, prototypeLink(actor, true)),
        mpClamp.plan,
      ),
      notice: mpClamp.notice,
    });
    for (const item of listDocuments(actor.items))
      planned.push(itemMigrationEntry(item, coreReview, actor.name));
  }
  for (const token of sceneTokens) {
    if (token.actorLink !== false || !token.actor) continue;
    const mpClamp = planMpClampMigration(actorForMpClamp(token.actor));
    planned.push({
      document: token.actor,
      plan: mergeMigrationPlans(planUnlinkedToken(token, actorsById), mpClamp.plan),
      notice: mpClamp.notice,
    });
    for (const item of listDocuments(token.actor.items))
      planned.push(itemMigrationEntry(item, coreReview, token.actor.name));
  }
  if (coreReview.length > 0) {
    const message = coreReviewMessage(coreReview, dependencies);
    dependencies.notify?.("warn", message);
    dependencies.log?.(message);
  }
  const wrote = new Set<MigratableDocument>();
  for (const entry of planned) {
    const result = await persistMigration(entry.document, entry.plan, dependencies);
    if (result.updated > 0) wrote.add(entry.document);
    updated += result.updated;
    failed += result.failed;
    if (result.updated > 0 && entry.notice) {
      dependencies.notify?.("info", entry.notice);
      dependencies.log?.(entry.notice);
    }
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
        id: `${SCHEMA_MIGRATION_ID} / ${SURVIVAL_MIGRATION_ID} / ${SCHEMA_V2_MIGRATION_ID} / ${HP_LINK_MIGRATION_ID} / M005 / ${MAGIC_ECHELON_MIGRATION_ID} / M007 / ${WEAPON_EQUIPPED_MIGRATION_ID} / ${FIELD_MIGRATION_ID}`,
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

function readStoredFlags(document: MigratableDocument): unknown {
  const object = callToObject(document);
  if (isRecord(object) && "flags" in object) return object.flags;
  return document.flags;
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
  reportNotices(document, plan.notices, dependencies);
  if (plan.log) {
    dependencies.log?.(`${document.name ?? document.id ?? "unknown"}: ${plan.log}`);
  }
  if (!plan.changed) return { updated: 0, failed: 0 };

  try {
    if (!document.update) throw new Error("Document cannot be updated");
    // Migrations may repair survival fields; they write as a trusted survival writer.
    await document.update(plan.update, {
      ...SURVIVAL_WRITE_OPTIONS,
      ...(plan.diff === false ? { diff: false } : {}),
    });
    return { updated: 1, failed: 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reportFailure(document, message, dependencies);
    return { updated: 0, failed: 1 };
  }
}

function reportNotices(
  document: MigratableDocument,
  notices: readonly MigrationNotice[] | undefined,
  dependencies: WorldMigrationDependencies,
): void {
  if (!notices?.length) return;
  const name = document.name ?? document.id ?? "unknown";
  for (const notice of notices) {
    const data: Record<string, string> = { name, field: notice.field, from: notice.from };
    if (notice.to !== undefined) data.to = notice.to;
    const message = formatMessage(notice.key, data, dependencies);
    dependencies.notify?.("warn", message);
    dependencies.log?.(message);
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
  const character = !type || type === "character";
  const survival = character
    ? planSurvivalMigration(source)
    : ({ ok: true, changed: false } as const);
  if (!survival.ok) return survival;
  const schemaV2 = character
    ? planSchemaV2ActorMigration(source)
    : ({ ok: true, changed: false } as const);
  if (!schemaV2.ok) return schemaV2;
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
  const speed = character
    ? planSpeciesSpeedMigration(source)
    : ({ ok: true, changed: false } as const);
  if (!speed.ok) return speed;
  const slings = character
    ? planSlingsProficiencyMigration(source)
    : ({ ok: true, changed: false } as const);
  if (!slings.ok) return slings;
  const plans: MigrationPlan[] = [first, survival, schemaV2, hp, speed, slings];
  const log = plans.flatMap((plan) => (plan.ok && plan.log ? [plan.log] : [])).join("\n");
  const notices = collectNotices(plans);
  if (!plans.some((plan) => plan.ok && plan.changed)) {
    return changedFalse(log, notices);
  }
  return {
    ok: true,
    changed: true,
    ...(notices.length > 0 ? { notices } : {}),
    update: {
      ...(first.changed ? first.update : {}),
      ...(survival.changed ? survival.update : {}),
      ...(schemaV2.changed ? schemaV2.update : {}),
      ...(hp.changed ? hp.update : {}),
      ...(speed.changed ? speed.update : {}),
      ...(slings.changed ? slings.update : {}),
    },
    ...(log ? { log } : {}),
  };
}

function actorForMpClamp(actor: MigratableDocument): MigratableDocument {
  const toObject = actor.toObject;
  return {
    name: actor.name,
    type: actor.type,
    system: actor.system,
    _source: actor._source,
    flags: actor.flags,
    toObject: typeof toObject === "function" ? () => toObject.call(actor) : undefined,
    items: listDocuments(actor.items).map(itemForMpClamp),
  };
}

function itemForMpClamp(item: MigratableDocument): MigratableDocument {
  const stored = readStoredSystem(item);
  const plan = planWeaponEquippedMigration(stored, item.type, readStoredFlags(item));
  if (!plan.ok || !plan.changed || plan.update["system.equipped"] !== true) return item;
  const system = isRecord(stored) ? { ...stored, equipped: true } : { equipped: true };
  return {
    type: item.type,
    system,
    toObject: () => ({ system }),
  };
}

function itemMigrationEntry(
  document: MigratableDocument,
  coreReview: string[],
  actorName?: string,
): { document: MigratableDocument; plan: MigrationPlan; notice?: string } {
  const line = coreReviewLine(
    document,
    readStoredSystem(document),
    actorName ?? undefined,
    rawSystem(document),
  );
  if (line) coreReview.push(line);
  const plan = combineItemMigrations(document);
  return { document, plan, notice: weaponEquippedNotice(document, plan, actorName) };
}

function rawSystem(document: MigratableDocument): object | undefined {
  const system = document._source?.system;
  if (typeof system === "object" && system !== null && !Array.isArray(system)) return system;
  return undefined;
}

function combineItemMigrations(document: MigratableDocument): MigrationPlan {
  const source = readStoredSystem(document);
  const raw = rawSystem(document);
  const first = planItemMigration(source);
  if (!first.ok) return first;
  const second = planSchemaV2ItemMigration(source);
  if (!second.ok) return second;
  const third = planWeaponEquippedMigration(source, document.type, readStoredFlags(document));
  if (!third.ok) return third;
  const echelon = planMagicEchelonMigration(source, raw);
  if (!echelon.ok) return echelon;
  const fields = planWeaponFieldItemMigration(source, document.type);
  if (!fields.ok) return fields;
  const notices = collectNotices([first, second, third, echelon, fields]);
  if (!first.changed && !second.changed && !third.changed && !echelon.changed && !fields.changed) {
    return changedFalse("", notices);
  }
  return {
    ok: true,
    changed: true,
    ...(notices.length > 0 ? { notices } : {}),
    ...(echelon.changed && echelon.diff === false ? { diff: false as const } : {}),
    update: {
      ...(first.changed ? first.update : {}),
      ...(second.changed ? second.update : {}),
      ...(third.changed ? third.update : {}),
      ...(echelon.changed ? echelon.update : {}),
      ...(fields.changed ? fields.update : {}),
    },
  };
}

function weaponEquippedNotice(
  document: MigratableDocument,
  plan: MigrationPlan,
  actorName?: string,
): string | undefined {
  if (!plan.ok || !plan.changed || !("system.equipped" in plan.update)) return undefined;
  const equipped = plan.update["system.equipped"] === true;
  const itemType = document.type === "equipment" ? "equipment" : "weapon";
  return weaponEquippedMigrationNotice(
    document.name ?? document.id ?? "unknown",
    actorName,
    equipped,
    itemType,
  );
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
  const log = [left.log, right.log].filter(Boolean).join("\n");
  const notices = collectNotices([left, right]);
  if (!left.changed && !right.changed) return changedFalse(log, notices);
  return {
    ok: true,
    changed: true,
    update: {
      ...(left.changed ? left.update : {}),
      ...(right.changed ? right.update : {}),
    },
    ...(notices.length > 0 ? { notices } : {}),
    ...(log ? { log } : {}),
  };
}

function collectNotices(plans: readonly MigrationPlan[]): MigrationNotice[] {
  return plans.flatMap((plan) => (plan.ok && plan.notices ? [...plan.notices] : []));
}

function changedFalse(log: string, notices: readonly MigrationNotice[]): MigrationPlan {
  return {
    ok: true,
    changed: false,
    ...(notices.length > 0 ? { notices } : {}),
    ...(log ? { log } : {}),
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

function coreReviewMessage(
  lines: readonly string[],
  dependencies: WorldMigrationDependencies,
): string {
  const localized = formatMessage("PIVOT.Migration.M006CoreReview", {}, dependencies);
  const instruction = localized === "PIVOT.Migration.M006CoreReview" ? undefined : localized;
  return instruction ? [instruction, ...lines].join("\n") : formatM006CoreReview(lines);
}
