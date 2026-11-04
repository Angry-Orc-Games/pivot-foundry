import type { AbilityKey } from "./character-derived";

const magicAbilities = new Set<AbilityKey>(["int", "wis", "cha"]);

export function primaryAbilityWarnings(input: {
  primaries: readonly AbilityKey[];
  magicAbility: AbilityKey | null;
  level: number;
  hasAdaptOrDie: boolean;
}): string[] {
  const warnings: string[] = [];
  const cap = input.hasAdaptOrDie && input.level >= 3 ? 3 : 2;
  if (input.primaries.length > cap) {
    warnings.push(
      cap === 2
        ? "More than 2 Primary abilities. The cap is 2, or 3 with Adapt or Die at level 3 or higher."
        : "More than 3 Primary abilities. Adapt or Die allows only one extra Primary.",
    );
  }
  if (input.magicAbility && !magicAbilities.has(input.magicAbility)) {
    warnings.push("Magic ability must be Intelligence, Wisdom, or Charisma.");
  }
  if (input.magicAbility && !input.primaries.includes(input.magicAbility)) {
    warnings.push("Magic ability must be a Primary ability.");
  }
  return warnings;
}
