import {
  IMPORT_MESSAGES,
  toActorData,
  validate,
  type ImportItem,
  type Result,
} from "./pivot-character";

interface CreatedActor {
  id?: string;
  _id?: string;
  delete?: () => Promise<unknown>;
  createEmbeddedDocuments?: (type: string, data: unknown[]) => Promise<unknown>;
}

interface WorldUser {
  name?: unknown;
  role?: unknown;
}

interface GameHost {
  user?: { id?: string; isGM?: boolean };
  users?: { get?: (id: string) => WorldUser | undefined };
  packs?: unknown;
}

interface PackEntry {
  _id?: string;
  name?: string;
  type?: string;
}

interface ItemPack {
  metadata?: { type?: string };
  documentName?: string;
  index?: PackEntry[] | { contents?: PackEntry[] };
  getDocument?: (id: string) => Promise<{ toObject?: () => Record<string, unknown> } | null>;
}

export async function createFromFile(
  file: unknown,
  ownerUserId: string,
): Promise<Result<{ actorId: string }>> {
  const parsed = validate(file);
  if (!parsed.ok) return parsed;

  const game = readGame();
  if (!game || game.user?.isGM !== true) {
    return { ok: false, error: { code: "forbidden", message: IMPORT_MESSAGES.forbidden } };
  }
  if (ownerUserId.length === 0) {
    return {
      ok: false,
      error: {
        code: "schema",
        field: "ownerUserId",
        message: IMPORT_MESSAGES.choosePlayer,
      },
    };
  }

  const owner = game.users?.get?.(ownerUserId);
  if (!owner || !choosableOwner(owner)) {
    return {
      ok: false,
      error: {
        code: "schema",
        field: "ownerUserId",
        message: IMPORT_MESSAGES.unknownPlayer,
      },
    };
  }

  const draft = toActorData(parsed.value);
  const player = typeof owner?.name === "string" ? owner.name : "";
  const levels = ownershipLevels();
  const ownership: Record<string, number> = { [ownerUserId]: levels.OWNER };
  const userId = game.user?.id;
  if (typeof userId === "string" && userId.length > 0 && userId !== ownerUserId) {
    // Foundry also grants the creating user ownership. INHERIT keeps the chosen player as owner.
    ownership[userId] = levels.INHERIT;
  }

  let items: Record<string, unknown>[];
  try {
    const packs = listPacks(game);
    items = [];
    for (const item of draft.items) items.push(await resolveItem(item, packs));
  } catch (error) {
    console.warn("Pivot import could not resolve items.", error);
    return {
      ok: false,
      error: { code: "incomplete", message: IMPORT_MESSAGES.incomplete },
    };
  }

  const actor = await createActor({
    name: draft.actor.name,
    type: draft.actor.type,
    system: {
      ...draft.actor.system,
      identity: { ...draft.actor.system.identity, player },
    },
    flags: draft.actor.flags,
    ownership,
  });

  const embedded = await embedItems(actor, items);
  if (!embedded.ok) {
    const removed = await removeActor(actor);
    return {
      ok: false,
      error: {
        code: "incomplete",
        message: embedMessage(removed, embedded.error),
      },
    };
  }

  const actorId = actor.id ?? actor._id;
  if (!actorId) throw new Error(IMPORT_MESSAGES.incomplete);
  return { ok: true, value: { actorId } };
}

function choosableOwner(user: WorldUser): boolean {
  return typeof user.role !== "number" || user.role !== noneRole();
}

function noneRole(): number {
  const role = (globalThis as { CONST?: { USER_ROLES?: { NONE?: number } } }).CONST?.USER_ROLES
    ?.NONE;
  return typeof role === "number" ? role : 0;
}

function readGame(): GameHost | undefined {
  return (globalThis as { game?: GameHost }).game;
}

function ownershipLevels(): { OWNER: number; INHERIT: number } {
  const levels = (
    globalThis as {
      CONST?: { DOCUMENT_OWNERSHIP_LEVELS?: { OWNER?: number; INHERIT?: number } };
    }
  ).CONST?.DOCUMENT_OWNERSHIP_LEVELS;
  return {
    OWNER: typeof levels?.OWNER === "number" ? levels.OWNER : 3,
    INHERIT: typeof levels?.INHERIT === "number" ? levels.INHERIT : -1,
  };
}

async function embedItems(
  actor: CreatedActor,
  items: Record<string, unknown>[],
): Promise<{ ok: true } | { ok: false; error: unknown }> {
  try {
    const created = await actor.createEmbeddedDocuments?.("Item", items);
    if (Array.isArray(created) && created.length === items.length) return { ok: true };
    return { ok: false, error: undefined };
  } catch (error) {
    console.warn("Pivot import could not embed items.", error);
    return { ok: false, error };
  }
}

function embedMessage(removed: boolean, error: unknown): string {
  const base = removed ? IMPORT_MESSAGES.incomplete : IMPORT_MESSAGES.cleanupFailed;
  if (!(error instanceof Error) || error.message.length === 0 || error.message === base)
    return base;
  return `${base} ${error.message}`;
}

async function removeActor(actor: CreatedActor): Promise<boolean> {
  if (!actor.delete) return false;
  try {
    await actor.delete();
    return true;
  } catch (error) {
    console.warn("Pivot import could not remove the character.", error);
    return false;
  }
}

async function createActor(data: Record<string, unknown>): Promise<CreatedActor> {
  const Actor = (globalThis as { Actor?: { create?: (data: unknown) => Promise<unknown> } }).Actor;
  if (!Actor?.create) throw new Error(IMPORT_MESSAGES.incomplete);
  const created = await Actor.create(data);
  const actor = Array.isArray(created) ? created[0] : created;
  if (!isRecord(actor)) throw new Error(IMPORT_MESSAGES.incomplete);
  return actor as CreatedActor;
}

function listPacks(game: GameHost): ItemPack[] {
  const packs = game.packs;
  if (Array.isArray(packs)) return packs.filter(isRecord) as ItemPack[];
  if (isRecord(packs) && Array.isArray(packs.contents)) {
    return packs.contents.filter(isRecord) as ItemPack[];
  }
  if (isIterable(packs)) return Array.from(packs).filter(isRecord) as ItemPack[];
  return [];
}

async function resolveItem(item: ImportItem, packs: ItemPack[]): Promise<Record<string, unknown>> {
  for (const pack of packs) {
    const kind = pack.metadata?.type ?? pack.documentName;
    if (kind !== "Item") continue;
    for (const entry of indexEntries(pack)) {
      if (entry.name !== item.name || entry.type !== item.type || !entry._id) continue;
      const document = await pack.getDocument?.(entry._id);
      const raw = document?.toObject?.();
      if (!isRecord(raw)) continue;
      const resolved: Record<string, unknown> = { ...raw };
      delete resolved._id;
      if (item.type === "feature") {
        const system = isRecord(resolved.system) ? { ...resolved.system } : {};
        system.effects = [];
        resolved.system = system;
      }
      return resolved;
    }
  }
  return { type: item.type, name: item.name, system: item.system };
}

function indexEntries(pack: ItemPack): PackEntry[] {
  const index = pack.index;
  if (Array.isArray(index)) return index;
  if (index && Array.isArray(index.contents)) return index.contents;
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIterable(value: unknown): value is Iterable<unknown> {
  return typeof value === "object" && value !== null && Symbol.iterator in value;
}
