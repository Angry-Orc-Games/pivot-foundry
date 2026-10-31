import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { canonicalSkills } from "../../src/config";
import { compareDrift, toActorData, validate } from "../../src/import/pivot-character";
import { prepareCharacterSheetContext, type ActorLike } from "../../src/sheets/character-sheet";

const FILES = [
  "human-veteran.pivot.json",
  "elf-street-mage.pivot.json",
  "dwarf-recluse.pivot.json",
  "custom-humanoid.pivot.json",
] as const;

function load(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
}

function preview(file: Record<string, unknown>) {
  const parsed = validate(file);
  if (!parsed.ok) throw new Error(parsed.error.message);
  const draft = toActorData(parsed.value);
  const actor: ActorLike = {
    name: draft.actor.name,
    type: draft.actor.type,
    system: draft.actor.system as unknown as ActorLike["system"],
    items: draft.items.map((item) => ({
      name: item.name,
      type: item.type,
      system: item.system as unknown as ActorLike["system"],
    })),
  };
  const context = prepareCharacterSheetContext(actor);
  return {
    character: parsed.value,
    draft,
    context,
    computed: file.computed as Record<string, unknown>,
  };
}

const ROAD_WEAPON = {
  "human-veteran.pivot.json": "Medium Melee",
  "dwarf-recluse.pivot.json": "Medium Melee",
  "elf-street-mage.pivot.json": "Light Melee",
  "custom-humanoid.pivot.json": "Light Melee",
} as const;

describe("imported sheet preview", () => {
  it.each(FILES)("%s shows the file armour class, pool, and speed", (name) => {
    const file = load(name);
    const { character, context, computed } = preview(file);
    const skills = computed.skills as Record<
      string,
      { total: number; proficient: boolean; expertise: boolean }
    >;

    expect(context.derived.armourClass.value).toBe(computed.ac);
    expect(context.derived.pool.max).toBe(computed.pool);
    expect(context.derived.speed).toBe(computed.speed);
    const attributes = context.actor.system.attributes as { hp: { value: number; max: number } };
    expect(attributes.hp.value).toBe(computed.hp);
    expect(attributes.hp.max).toBe(computed.hp);

    for (const skill of canonicalSkills) {
      const row = skills[skill.label];
      if (!row) continue;
      expect(context.derived.skills[skill.id]?.total).toBe(row.total);
    }

    const drift = compareDrift(character, {
      ac: context.derived.armourClass.value,
      poolMax: context.derived.pool.max,
      mpMax: context.derived.magic.mp.max,
      speed: context.derived.speed,
    });
    const mp = computed.mp;
    if (typeof mp === "number" && mp !== context.derived.magic.mp.max) {
      expect(drift).toEqual([{ field: "mp", file: mp, sheet: context.derived.magic.mp.max }]);
    } else {
      expect(drift).toEqual([]);
    }
  });

  it.each(FILES)("%s sheet mana and road weapon match the file", (name) => {
    const file = load(name);
    const { context, computed } = preview(file);
    const attacks = computed.attacks as Array<{
      category: string;
      attack: number;
      die: string;
    }>;
    const row = attacks.find((attack) => attack.category === ROAD_WEAPON[name]);
    const weapon = context.items.weapons[0];
    const mp = typeof computed.mp === "number" ? computed.mp : 0;

    expect(row).toBeDefined();
    expect(context.derived.magic.mp.max).toBe(mp);
    expect(weapon?.summary.bth).toBe(row?.attack);
    expect(weapon?.summary.damageFormula).toBe(row?.die);
  });

  it("names Light and Heavy shells from the file", () => {
    const veteran = preview(load("human-veteran.pivot.json"));
    const elf = preview(load("elf-street-mage.pivot.json"));
    const dwarf = preview(load("dwarf-recluse.pivot.json"));
    const names = (items: readonly { type: string; name: string }[]) =>
      items.map((item) => `${item.type}:${item.name}`);

    expect(names(veteran.draft.items)).toContain("equipment:Heavy armour");
    expect(names(elf.draft.items)).toContain("armour:Light armour");
    expect(names(dwarf.draft.items)).toContain("armour:Light armour");
  });

  it("names slings on the dwarf and keeps the custom humanoid ability with traits", () => {
    const dwarf = preview(load("dwarf-recluse.pivot.json"));
    const custom = preview(load("custom-humanoid.pivot.json"));
    expect(dwarf.context.proficiencyText.weapons).toContain("Slings");
    expect(custom.context.items.traits.map((item) => item.name)).toContain("Chitinous Carapace");
    const notes = custom.context.actor.system.notes as { special: string };
    expect(notes.special).toBe("Size: Small");
  });
});
