import { abilityModifier } from "./modifiers";

const HIT_DIE_FACES = new Set([4, 6, 8, 10, 12]);

export function startingHitPoints(hitDie: string, constitutionScore: number): number {
  const parsed = Number(hitDie.startsWith("d") ? hitDie.slice(1) : "");
  const faces = HIT_DIE_FACES.has(parsed) ? parsed : 8;
  const score =
    Number.isInteger(constitutionScore) && constitutionScore >= 1 && constitutionScore <= 30
      ? constitutionScore
      : 10;
  return Math.max(1, faces + abilityModifier(score));
}
