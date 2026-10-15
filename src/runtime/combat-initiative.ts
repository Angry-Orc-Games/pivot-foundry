import { waitForDice3D } from "./dice3d";
import { applyChatMessageMode, toMessageMode } from "./ui";

export interface InitiativeRollLike {
  total?: number;
  evaluate(): Promise<unknown>;
  toMessage(
    data: Record<string, unknown>,
    options: { create?: boolean; messageMode?: string },
  ): Promise<Record<string, unknown>>;
}

export interface InitiativeCombatantLike {
  id?: string;
  isOwner?: boolean;
  name?: string;
  hidden?: boolean;
  actor?: unknown;
  token?: unknown;
  getInitiativeRoll?: (formula?: string | null) => InitiativeRollLike;
}

export interface InitiativeCombatLike {
  combatant?: { id?: string | null } | null;
  turns?: Array<{ id?: string | null }>;
  combatants: {
    get: (id: string) => InitiativeCombatantLike | undefined;
  };
  updateEmbeddedDocuments: (embeddedName: string, updates: object[]) => Promise<unknown>;
  update: (data: Record<string, unknown>) => Promise<unknown>;
}

export interface RollInitiativeOptions {
  formula?: string | null;
  messageMode?: string;
  messageOptions?: Record<string, unknown>;
  updateTurn?: boolean;
  rollMode?: string;
}

export interface RollInitiativeDeps {
  waitForDice3D?: (message: unknown) => Promise<void>;
}

function chatMessageApi(): {
  create?: (data: unknown) => Promise<unknown>;
  createDocuments?: (data: unknown[]) => Promise<unknown>;
  implementation?: {
    create?: (data: unknown) => Promise<unknown>;
    createDocuments?: (data: unknown[]) => Promise<unknown>;
  };
  getSpeaker?: (opts: Record<string, unknown>) => unknown;
} {
  return (globalThis as typeof globalThis & { ChatMessage?: ReturnType<typeof chatMessageApi> })
    .ChatMessage as ReturnType<typeof chatMessageApi>;
}

function localizeInitiative(name: string): string {
  const game = (
    globalThis as typeof globalThis & {
      game?: { i18n?: { format?: (key: string, data: Record<string, unknown>) => string } };
    }
  ).game;
  return game?.i18n?.format?.("COMBAT.RollsInitiative", { name }) ?? `${name} rolls for Initiative`;
}

function defaultRollMode(): string {
  const game = (
    globalThis as typeof globalThis & {
      game?: { settings?: { get?: (scope: string, key: string) => unknown } };
    }
  ).game;
  const messageMode = game?.settings?.get?.("core", "messageMode");
  if (typeof messageMode === "string") return messageMode;
  const rollMode = game?.settings?.get?.("core", "rollMode");
  return typeof rollMode === "string" ? rollMode : "public";
}

function normalizeCreatedMessages(created: unknown): unknown[] {
  if (Array.isArray(created)) return created;
  if (created == null) return [];
  return [created];
}

/**
 * Core Foundry updates combatant initiative before creating chat messages.
 * Reorder to: evaluate → create chat (DSN starts) → wait for animation → update combatants.
 */
export async function rollInitiativeWaitingForDice3D(
  combat: InitiativeCombatLike,
  ids: string | string[],
  options: RollInitiativeOptions = {},
  deps: RollInitiativeDeps = {},
): Promise<InitiativeCombatLike> {
  const idList = typeof ids === "string" ? [ids] : ids;
  const { formula = null, updateTurn = true, messageOptions = {}, messageMode, rollMode } = options;
  const wait = deps.waitForDice3D ?? waitForDice3D;
  const currentId = combat.combatant?.id ?? null;

  const updates: Array<{ _id: string; initiative: number }> = [];
  const messageDataList: Record<string, unknown>[] = [];

  for (const [index, id] of idList.entries()) {
    const combatant = combat.combatants.get(id);
    if (!combatant?.isOwner) continue;
    if (!combatant.getInitiativeRoll) continue;

    const roll = combatant.getInitiativeRoll(formula);
    await roll.evaluate();
    if (typeof roll.total !== "number" || !Number.isFinite(roll.total)) continue;

    updates.push({ _id: id, initiative: roll.total });

    const ChatMessage = chatMessageApi();
    const baseData: Record<string, unknown> = {
      speaker: ChatMessage?.getSpeaker?.({
        actor: combatant.actor,
        token: combatant.token,
        alias: combatant.name,
      }) ?? { alias: combatant.name },
      flavor: localizeInitiative(combatant.name ?? "Combatant"),
      flags: { core: { initiativeRoll: true } },
      ...messageOptions,
    };

    const mode = messageMode ?? rollMode ?? (combatant.hidden ? "gm" : defaultRollMode());

    const chatData = await roll.toMessage(baseData, {
      create: false,
      messageMode: toMessageMode(mode),
    });
    applyChatMessageMode(chatData, mode);
    if (index > 0) chatData.sound = null;
    messageDataList.push(chatData);
  }

  if (!updates.length) return combat;

  // Document.create/createDocuments are static methods that read `this.implementation`;
  // they must be invoked on the class, never as a detached function reference.
  const ChatMessage = chatMessageApi();
  const Cls = ChatMessage?.implementation ?? ChatMessage;
  let created: unknown = [];
  if (Cls?.createDocuments) created = await Cls.createDocuments(messageDataList);
  else if (Cls?.create) created = await Cls.create(messageDataList);
  for (const message of normalizeCreatedMessages(created)) {
    await wait(message);
  }

  await combat.updateEmbeddedDocuments("Combatant", updates);

  if (updateTurn && currentId && combat.turns) {
    const turn = combat.turns.findIndex((entry) => entry.id === currentId);
    if (turn >= 0) await combat.update({ turn });
  }

  return combat;
}

let installed = false;

/** Patch Combat.prototype.rollInitiative so tracker rolls wait for Dice So Nice. */
export function installCombatInitiativeDice3DWait(): void {
  if (installed) return;
  const Combat = (
    globalThis as typeof globalThis & {
      Combat?: { prototype: { rollInitiative?: (...args: never[]) => Promise<unknown> } };
    }
  ).Combat;
  if (!Combat?.prototype) return;

  Combat.prototype.rollInitiative = async function (
    this: InitiativeCombatLike,
    ids: string | string[],
    options?: RollInitiativeOptions,
  ) {
    return rollInitiativeWaitingForDice3D(this, ids, options ?? {});
  } as never;

  installed = true;
}

/** Test helper to allow re-install after stubbing Combat. */
export function resetCombatInitiativeDice3DWaitForTests(): void {
  installed = false;
}
