export interface InitiativeCombatant {
  id: string;
  actorId: string | null;
}

export type InitiativeCombatantSelection =
  { kind: "one"; combatantId: string } | { kind: "none" } | { kind: "ambiguous" };

/**
 * Chooses the unique Foundry combatant for an Actor in the active combat.
 * Does not create combatants; multiple matches are left unresolved.
 */
export function selectInitiativeCombatant(
  actorId: string,
  combatants: readonly InitiativeCombatant[],
): InitiativeCombatantSelection {
  if (actorId.length === 0) return { kind: "none" };

  const matches = combatants.filter(
    (combatant) => combatant.actorId === actorId && combatant.id.length > 0,
  );

  if (matches.length === 0) return { kind: "none" };
  if (matches.length > 1) return { kind: "ambiguous" };

  const [match] = matches;
  if (!match) return { kind: "none" };
  return { kind: "one", combatantId: match.id };
}

export interface CombatEncounterLike {
  id?: string;
  active?: boolean;
  isActive?: boolean;
}

export interface CombatGameState {
  combat?: CombatEncounterLike | null;
  combats?: {
    active?: CombatEncounterLike | null;
    viewed?: CombatEncounterLike | null;
    contents?: Iterable<CombatEncounterLike>;
  };
}

/**
 * Prefer the active Combat encounter over the currently viewed tracker tab.
 * Foundry's game.combat follows the viewed encounter, which can be an older inactive one.
 */
export function resolveActiveCombat(
  game: CombatGameState | null | undefined,
): CombatEncounterLike | null {
  if (!game) return null;

  const collection = game.combats;
  if (collection?.active) return collection.active;

  if (collection?.contents) {
    for (const encounter of collection.contents) {
      if (encounter?.active === true || encounter?.isActive === true) return encounter;
    }
  }

  return collection?.viewed ?? game.combat ?? null;
}
