import { SYSTEM_ID } from "../config";
import {
  effectiveSurvival,
  SURVIVAL_STATUSES,
  validateSurvival,
  type SurvivalState,
  type SurvivalStatus,
} from "../rules/survival";
import { runtime } from "./ui";

export interface SurvivalActor {
  uuid?: string;
  token?: { name?: string };
  name: string;
  type: string;
  isOwner?: boolean;
  system: Record<string, unknown>;
  update?: (data: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown>;
}

export function readSurvival(actor: SurvivalActor): SurvivalState {
  const attributes = actor.system.attributes as
    | {
        hp?: { value?: number; max?: number; temp?: number };
        deathSaves?: { successes?: number; failures?: number; status?: string };
      }
    | undefined;
  const hp = attributes?.hp;
  const saves = attributes?.deathSaves;
  const status = saves?.status;
  return {
    hp: hp?.value ?? 0,
    max: hp?.max ?? 0,
    temp: hp?.temp ?? 0,
    successes: saves?.successes ?? 0,
    failures: saves?.failures ?? 0,
    status: SURVIVAL_STATUSES.includes(status as SurvivalStatus)
      ? (status as SurvivalStatus)
      : "unconfirmed",
  };
}

/** Update option that marks a write as a Survival transaction (or a trusted migration). */
export const SURVIVAL_WRITE_OPTIONS = { [SYSTEM_ID]: { survivalWrite: true } } as const;

export function isSurvivalWrite(options: unknown): boolean {
  const scoped = (options as Record<string, unknown> | undefined)?.[SYSTEM_ID] as
    | { survivalWrite?: unknown }
    | undefined;
  return scoped?.survivalWrite === true;
}

export function survivalUpdate(s: SurvivalState): Record<string, unknown> {
  return {
    "system.attributes.hp.value": s.hp,
    "system.attributes.hp.temp": s.temp,
    "system.attributes.deathSaves.successes": s.successes,
    "system.attributes.deathSaves.failures": s.failures,
    "system.attributes.deathSaves.status": s.status,
  };
}

/** What the caller wants written: the next Survival state plus any non-survival fields. */
export interface SurvivalChange {
  next: SurvivalState;
  extra?: Record<string, unknown>;
}

export interface SurvivalTransactionOptions {
  /** Only a GM may run this transaction (a Survival correction). */
  gmOnly?: boolean;
  /** Other fields the change depends on; a change to them refuses the write, as survival does. */
  watch?: () => unknown;
  /** A caller's own precondition, checked with ownership and the snapshot just before the write. */
  stillValid?: () => boolean;
}

export type SurvivalOutcome =
  | "updated"
  | "busy"
  | "denied"
  | "changed"
  | "invalid"
  | "cancelled"
  | "failed";

export interface SurvivalTransactionResult {
  outcome: SurvivalOutcome;
  /** The effective survival state the change started from. */
  before?: SurvivalState;
  /** The state written, when the outcome is "updated" or "failed". */
  after?: SurvivalState;
}

/**
 * Local guard only: Foundry offers no cross-client transaction, so another client can still
 * write between our snapshot and our update. The snapshot check narrows that window.
 */
const busy = new Set<string>();
/** @deprecated Transitional: death saves and rests share the lock until they run as transactions. */
export const survivalLocks = busy;

/**
 * Run one Survival transaction on a Character: take the lock, hand the effective survival
 * state to `change` (which may open dialogs and roll dice), then recheck and make one write.
 * A rejected write may still have committed on the server, so it is reported, never retried.
 */
export async function runSurvivalTransaction(
  actor: SurvivalActor,
  change: (state: SurvivalState) => Promise<SurvivalChange | null> | SurvivalChange | null,
  options: SurvivalTransactionOptions = {},
): Promise<SurvivalTransactionResult> {
  const uuid = actor.uuid;
  const permitted = (): boolean =>
    actor.isOwner === true &&
    actor.update !== undefined &&
    (!options.gmOnly || runtime().game?.user?.isGM === true);
  if (!uuid || !permitted()) return { outcome: "denied" };
  if (busy.has(uuid)) return { outcome: "busy" };
  busy.add(uuid);
  try {
    const snapshot = (): string => JSON.stringify([readSurvival(actor), options.watch?.()]);
    const taken = snapshot();
    const before = effectiveSurvival(readSurvival(actor));
    let requested: SurvivalChange | null;
    try {
      requested = await change(before);
    } catch (error) {
      return { outcome: error instanceof RangeError ? "invalid" : "failed", before };
    }
    if (!requested) return { outcome: "cancelled", before };
    if (!permitted()) return { outcome: "denied", before };
    if (snapshot() !== taken || options.stillValid?.() === false)
      return { outcome: "changed", before };
    const after = requested.next;
    try {
      validateSurvival(after);
    } catch {
      return { outcome: "invalid", before };
    }
    try {
      await actor.update?.(
        { ...survivalUpdate(after), ...requested.extra },
        { ...SURVIVAL_WRITE_OPTIONS },
      );
    } catch {
      return { outcome: "failed", before, after };
    }
    return { outcome: "updated", before, after };
  } finally {
    busy.delete(uuid);
  }
}
