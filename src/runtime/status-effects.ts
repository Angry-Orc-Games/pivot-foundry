import { type SurvivalStatus } from "../rules/survival";

/**
 * Foundry VTT core status effect IDs for Unconscious and Dead.
 * Using Foundry's built-in status IDs ensures native token overlay appearance.
 */
export const FOUNDRY_STATUS_UNCONSCIOUS = "unconscious";
export const FOUNDRY_STATUS_DEAD = "dead";

/**
 * Flag key to mark system-managed effects that should not be manually removable by players.
 */
export const SYSTEM_MANAGED_FLAG = "pivot-fantasy.systemManaged";

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
 * Must be called by the active GM client only to avoid multi-client races.
 * Players cannot clear these effects manually; they are re-applied from state.
 *
 * @param actor - The Character Actor to update
 * @param game - Foundry game object for GM check
 * @returns Promise that resolves when the update completes (or immediately if no change needed)
 */
export async function updateTokenStatusEffects(
  actor: {
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
  },
  game?: { users?: { activeGM?: { isSelf?: boolean } } },
): Promise<void> {
  if (actor.type !== "character") return;

  // Only the active GM should sync effects to avoid multi-client races
  if (game?.users?.activeGM?.isSelf !== true) return;

  const hp = actor.system?.attributes?.hp?.value ?? 0;
  const status = (actor.system?.attributes?.deathSaves?.status ?? "unconfirmed") as SurvivalStatus;

  const desiredStatuses = new Set(deriveStatusEffects(hp, status));

  // Find existing system-managed status effects ONLY
  // Never delete GM- or module-created effects that happen to use unconscious/dead status ids
  const existingEffects: Array<{
    id: string;
    statuses: Set<string>;
    isSystemManaged: boolean;
  }> = [];
  if (actor.effects && typeof actor.effects[Symbol.iterator] === "function") {
    for (const effect of actor.effects) {
      const statuses = effect.statuses;
      if (
        statuses &&
        (statuses.has(FOUNDRY_STATUS_UNCONSCIOUS) || statuses.has(FOUNDRY_STATUS_DEAD))
      ) {
        const flags = (effect as { flags?: Record<string, unknown> }).flags;
        const pivotFlags = flags?.["pivot-fantasy"];
        const isSystemManaged =
          pivotFlags && typeof pivotFlags === "object" && "systemManaged" in pivotFlags
            ? pivotFlags.systemManaged === true
            : false;
        existingEffects.push({ id: effect.id ?? "", statuses, isSystemManaged });
      }
    }
  }

  // Track which statuses exist (system-managed or not) to prevent duplicates
  const existingStatusSet = new Set<string>();
  for (const effect of existingEffects) {
    for (const s of effect.statuses) {
      existingStatusSet.add(s);
    }
  }

  // Only remove system-managed effects that no longer match desired state
  const toRemove: string[] = [];
  for (const effect of existingEffects) {
    if (!effect.isSystemManaged) continue; // Never remove non-system-managed effects
    const hasDesiredStatus = Array.from(effect.statuses).some((s) => desiredStatuses.has(s));
    if (!hasDesiredStatus) {
      toRemove.push(effect.id);
    }
  }

  // Only add if status doesn't already exist (even if non-system-managed)
  // This prevents duplicates when GM/module creates the same status
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
    // showIcon: CONST.ACTIVE_EFFECT_SHOW_ICON.ALWAYS ensures permanent effects render on tokens
    // Foundry v14 defaults to CONDITIONAL which only shows temporary effects
    // Safe fallback for tests/v13: use numeric 20 (ALWAYS constant value)
    const globals = globalThis as { CONST?: { ACTIVE_EFFECT_SHOW_ICON?: { ALWAYS?: number } } };
    const showIconAlways = globals.CONST?.ACTIVE_EFFECT_SHOW_ICON?.ALWAYS ?? 20;

    const newEffects = toAdd.map((statusId) => ({
      name: statusId === FOUNDRY_STATUS_DEAD ? "Dead" : "Unconscious",
      statuses: [statusId],
      img: statusId === FOUNDRY_STATUS_DEAD ? "icons/svg/skull.svg" : "icons/svg/unconscious.svg",
      showIcon: showIconAlways,
      flags: {
        "pivot-fantasy": {
          systemManaged: true,
        },
      },
    }));
    await actor.createEmbeddedDocuments("ActiveEffect", newEffects);
  }
}

/**
 * Guard to prevent non-GM players from deleting system-managed status effects.
 * Returns false to block the deletion for system-managed effects when not a GM.
 *
 * @param effect - The ActiveEffect being deleted
 * @param game - Foundry game object for GM check
 * @returns false to block deletion, undefined to allow
 */
export function guardSystemManagedEffectDeletion(
  effect: { flags?: Record<string, unknown> },
  game?: { user?: { isGM?: boolean } },
): false | undefined {
  const pivotFlags = effect.flags?.["pivot-fantasy"];
  const isSystemManaged =
    pivotFlags && typeof pivotFlags === "object" && "systemManaged" in pivotFlags
      ? pivotFlags.systemManaged === true
      : false;
  const isGM = game?.user?.isGM === true;

  if (isSystemManaged && !isGM) {
    return false; // Block deletion
  }

  return undefined; // Allow deletion
}
