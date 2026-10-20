import type { FoundryHooks } from "../foundry-runtime";
import { characterMpMaximum, clampMp } from "../rules/resources";

type ItemLike = { system?: unknown; parent?: ActorLike };

type ActorLike = {
  type?: string;
  system?: unknown;
  items?: Iterable<ItemLike> | { contents: Iterable<ItemLike> };
  ownership?: Record<string, number>;
  _source?: { system?: unknown };
  toObject?: () => { system?: unknown };
  update?: (data: Record<string, unknown>) => unknown;
};

type ClientUser = { id?: string; active?: boolean; isGM?: boolean };

type ClientGame = {
  user?: { id?: string; isGM?: boolean };
  users?:
    | Iterable<ClientUser>
    | {
        activeGM?: { id?: string; isSelf?: boolean } | null;
        contents?: Iterable<ClientUser>;
      };
};

const FOUNDRY_OWNERSHIP_OWNER = 3;

export function clampMpOnActorUpdate(actor: ActorLike, changes: Record<string, unknown>): void {
  if (actor.type !== "character") return;
  const next = projectSystem(readStoredSystem(actor), changes);
  const current = readMpValue(next);
  if (current === undefined) return;
  const clamped = clampMp(current, characterMpMaximum(next, listItems(actor)));
  if (clamped === current) return;
  writeMpValue(changes, clamped);
}

export function clampStoredMp(actor: ActorLike, game: ClientGame | undefined = readGame()): void {
  if (actor.type !== "character" || !actor.update) return;
  if (!thisClientPersistsMpClamp(actor, game)) return;
  const stored = readStoredSystem(actor);
  const current = readMpValue(stored);
  if (current === undefined) return;
  const clamped = clampMp(current, characterMpMaximum(stored, listItems(actor)));
  if (clamped === current) return;
  void actor.update({ "system.magic.mp.value": clamped });
}

export function registerMpClampHooks(hooks: Pick<FoundryHooks, "on">): void {
  hooks.on?.("preUpdateActor", (actor, changes) => {
    clampMpOnActorUpdate(actor, changes);
    return undefined;
  });
  const onItem = (item: unknown) => {
    const parent = (item as ItemLike | null)?.parent;
    if (parent) clampStoredMp(parent);
  };
  hooks.on?.("createItem", onItem);
  hooks.on?.("updateItem", onItem);
  hooks.on?.("deleteItem", onItem);
}

function readGame(): ClientGame | undefined {
  return (globalThis as { game?: ClientGame }).game;
}

function thisClientPersistsMpClamp(actor: ActorLike, game: ClientGame | undefined): boolean {
  if (!game) return true;
  const activeGmSelf = activeGmIsSelf(game);
  if (activeGmSelf !== undefined) return activeGmSelf;
  const listed = listClientUsers(game);
  const activeGms = listed.filter(isActiveGm).sort(byId);
  const activeGm = activeGms[0];
  if (activeGm) return activeGm.id === game.user?.id;
  const owners = listed.filter((user) => isActiveOwner(actor, user)).sort(byId);
  const writer = owners[0];
  return writer !== undefined && writer.id === game.user?.id;
}

function activeGmIsSelf(game: ClientGame): boolean | undefined {
  const users = game.users;
  if (!users || typeof users !== "object" || Array.isArray(users) || !("activeGM" in users)) {
    return undefined;
  }
  if (!users.activeGM) return undefined;
  return users.activeGM.isSelf === true;
}

function listClientUsers(game: ClientGame): ClientUser[] {
  const users = game.users;
  if (!users) return [];
  if (isRecord(users) && "contents" in users && users.contents) return Array.from(users.contents);
  if (typeof users === "object" && Symbol.iterator in Object(users)) {
    return Array.from(users as Iterable<ClientUser>);
  }
  return [];
}

function isActiveGm(user: ClientUser): boolean {
  return user.active === true && user.isGM === true && typeof user.id === "string";
}

function isActiveOwner(actor: ActorLike, user: ClientUser): boolean {
  return (
    user.active === true &&
    typeof user.id === "string" &&
    ownershipLevel(actor, user.id) >= FOUNDRY_OWNERSHIP_OWNER
  );
}

function ownershipLevel(actor: ActorLike, userId: string): number {
  const ownership = actor.ownership;
  if (!ownership) return 0;
  const specific = ownership[userId];
  if (typeof specific === "number") return specific;
  return typeof ownership.default === "number" ? ownership.default : 0;
}

function byId(left: ClientUser, right: ClientUser): number {
  const a = left.id ?? "";
  const b = right.id ?? "";
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function readStoredSystem(document: {
  system?: unknown;
  _source?: { system?: unknown };
  toObject?: () => { system?: unknown };
}): unknown {
  if (typeof document.toObject === "function") {
    try {
      const object = document.toObject();
      if (isRecord(object) && "system" in object) return object.system;
    } catch {
      // Fall through to source data.
    }
  }
  if (isRecord(document._source) && "system" in document._source) return document._source.system;
  return document.system;
}

function listItems(actor: ActorLike): { system?: unknown }[] {
  const items = actor.items;
  if (!items) return [];
  if (typeof items === "object" && "contents" in items) return Array.from(items.contents);
  if (typeof items === "object" && Symbol.iterator in Object(items)) {
    return Array.from(items as Iterable<ItemLike>);
  }
  return [];
}

function readMpValue(system: unknown): number | undefined {
  if (!isRecord(system) || !isRecord(system.magic) || !isRecord(system.magic.mp)) return undefined;
  return typeof system.magic.mp.value === "number" ? system.magic.mp.value : undefined;
}

function projectSystem(stored: unknown, changes: Record<string, unknown>): Record<string, unknown> {
  const next = isRecord(stored) ? cloneRecord(stored) : {};
  if (isRecord(changes.system)) mergeRecord(next, changes.system);
  for (const [key, value] of Object.entries(changes)) {
    if (!key.startsWith("system.")) continue;
    setPath(next, key.slice("system.".length).split("."), value);
  }
  return next;
}

function writeMpValue(changes: Record<string, unknown>, value: number): void {
  const dotted = "system.magic.mp.value";
  if (!isRecord(changes.system)) {
    changes[dotted] = value;
    return;
  }
  if (dotted in changes) changes[dotted] = value;
  const system = changes.system;
  const magic = isRecord(system.magic) ? system.magic : {};
  const mp = isRecord(magic.mp) ? magic.mp : {};
  mp.value = value;
  magic.mp = mp;
  system.magic = magic;
  changes.system = system;
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      isRecord(entry) ? cloneRecord(entry) : entry,
    ]),
  );
}

function mergeRecord(target: Record<string, unknown>, patch: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(patch)) {
    if (isRecord(value) && isRecord(target[key])) {
      mergeRecord(target[key] as Record<string, unknown>, value);
    } else {
      target[key] = isRecord(value) ? cloneRecord(value) : value;
    }
  }
}

function setPath(target: Record<string, unknown>, path: string[], value: unknown): void {
  if (path.length === 0) return;
  let current = target;
  for (const key of path.slice(0, -1)) {
    if (!isRecord(current[key])) current[key] = {};
    current = current[key] as Record<string, unknown>;
  }
  const leaf = path[path.length - 1];
  if (leaf !== undefined) current[leaf] = value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
