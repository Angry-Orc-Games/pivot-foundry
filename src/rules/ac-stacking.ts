export const bonusStackMode = {
  ac: "highest",
  dr: "sum",
  dieStep: "sum",
} as const;

export type BonusStackMode = (typeof bonusStackMode)[keyof typeof bonusStackMode];

export const acExclusionGroups = [
  {
    id: "magicProtection",
    keys: [
      "vambracesOfArmour",
      "pendantOfProtection",
      "cloakOfProtection",
      "ringOfProtection",
      "magicArmour",
      "magicShield",
    ],
  },
] as const;

export function stackIdenticalBonuses(mode: BonusStackMode, values: number[]): number {
  if (values.length === 0) return 0;
  if (mode === "sum") return values.reduce((total, value) => total + value, 0);
  return Math.max(...values);
}

export function exclusionGroupId(stackKey: string): string {
  const group = acExclusionGroups.find((entry) =>
    (entry.keys as readonly string[]).includes(stackKey),
  );
  return group?.id ?? stackKey;
}
