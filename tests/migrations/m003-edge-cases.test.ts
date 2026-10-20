import { describe, expect, it } from "vitest";

import { planSchemaV2ActorMigration, planSchemaV2ItemMigration } from "../../src/migrations/m003";
import { planAllActorMigrations } from "../../src/migrations/world-migrations";

describe("m003 edge cases", () => {
  describe("schema v2 documents are not re-migrated", () => {
    it("skips actors already at schema version 2", () => {
      const result = planSchemaV2ActorMigration({
        schemaVersion: 2,
        identity: {
          player: "Test",
          // Missing the new fields but at v2
        },
      });

      expect(result).toEqual({ ok: true, changed: false });
    });

    it("skips items already at schema version 2", () => {
      const result = planSchemaV2ItemMigration({
        schemaVersion: 2,
        cost: {
          pool: 1,
          mp: 0,
          // Missing bp but at v2
        },
      });

      expect(result).toEqual({ ok: true, changed: false });
    });

    it("skips actors at schema version 3 or higher", () => {
      expect(
        planSchemaV2ActorMigration({
          schemaVersion: 3,
          identity: {},
        }),
      ).toEqual({ ok: true, changed: false });

      expect(
        planSchemaV2ActorMigration({
          schemaVersion: 99,
          identity: {},
        }),
      ).toEqual({ ok: true, changed: false });
    });
  });

  describe("combined migrations handle schema v2 correctly", () => {
    it("planAllActorMigrations skips v2 actors in m003", () => {
      // An actor at v2 with survival already migrated
      const result = planAllActorMigrations(
        {
          schemaVersion: 2,
          survivalVersion: 1,
          identity: {
            player: "Test",
          },
          attributes: {
            hp: { value: 10, temp: 0 },
            deathSaves: { status: "alive" },
          },
        },
        "character",
      );

      expect(result).toEqual({
        ok: true,
        changed: true,
        update: { "system.proficiencies.weapons.slings": false },
      });
    });

    it("m001 upgrades v0 to v2 when m003 adds fields", () => {
      // A legacy v0 actor should get both m001 and m003 migrations
      const result = planAllActorMigrations(
        {
          schemaVersion: 0,
          identity: {
            player: "Legacy",
          },
        },
        "character",
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.changed).toBe(true);
      if (!result.changed) return;

      // Should have schema version update from m001
      expect(result.update["system.schemaVersion"]).toBe(2);
      // Should have new fields from m003
      expect(result.update["system.identity.concept"]).toBe("");
      expect(result.update["system.identity.focus"]).toBe("");
      expect(result.update["system.identity.backgroundTier"]).toBe(0);
    });
  });

  describe("migration preserves existing data", () => {
    it("preserves HP, pool, and other existing values when migrating actors", () => {
      const result = planSchemaV2ActorMigration({
        schemaVersion: 1,
        identity: {
          player: "Test",
          speciesText: "Dwarf",
          backgroundText: "Soldier",
        },
        attributes: {
          hp: { value: 42, max: 50, temp: 5 },
          hitDie: "d10",
        },
        resources: {
          pool: { value: 8 },
        },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.changed).toBe(true);
      if (!result.changed) return;

      // Should only add the missing identity fields
      expect(result.update).toEqual({
        "system.identity.concept": "",
        "system.identity.focus": "",
        "system.identity.backgroundTier": 0,
      });

      // Should NOT touch hp, hitDie, pool, or any other fields
      expect(result.update).not.toHaveProperty("system.attributes.hp");
      expect(result.update).not.toHaveProperty("system.attributes.hitDie");
      expect(result.update).not.toHaveProperty("system.resources.pool");
    });

    it("preserves cost.pool and cost.mp when migrating items", () => {
      const result = planSchemaV2ItemMigration({
        schemaVersion: 1,
        category: "feat",
        cost: {
          pool: 2,
          mp: 1,
        },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.changed).toBe(true);
      if (!result.changed) return;

      // Should only add bp
      expect(result.update).toEqual({
        "system.cost.bp": 0,
      });

      // Should NOT touch other cost fields
      expect(result.update).not.toHaveProperty("system.cost.pool");
      expect(result.update).not.toHaveProperty("system.cost.mp");
    });
  });
});
