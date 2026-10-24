const coreLabelKey = "PIVOT.Tabs.Core";
const numberedEchelonLabelKey = "PIVOT.Fields.Echelon";
const numberedEchelonUnlockLevel = 3;

export const magicEchelonTiers = [
  { value: 0, labelKey: coreLabelKey, unlockLevel: 1 },
  { value: 1, labelKey: numberedEchelonLabelKey, unlockLevel: numberedEchelonUnlockLevel },
  { value: 2, labelKey: numberedEchelonLabelKey, unlockLevel: numberedEchelonUnlockLevel },
  { value: 3, labelKey: numberedEchelonLabelKey, unlockLevel: numberedEchelonUnlockLevel },
  { value: 4, labelKey: numberedEchelonLabelKey, unlockLevel: numberedEchelonUnlockLevel },
  { value: 5, labelKey: numberedEchelonLabelKey, unlockLevel: numberedEchelonUnlockLevel },
] as const;

export function visibleMagicEchelon(
  stored: unknown,
  level: number,
): { labelKey: string; value?: number } {
  const numeric = typeof stored === "number" && Number.isInteger(stored) ? stored : 0;
  const available = magicEchelonTiers.filter(
    (tier) => level >= tier.unlockLevel && tier.value <= numeric,
  );
  const tier = available.at(-1) ?? magicEchelonTiers[0];
  if (tier.value === 0) return { labelKey: tier.labelKey };
  return { labelKey: tier.labelKey, value: tier.value };
}
