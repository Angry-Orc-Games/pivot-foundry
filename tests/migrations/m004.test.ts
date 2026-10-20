import { describe, expect, it } from "vitest";

import {
  planSlingsProficiencyMigration,
  planWeaponFieldItemMigration,
} from "../../src/migrations/m004";

const legacyBow = {
  schemaVersion: 2,
  category: "rangedLight",
  attack: { ability: "dex", bonus: 0 },
  damage: { formula: "1d4", type: "piercing", ability: null, bonus: 0 },
};

describe("planWeaponFieldItemMigration", () => {
  it("repairs a ranged light weapon category and a lowercase damage type", () => {
    const plan = planWeaponFieldItemMigration(legacyBow, "weapon");

    expect(plan).toEqual({
      ok: true,
      changed: true,
      update: {
        "system.category": "bows",
        "system.damage.type": "Piercing",
      },
      notices: [
        {
          key: "PIVOT.Migration.FieldRepaired",
          field: "system.category",
          from: "rangedLight",
          to: "bows",
        },
        {
          key: "PIVOT.Migration.FieldRepaired",
          field: "system.damage.type",
          from: "piercing",
          to: "Piercing",
        },
      ],
    });
    if (plan.ok && plan.changed) {
      expect(plan.update).not.toHaveProperty("system.attack.ability");
    }
  });

  it("is a no-op after the repaired values are stored", () => {
    expect(
      planWeaponFieldItemMigration(
        {
          ...legacyBow,
          category: "bows",
          damage: { ...legacyBow.damage, type: "Piercing" },
        },
        "weapon",
      ),
    ).toEqual({ ok: true, changed: false });
  });

  it("leaves an unknown category stored and does not write an update", () => {
    expect(
      planWeaponFieldItemMigration(
        {
          schemaVersion: 2,
          category: "laser",
          attack: { ability: "dex", bonus: 0 },
          damage: { formula: "1d4", type: "Piercing", ability: "dex", bonus: 0 },
        },
        "weapon",
      ),
    ).toEqual({
      ok: true,
      changed: false,
      notices: [
        {
          key: "PIVOT.Migration.FieldInvalid",
          field: "system.category",
          from: "laser",
        },
      ],
    });
  });

  it("keeps a blank damage type without a notice or an update", () => {
    expect(
      planWeaponFieldItemMigration(
        {
          schemaVersion: 2,
          category: "bows",
          attack: { ability: "dex", bonus: 0 },
          damage: { formula: "1d4", type: "", ability: null, bonus: 0 },
        },
        "weapon",
      ),
    ).toEqual({ ok: true, changed: false });
  });

  it("keeps a canonical Piercing damage type", () => {
    expect(
      planWeaponFieldItemMigration(
        {
          schemaVersion: 2,
          category: "bows",
          attack: { ability: "dex", bonus: 0 },
          damage: { formula: "1d8", type: "Piercing", ability: "dex", bonus: 0 },
        },
        "weapon",
      ),
    ).toEqual({ ok: true, changed: false });
  });

  it("does not overwrite a valid bows category", () => {
    const plan = planWeaponFieldItemMigration(
      {
        schemaVersion: 2,
        category: "bows",
        attack: { ability: "dex", bonus: 0 },
        damage: { formula: "1d6", type: "piercing", ability: "dex", bonus: 0 },
      },
      "weapon",
    );

    expect(plan).toEqual({
      ok: true,
      changed: true,
      update: { "system.damage.type": "Piercing" },
      notices: [
        {
          key: "PIVOT.Migration.FieldRepaired",
          field: "system.damage.type",
          from: "piercing",
          to: "Piercing",
        },
      ],
    });
  });

  it("ignores feature and armour items even when they have no attack object", () => {
    expect(planWeaponFieldItemMigration({ schemaVersion: 2, category: "feat" }, "feature")).toEqual(
      { ok: true, changed: false },
    );
    expect(planWeaponFieldItemMigration({ schemaVersion: 2, category: "light" }, "armour")).toEqual(
      { ok: true, changed: false },
    );
  });
});

describe("planSlingsProficiencyMigration", () => {
  it("sets only a missing slings flag to false", () => {
    const plan = planSlingsProficiencyMigration({
      schemaVersion: 2,
      proficiencies: { weapons: { bows: true, thrown: true } },
    });

    expect(plan).toEqual({
      ok: true,
      changed: true,
      update: { "system.proficiencies.weapons.slings": false },
    });
    if (plan.ok && plan.changed) {
      expect(plan.update).not.toHaveProperty("system.proficiencies.weapons.bows");
    }
  });

  it("leaves an existing slings flag untouched", () => {
    expect(
      planSlingsProficiencyMigration({
        schemaVersion: 2,
        proficiencies: { weapons: { bows: true, slings: true } },
      }),
    ).toEqual({ ok: true, changed: false });
    expect(
      planSlingsProficiencyMigration({
        schemaVersion: 2,
        proficiencies: { weapons: { slings: false } },
      }),
    ).toEqual({ ok: true, changed: false });
  });

  it("writes the slings path when the actor has no proficiencies object", () => {
    expect(planSlingsProficiencyMigration({ schemaVersion: 2 })).toEqual({
      ok: true,
      changed: true,
      update: { "system.proficiencies.weapons.slings": false },
    });
  });
});
