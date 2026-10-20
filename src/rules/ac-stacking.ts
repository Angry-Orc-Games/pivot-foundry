export const bonusStackMode = {
  ac: "highest",
  dr: "sum",
  dieStep: "sum",
} as const;

export type BonusStackMode = (typeof bonusStackMode)[keyof typeof bonusStackMode];

export const gradeProtectionKeys = [
  "vambracesOfArmour",
  "pendantOfProtection",
  "cloakOfProtection",
  "ringOfProtection",
] as const;

export const magicAcKeys = ["magicArmour", "magicShield"] as const;

export function stackIdenticalBonuses(mode: BonusStackMode, values: number[]): number {
  if (values.length === 0) return 0;
  if (mode === "sum") return values.reduce((total, value) => total + value, 0);
  return Math.max(...values);
}

export function selectKeyedAcBonuses<T extends { stackKey?: string; acBonus: number }>(
  items: T[],
): T[] {
  const grades: T[] = [];
  const magicArmour: T[] = [];
  const magicShield: T[] = [];
  const rest = new Map<string, T[]>();
  for (const item of items) {
    const key = item.stackKey ?? "";
    if ((gradeProtectionKeys as readonly string[]).includes(key)) grades.push(item);
    else if (key === "magicArmour") magicArmour.push(item);
    else if (key === "magicShield") magicShield.push(item);
    else {
      const group = rest.get(key) ?? [];
      group.push(item);
      rest.set(key, group);
    }
  }

  const bestGrade = highestAc(grades);
  const bestArmour = highestAc(magicArmour);
  const bestShield = highestAc(magicShield);
  const magicTotal = (bestArmour?.acBonus ?? 0) + (bestShield?.acBonus ?? 0);
  const chosen: T[] = [];
  if (bestGrade && bestGrade.acBonus > magicTotal) chosen.push(bestGrade);
  else {
    if (bestArmour) chosen.push(bestArmour);
    if (bestShield) chosen.push(bestShield);
    if (chosen.length === 0 && bestGrade) chosen.push(bestGrade);
  }
  for (const group of rest.values()) {
    const best = highestAc(group);
    if (best) chosen.push(best);
  }
  return chosen;
}

function highestAc<T extends { acBonus: number }>(items: T[]): T | undefined {
  if (items.length === 0) return undefined;
  const best = stackIdenticalBonuses(
    bonusStackMode.ac,
    items.map((item) => item.acBonus),
  );
  return items.find((item) => item.acBonus === best);
}
