import { guardCharacterHpWrite, guardHpMaximum } from "../../src/runtime/actor-guards";
import type { SurvivalActor } from "../../src/runtime/survival-transaction";
import type { SurvivalState } from "../../src/rules/survival";

type PreUpdateGuard = (
  actor: InMemoryActor,
  changes: Record<string, unknown>,
  options: Record<string, unknown>,
) => false | undefined;

export interface InMemoryActor extends SurvivalActor {
  update: (data: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown>;
  /** Writes that reached the document, after guards ran. */
  writes: Array<Record<string, unknown>>;
}

/** The registered preUpdateActor guards, in registration order. */
export const PRE_UPDATE_ACTOR_GUARDS: PreUpdateGuard[] = [guardHpMaximum, guardCharacterHpWrite];

function expand(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(data)) {
    const keys = path.split(".");
    let node = out;
    for (const key of keys.slice(0, -1)) {
      node[key] = (node[key] as Record<string, unknown> | undefined) ?? {};
      node = node[key] as Record<string, unknown>;
    }
    const last = keys[keys.length - 1] ?? path;
    const nested = value !== null && typeof value === "object" && !Array.isArray(value);
    node[last] = nested ? expand(value as Record<string, unknown>) : value;
  }
  return out;
}

function merge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(source)) {
    const current = target[key];
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      if (current === null || typeof current !== "object") target[key] = {};
      merge(target[key] as Record<string, unknown>, value as Record<string, unknown>);
    } else target[key] = value;
  }
}

/**
 * A Character document double that behaves like Foundry where survival writes depend on it:
 * updates are expanded, pass through the preUpdateActor guards, and then change `system`.
 */
export function inMemoryCharacter(
  survival: Partial<SurvivalState> = {},
  extra: { uuid?: string; system?: Record<string, unknown>; guards?: PreUpdateGuard[] } = {},
): InMemoryActor {
  const s = { hp: 10, max: 20, temp: 0, successes: 0, failures: 0, status: "alive", ...survival };
  const actor: InMemoryActor = {
    uuid: extra.uuid ?? "Actor.memory",
    name: "Hera",
    type: "character",
    isOwner: true,
    system: {
      ...extra.system,
      attributes: {
        hp: { value: s.hp, max: s.max, temp: s.temp },
        deathSaves: { successes: s.successes, failures: s.failures, status: s.status },
      },
    },
    writes: [],
    async update(data, options = {}) {
      const changes = expand(data);
      for (const guard of extra.guards ?? PRE_UPDATE_ACTOR_GUARDS) {
        if (guard(actor, changes, options) === false) return undefined;
      }
      merge(actor as unknown as Record<string, unknown>, changes);
      actor.writes.push(changes);
      return actor;
    },
  };
  return actor;
}
