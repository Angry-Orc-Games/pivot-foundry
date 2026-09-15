import {
  applyHealth,
  SURVIVAL_STATUSES,
  validAmount,
  type HealthKind,
  type SurvivalState,
  type SurvivalStatus,
} from "../rules/survival";
export interface HealthActor {
  uuid?: string;
  name: string;
  type: string;
  isOwner?: boolean;
  system: Record<string, unknown>;
  update?: (data: Record<string, unknown>) => Promise<unknown>;
}
export function readSurvival(actor: HealthActor): SurvivalState {
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
export function survivalUpdate(s: SurvivalState): Record<string, unknown> {
  return {
    "system.attributes.hp.value": s.hp,
    "system.attributes.hp.temp": s.temp,
    "system.attributes.deathSaves.successes": s.successes,
    "system.attributes.deathSaves.failures": s.failures,
    "system.attributes.deathSaves.status": s.status,
  };
}
export function uniqueHealthTargets(actors: HealthActor[]): HealthActor[] {
  const seen = new Set<string>();
  return actors.filter((actor) => {
    if (actor.type !== "character" || !actor.uuid || seen.has(actor.uuid)) return false;
    seen.add(actor.uuid);
    return true;
  });
}
/** A write rejection can mean the server committed; never retry this operation/target automatically. */
export const busyHealthActors = new Set<string>();
export class HealthTransactions {
  private attempted = new Set<string>();
  async apply(
    operation: string,
    actors: HealthActor[],
    kind: HealthKind,
    amount: number,
    critical = false,
    tempChoice?: "keep" | "replace",
    revalidate: () => boolean = () => true,
  ): Promise<
    Array<{ actor: HealthActor; outcome: "updated" | "denied" | "duplicate" | "failed" }>
  > {
    if (!operation || !validAmount(amount)) throw new RangeError("Invalid application");
    const results: Array<{
      actor: HealthActor;
      outcome: "updated" | "denied" | "duplicate" | "failed";
    }> = [];
    for (const actor of uniqueHealthTargets(actors)) {
      const key = JSON.stringify([operation, actor.uuid]);
      if (this.attempted.has(key) || busyHealthActors.has(actor.uuid ?? "")) {
        results.push({ actor, outcome: "duplicate" });
        continue;
      }
      if (actor.isOwner !== true || !actor.update) {
        results.push({ actor, outcome: "denied" });
        continue;
      }
      try {
        const update = survivalUpdate(
          applyHealth(readSurvival(actor), kind, amount, critical, tempChoice),
        );
        // Recheck immediately before a single combined document write.
        if (actor.isOwner !== true || !revalidate()) {
          results.push({ actor, outcome: "denied" });
          continue;
        }
        busyHealthActors.add(actor.uuid ?? "");
        this.attempted.add(key);
        await actor.update(update);
        results.push({ actor, outcome: "updated" });
      } catch {
        results.push({ actor, outcome: "failed" });
      } finally {
        busyHealthActors.delete(actor.uuid ?? "");
      }
    }
    return results;
  }
}
export const healthTransactions = new HealthTransactions();
