export type CreatureSize = "small" | "medium" | "large";

const SIZE_SPEED: Record<CreatureSize, number> = {
  small: 7,
  medium: 10,
  large: 12,
};

const SPECIES_SIZE: Record<string, CreatureSize> = {
  human: "medium",
  elf: "medium",
  humanoid: "medium",
  dwarf: "medium",
  halfling: "small",
  gnome: "small",
};

const SPECIES_SPEED: Record<string, number> = {
  human: 10,
  elf: 10,
  humanoid: 10,
  dwarf: 8,
  halfling: 7,
  gnome: 7,
};

function words(species: string): string[] {
  return species
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
}

export function sizeFromSpeciesText(species: string): CreatureSize | null {
  const tokens = words(species);
  for (const token of tokens) {
    const listed = SPECIES_SIZE[token];
    if (listed) return listed;
  }
  if (tokens.includes("small")) return "small";
  if (tokens.includes("large")) return "large";
  if (tokens.includes("medium")) return "medium";
  return null;
}

export function baseSpeedForSpecies(species: string): number | null {
  const tokens = words(species);
  if (tokens.includes("dwarf")) return SPECIES_SPEED.dwarf ?? null;
  if (tokens.includes("halfling")) return SPECIES_SPEED.halfling ?? null;
  if (tokens.includes("gnome")) return SPECIES_SPEED.gnome ?? null;
  if (tokens.includes("human")) return SPECIES_SPEED.human ?? null;
  if (tokens.includes("elf")) return SPECIES_SPEED.elf ?? null;
  if (tokens.includes("humanoid")) {
    if (tokens.includes("small")) return SIZE_SPEED.small;
    if (tokens.includes("large")) return SIZE_SPEED.large;
    return SPECIES_SPEED.humanoid ?? null;
  }
  const size = sizeFromSpeciesText(species);
  return size === null ? null : SIZE_SPEED[size];
}

export function unknownSpeciesSpeedMessage(species: string): string {
  return `Unknown species "${species}"; base speed left at the stored value.`;
}
