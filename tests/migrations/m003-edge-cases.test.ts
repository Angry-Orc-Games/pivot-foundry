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

      // Should not change anything
      expect(result).toEqual({ ok: true, changed: false });
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

  describe("missing fields with schema >= 2 are safe", () => {
    it("an actor at v2 missing new fields does not cause migration", () => {
      // Simulates a document that was created at v2 but doesn't have the fields
      // (shouldn't happen in practice, but we want to be defensive)
      const result = planSchemaV2ActorMigration({
        schemaVersion: 2,
        identity: {
          player: "Test",
          speciesText: "Human",
          backgroundText: "Noble",
          // concept, focus, backgroundTier are missing
        },
      });

      expect(result).toEqual({ ok: true, changed: false });
    });
  });
});
