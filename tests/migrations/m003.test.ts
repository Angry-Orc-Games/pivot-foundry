import { describe, expect, it } from "vitest";

import { planSchemaV2ActorMigration, planSchemaV2ItemMigration } from "../../src/migrations/m003";

describe("m003 - Schema V2 Migration", () => {
  describe("planSchemaV2ActorMigration", () => {
    it("adds concept, focus, and backgroundTier to actors at schema version 1", () => {
      const result = planSchemaV2ActorMigration({
        schemaVersion: 1,
        identity: {
          player: "Alice",
          backgroundText: "Noble",
          speciesText: "Human",
        },
      });

      expect(result).toEqual({
        ok: true,
        changed: true,
        update: {
          "system.identity.concept": "",
          "system.identity.focus": "",
          "system.identity.backgroundTier": 0,
        },
      });
    });

    it("adds concept, focus, and backgroundTier to legacy actors at schema version 0", () => {
      const result = planSchemaV2ActorMigration({
        schemaVersion: 0,
        identity: {
          player: "Legacy",
          backgroundText: "Hermit",
        },
      });

      expect(result).toEqual({
        ok: true,
        changed: true,
        update: {
          "system.identity.concept": "",
          "system.identity.focus": "",
          "system.identity.backgroundTier": 0,
        },
      });
    });

    it("only adds missing fields when some are already present", () => {
      const result = planSchemaV2ActorMigration({
        schemaVersion: 1,
        identity: {
          player: "Bob",
          concept: "Wandering Monk",
          backgroundText: "Hermit",
        },
      });

      expect(result).toEqual({
        ok: true,
        changed: true,
        update: {
          "system.identity.focus": "",
          "system.identity.backgroundTier": 0,
        },
      });
    });

    it("does not migrate actors already at schema version 2 or higher", () => {
      const result = planSchemaV2ActorMigration({
        schemaVersion: 2,
        identity: {
          player: "Charlie",
        },
      });

      expect(result).toEqual({ ok: true, changed: false });
    });

    it("does not migrate actors at schema version 0", () => {
      const result = planSchemaV2ActorMigration({
        schemaVersion: 0,
        identity: {},
      });

      // v0 actors should be migrated by m003
      expect(result).toEqual({
        ok: true,
        changed: true,
        update: {
          "system.identity.concept": "",
          "system.identity.focus": "",
          "system.identity.backgroundTier": 0,
        },
      });
    });

    it("does not migrate when all fields are already present", () => {
      const result = planSchemaV2ActorMigration({
        schemaVersion: 1,
        identity: {
          player: "Dave",
          concept: "Battle-Scarred Veteran",
          focus: "Swordplay",
          backgroundTier: 2,
        },
      });

      expect(result).toEqual({ ok: true, changed: false });
    });

    it("handles missing identity gracefully", () => {
      const result = planSchemaV2ActorMigration({
        schemaVersion: 1,
      });

      expect(result).toEqual({ ok: true, changed: false });
    });

    it("handles non-object system data gracefully", () => {
      expect(planSchemaV2ActorMigration(null)).toEqual({ ok: true, changed: false });
      expect(planSchemaV2ActorMigration(undefined)).toEqual({ ok: true, changed: false });
      expect(planSchemaV2ActorMigration("not an object")).toEqual({ ok: true, changed: false });
      expect(planSchemaV2ActorMigration([])).toEqual({ ok: true, changed: false });
    });
  });

  describe("planSchemaV2ItemMigration", () => {
    it("adds cost.bp to feature items at schema version 1", () => {
      const result = planSchemaV2ItemMigration({
        schemaVersion: 1,
        category: "feat",
        cost: {
          pool: 1,
          mp: 0,
        },
      });

      expect(result).toEqual({
        ok: true,
        changed: true,
        update: {
          "system.cost.bp": 0,
        },
      });
    });

    it("does not migrate items already at schema version 2 or higher", () => {
      const result = planSchemaV2ItemMigration({
        schemaVersion: 2,
        cost: {
          pool: 0,
          mp: 0,
        },
      });

      expect(result).toEqual({ ok: true, changed: false });
    });

    it("does not migrate items at schema version 0", () => {
      const result = planSchemaV2ItemMigration({
        schemaVersion: 0,
        cost: {
          pool: 0,
        },
      });

      // v0 items should be migrated by m003
      expect(result).toEqual({
        ok: true,
        changed: true,
        update: {
          "system.cost.bp": 0,
        },
      });
    });

    it("does not migrate when bp is already present", () => {
      const result = planSchemaV2ItemMigration({
        schemaVersion: 1,
        cost: {
          pool: 0,
          mp: 0,
          bp: 2,
        },
      });

      expect(result).toEqual({ ok: true, changed: false });
    });

    it("handles missing cost field gracefully", () => {
      const result = planSchemaV2ItemMigration({
        schemaVersion: 1,
        category: "weapon",
      });

      expect(result).toEqual({ ok: true, changed: false });
    });

    it("handles non-object system data gracefully", () => {
      expect(planSchemaV2ItemMigration(null)).toEqual({ ok: true, changed: false });
      expect(planSchemaV2ItemMigration(undefined)).toEqual({ ok: true, changed: false });
      expect(planSchemaV2ItemMigration("not an object")).toEqual({ ok: true, changed: false });
      expect(planSchemaV2ItemMigration([])).toEqual({ ok: true, changed: false });
    });
  });
});
