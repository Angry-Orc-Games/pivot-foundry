import { type SurvivalStatus } from "../rules/survival";

/**
 * Foundry VTT core status effect IDs for Unconscious and Dead.
 * Using Foundry's built-in status IDs ensures native token overlay appearance.
 */
export const FOUNDRY_STATUS_UNCONSCIOUS = "unconscious";
export const FOUNDRY_STATUS_DEAD = "dead";

/**
 * Derives which status effects should be active based on Character survival state.
 *
 * - **Unconscious**: Applied when at 0 HP and Dying or Stable
 * - **Dead**: Applied when Dead (replaces Unconscious)
 * - Neither: Applied when Conscious (HP > 0) or Unconfirmed
 *
 * @param hp - Current HP value
 * @param status - Current survival status
 * @returns Array of Foundry status effect IDs that should be active
 */
export function deriveStatusEffects(hp: number, status: SurvivalStatus): string[] {
  if (status === "dead") {
    return [FOUNDRY_STATUS_DEAD];
  }

  if (hp === 0 && (status === "dying" || status === "stable")) {
    return [FOUNDRY_STATUS_UNCONSCIOUS];
  }

  return [];
}

/**
 * Updates the Actor's token status effects to match the current survival state.
 * This is idempotent and system-driven: called whenever HP or death state changes.
 *
 * Only the active GM or the owner client should call this to avoid multi-client races.
 * Players cannot clear these effects manually; they are re-applied from state.
 *
 * @param actor - The Character Actor to update
 * @returns Promise that resolves when the update completes (or immediately if no change needed)
 */
export async function updateTokenStatusEffects(actor: {
  type: string;
  system?: {
    attributes?: {
      hp?: { value?: number };
      deathSaves?: { status?: string };
    };
  };
  effects?: Iterable<{ statuses?: Set<string>; id?: string }>;
  createEmbeddedDocuments?: (
    type: string,
    data: Array<Record<string, unknown>>,
  ) => Promise<unknown>;
  deleteEmbeddedDocuments?: (type: string, ids: string[]) => Promise<unknown>;
}): Promise<void> {
  if (actor.type !== "character") return;

  const hp = actor.system?.attributes?.hp?.value ?? 0;
  const status = (actor.system?.attributes?.deathSaves?.status ?? "unconfirmed") as SurvivalStatus;

  const desiredStatuses = new Set(deriveStatusEffects(hp, status));

  // Find existing system-managed status effects
  const existingEffects: Array<{ id: string; statuses: Set<string> }> = [];
  if (actor.effects && typeof actor.effects[Symbol.iterator] === "function") {
    for (const effect of actor.effects) {
      const statuses = effect.statuses;
      if (
        statuses &&
        (statuses.has(FOUNDRY_STATUS_UNCONSCIOUS) || statuses.has(FOUNDRY_STATUS_DEAD))
      ) {
        existingEffects.push({ id: effect.id ?? "", statuses });
      }
    }
  }

  const existingStatusSet = new Set<string>();
  for (const effect of existingEffects) {
    for (const s of effect.statuses) {
      existingStatusSet.add(s);
    }
  }

  // Determine if we need to make changes
  const toRemove: string[] = [];
  for (const effect of existingEffects) {
    const hasDesiredStatus = Array.from(effect.statuses).some((s) => desiredStatuses.has(s));
    if (!hasDesiredStatus) {
      toRemove.push(effect.id);
    }
  }

  const toAdd: string[] = [];
  for (const desired of desiredStatuses) {
    if (!existingStatusSet.has(desired)) {
      toAdd.push(desired);
    }
  }

  // Apply changes idempotently
  if (toRemove.length > 0 && actor.deleteEmbeddedDocuments) {
    await actor.deleteEmbeddedDocuments("ActiveEffect", toRemove);
  }

  if (toAdd.length > 0 && actor.createEmbeddedDocuments) {
    const newEffects = toAdd.map((statusId) => ({
      name: statusId === FOUNDRY_STATUS_DEAD ? "Dead" : "Unconscious",
      statuses: [statusId],
      icon: statusId === FOUNDRY_STATUS_DEAD ? "icons/svg/skull.svg" : "icons/svg/unconscious.svg",
      flags: {
        "pivot-fantasy": {
          systemManaged: true,
        },
      },
    }));
    await actor.createEmbeddedDocuments("ActiveEffect", newEffects);
  }
}
