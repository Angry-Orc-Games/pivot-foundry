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
