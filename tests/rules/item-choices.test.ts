import { describe, expect, it } from "vitest";

import {
  armourCategories,
  attackAbilities,
  damageAbilities,
  damageTypes,
  isAttackAbilityId,
  isDamageAbilityId,
  isDamageTypeId,
  isWeaponCategoryId,
  judgeStoredChoice,
  selectOptionRecord,
  weaponCategories,
} from "../../src/rules/item-choices";

const invalidLabel = "Invalid, pick one";

describe("item choice catalog", () => {
  it("lists weapon categories in book order, including slings", () => {
    expect(weaponCategories.map((entry) => [entry.id, entry.label])).toEqual([
      ["meleeLight", "Light Melee"],
      ["meleeMedium", "Medium Melee"],
      ["meleeHeavy", "Heavy Melee"],
      ["meleeTwoHandedHeavy", "Two-Handed Heavy Melee"],
      ["improvised", "Improvised"],
      ["bows", "Bows"],
      ["crossbows", "Crossbows"],
      ["slings", "Slings"],
      ["thrown", "Thrown Weapons"],
    ]);
    expect(isWeaponCategoryId("slings")).toBe(true);
  });

  it("accepts the five attack abilities and rejects Constitution and none", () => {
    expect(attackAbilities.map((entry) => [entry.id, entry.label])).toEqual([
      ["str", "Str"],
      ["dex", "Dex"],
      ["int", "Int"],
      ["wis", "Wis"],
      ["cha", "Cha"],
    ]);
    expect(isAttackAbilityId("con")).toBe(false);
    expect(isAttackAbilityId("none")).toBe(false);
    expect(judgeStoredChoice("attackAbility", "con")).toEqual({ kind: "invalid", stored: "con" });
    expect(judgeStoredChoice("attackAbility", "none")).toEqual({
      kind: "invalid",
      stored: "none",
    });
  });

  it("accepts strength, dexterity, and none for damage, and rejects Constitution", () => {
    expect(damageAbilities.map((entry) => [entry.id, entry.label])).toEqual([
      ["str", "Str"],
      ["dex", "Dex"],
      ["none", "None"],
    ]);
    expect(isDamageAbilityId("con")).toBe(false);
    expect(isDamageAbilityId("none")).toBe(true);
    expect(judgeStoredChoice("damageAbility", "con")).toEqual({ kind: "invalid", stored: "con" });
  });

  it("keeps the armour category ids", () => {
    expect(armourCategories.map((entry) => entry.id)).toEqual([
      "light",
      "medium",
      "heavy",
      "shield",
      "helmet",
      "other",
    ]);
  });

  it("uses the book label as the damage type id", () => {
    expect(damageTypes).toEqual([
      "Acid",
      "Bludgeoning",
      "Cold",
      "Fire",
      "Force",
      "Lightning",
      "Necrotic",
      "Piercing",
      "Poison",
      "Psychic",
      "Radiant",
      "Slashing",
      "Thunder",
    ]);
    expect(damageTypes).toHaveLength(13);
    expect(isDamageTypeId("piercing")).toBe(false);
    expect(isDamageTypeId("Piercing")).toBe(true);
    expect(judgeStoredChoice("damageType", "piercing")).toEqual({
      kind: "repair",
      to: "Piercing",
    });
    expect(judgeStoredChoice("damageType", "")).toEqual({ kind: "keep" });
    expect(judgeStoredChoice("damageType", "laser")).toEqual({ kind: "invalid", stored: "laser" });
  });

  it("repairs rangedLight to bows and leaves other unknown categories stored", () => {
    expect(judgeStoredChoice("weaponCategory", "rangedLight")).toEqual({
      kind: "repair",
      to: "bows",
    });
    expect(judgeStoredChoice("weaponCategory", "laser")).toEqual({
      kind: "invalid",
      stored: "laser",
    });
    expect(judgeStoredChoice("weaponCategory", "bows")).toEqual({ kind: "keep" });
  });
});

describe("selectOptionRecord", () => {
  it("keeps a legacy weapon category selected and still offers bows", () => {
    const binding = selectOptionRecord("weaponCategory", "rangedLight", invalidLabel);

    expect(binding.selected).toBe("rangedLight");
    expect(binding.options.rangedLight).toBe(invalidLabel);
    expect(binding.options.bows).toBe("Bows");
    expect(Object.hasOwn(binding.options, "rangedLight")).toBe(true);
    expect(binding.selected).not.toBe("bows");
  });

  it("shows a blank damage type as the invalid option", () => {
    const binding = selectOptionRecord("damageType", "", invalidLabel);

    expect(binding.selected).toBe("");
    expect(binding.options[""]).toBe(invalidLabel);
  });

  it("shows a null damage ability as None without an invalid option", () => {
    const binding = selectOptionRecord("damageAbility", null, invalidLabel);

    expect(binding.selected).toBe("none");
    expect(binding.options.none).toBe("None");
    expect(Object.values(binding.options)).not.toContain(invalidLabel);
  });

  it("does not put the invalid label on a legal id", () => {
    const binding = selectOptionRecord("weaponCategory", "bows", invalidLabel);

    expect(binding.selected).toBe("bows");
    expect(binding.options.bows).toBe("Bows");
    expect(Object.values(binding.options)).not.toContain(invalidLabel);
  });
});
