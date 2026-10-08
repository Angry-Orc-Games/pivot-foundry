import { describe, it, expect } from "vitest";
import {
  updateTokenStatusEffects,
  guardSystemManagedEffectDeletion,
} from "../../src/runtime/status-effects";

describe("updateTokenStatusEffects", () => {
  const mockGameAsActiveGM = { users: { activeGM: { isSelf: true } } };
  const mockGameNotActiveGM = { users: { activeGM: { isSelf: false } } };

  it("applies unconscious effect when at 0 HP and dying", async () => {
    const createdEffects: Array<Record<string, unknown>> = [];
    const deletedIds: string[] = [];

    const actor = {
      type: "character",
      system: {
        attributes: {
          hp: { value: 0 },
          deathSaves: { status: "dying" },
        },
      },
      effects: [],
      async createEmbeddedDocuments(_type: string, data: Array<Record<string, unknown>>) {
        createdEffects.push(...data);
      },
      async deleteEmbeddedDocuments(_type: string, ids: string[]) {
        deletedIds.push(...ids);
      },
    };

    await updateTokenStatusEffects(actor, mockGameAsActiveGM);

    expect(createdEffects).toHaveLength(1);
    expect(createdEffects[0]?.name).toBe("Unconscious");
    expect(createdEffects[0]?.statuses).toEqual(["unconscious"]);
    expect(createdEffects[0]?.img).toBe("icons/svg/unconscious.svg");
    expect(createdEffects[0]?.showIcon).toBe(20); // CONST.ACTIVE_EFFECT_SHOW_ICON.ALWAYS fallback
    expect(createdEffects[0]?.flags).toEqual({
      "pivot-fantasy": { systemManaged: true },
    });
    expect(deletedIds).toHaveLength(0);
  });

  it("applies dead effect when dead (replaces unconscious)", async () => {
    const createdEffects: Array<Record<string, unknown>> = [];
    const deletedIds: string[] = [];

    const actor = {
      type: "character",
      system: {
        attributes: {
          hp: { value: 0 },
          deathSaves: { status: "dead" },
        },
      },
      effects: [
        {
          id: "effect1",
          statuses: new Set(["unconscious"]),
          flags: { "pivot-fantasy": { systemManaged: true } },
        },
      ],
      async createEmbeddedDocuments(_type: string, data: Array<Record<string, unknown>>) {
        createdEffects.push(...data);
      },
      async deleteEmbeddedDocuments(_type: string, ids: string[]) {
        deletedIds.push(...ids);
      },
    };

    await updateTokenStatusEffects(actor, mockGameAsActiveGM);

    expect(deletedIds).toEqual(["effect1"]);
    expect(createdEffects).toHaveLength(1);
    expect(createdEffects[0]?.name).toBe("Dead");
    expect(createdEffects[0]?.statuses).toEqual(["dead"]);
    expect(createdEffects[0]?.img).toBe("icons/svg/skull.svg");
    expect(createdEffects[0]?.showIcon).toBe(20);
  });

  it("removes unconscious effect when recovering to conscious", async () => {
    const createdEffects: Array<Record<string, unknown>> = [];
    const deletedIds: string[] = [];

    const actor = {
      type: "character",
      system: {
        attributes: {
          hp: { value: 5 },
          deathSaves: { status: "alive" },
        },
      },
      effects: [
        {
          id: "effect1",
          statuses: new Set(["unconscious"]),
          flags: { "pivot-fantasy": { systemManaged: true } },
        },
      ],
      async createEmbeddedDocuments(_type: string, data: Array<Record<string, unknown>>) {
        createdEffects.push(...data);
      },
      async deleteEmbeddedDocuments(_type: string, ids: string[]) {
        deletedIds.push(...ids);
      },
    };

    await updateTokenStatusEffects(actor, mockGameAsActiveGM);

    expect(deletedIds).toEqual(["effect1"]);
    expect(createdEffects).toHaveLength(0);
  });

  it("applies unconscious effect when at 0 HP and stable", async () => {
    const createdEffects: Array<Record<string, unknown>> = [];
    const deletedIds: string[] = [];

    const actor = {
      type: "character",
      system: {
        attributes: {
          hp: { value: 0 },
          deathSaves: { status: "stable" },
        },
      },
      effects: [],
      async createEmbeddedDocuments(_type: string, data: Array<Record<string, unknown>>) {
        createdEffects.push(...data);
      },
      async deleteEmbeddedDocuments(_type: string, ids: string[]) {
        deletedIds.push(...ids);
      },
    };

    await updateTokenStatusEffects(actor, mockGameAsActiveGM);

    expect(createdEffects).toHaveLength(1);
    expect(createdEffects[0]?.name).toBe("Unconscious");
    expect(createdEffects[0]?.statuses).toEqual(["unconscious"]);
    expect(deletedIds).toHaveLength(0);
  });

  it("does nothing when effects already match state", async () => {
    const createdEffects: Array<Record<string, unknown>> = [];
    const deletedIds: string[] = [];

    const actor = {
      type: "character",
      system: {
        attributes: {
          hp: { value: 0 },
          deathSaves: { status: "dying" },
        },
      },
      effects: [
        {
          id: "effect1",
          statuses: new Set(["unconscious"]),
          flags: { "pivot-fantasy": { systemManaged: true } },
        },
      ],
      async createEmbeddedDocuments(_type: string, data: Array<Record<string, unknown>>) {
        createdEffects.push(...data);
      },
      async deleteEmbeddedDocuments(_type: string, ids: string[]) {
        deletedIds.push(...ids);
      },
    };

    await updateTokenStatusEffects(actor, mockGameAsActiveGM);

    expect(createdEffects).toHaveLength(0);
    expect(deletedIds).toHaveLength(0);
  });

  it("skips non-character actors", async () => {
    const createdEffects: Array<Record<string, unknown>> = [];
    const deletedIds: string[] = [];

    const actor = {
      type: "npc",
      system: {
        attributes: {
          hp: { value: 0 },
          deathSaves: { status: "dying" },
        },
      },
      effects: [],
      async createEmbeddedDocuments(_type: string, data: Array<Record<string, unknown>>) {
        createdEffects.push(...data);
      },
      async deleteEmbeddedDocuments(_type: string, ids: string[]) {
        deletedIds.push(...ids);
      },
    };

    await updateTokenStatusEffects(actor, mockGameAsActiveGM);

    expect(createdEffects).toHaveLength(0);
    expect(deletedIds).toHaveLength(0);
  });

  it("handles actors with no effects collection", async () => {
    const actor = {
      type: "character",
      system: {
        attributes: {
          hp: { value: 5 },
          deathSaves: { status: "alive" },
        },
      },
      effects: undefined,
    };

    // Should not throw
    await expect(
      updateTokenStatusEffects(actor as never, mockGameAsActiveGM),
    ).resolves.toBeUndefined();
  });

  it("skips updates when not active GM (multi-client race guard)", async () => {
    const createdEffects: Array<Record<string, unknown>> = [];
    const deletedIds: string[] = [];

    const actor = {
      type: "character",
      system: {
        attributes: {
          hp: { value: 0 },
          deathSaves: { status: "dying" },
        },
      },
      effects: [],
      async createEmbeddedDocuments(_type: string, data: Array<Record<string, unknown>>) {
        createdEffects.push(...data);
      },
      async deleteEmbeddedDocuments(_type: string, ids: string[]) {
        deletedIds.push(...ids);
      },
    };

    await updateTokenStatusEffects(actor, mockGameNotActiveGM);

    // Should not apply effects when not active GM
    expect(createdEffects).toHaveLength(0);
    expect(deletedIds).toHaveLength(0);
  });

  it("only removes system-managed effects, preserves GM/module effects", async () => {
    const createdEffects: Array<Record<string, unknown>> = [];
    const deletedIds: string[] = [];

    const actor = {
      type: "character",
      system: {
        attributes: {
          hp: { value: 5 }, // Conscious, no effects needed
          deathSaves: { status: "alive" },
        },
      },
      effects: [
        // System-managed effect - should be removed
        {
          id: "system1",
          statuses: new Set(["unconscious"]),
          flags: { "pivot-fantasy": { systemManaged: true } },
        },
        // GM-created effect - should be preserved
        {
          id: "gm1",
          statuses: new Set(["unconscious"]),
          flags: {},
        },
      ],
      async createEmbeddedDocuments(_type: string, data: Array<Record<string, unknown>>) {
        createdEffects.push(...data);
      },
      async deleteEmbeddedDocuments(_type: string, ids: string[]) {
        deletedIds.push(...ids);
      },
    };

    await updateTokenStatusEffects(actor, mockGameAsActiveGM);

    // Should only remove system-managed effect, not GM effect
    expect(deletedIds).toEqual(["system1"]);
    expect(createdEffects).toHaveLength(0);
  });

  it("does not create duplicate when non-system-managed effect exists", async () => {
    const createdEffects: Array<Record<string, unknown>> = [];
    const deletedIds: string[] = [];

    const actor = {
      type: "character",
      system: {
        attributes: {
          hp: { value: 0 },
          deathSaves: { status: "dying" }, // Needs unconscious
        },
      },
      effects: [
        // GM already created unconscious effect
        {
          id: "gm1",
          statuses: new Set(["unconscious"]),
          flags: {},
        },
      ],
      async createEmbeddedDocuments(_type: string, data: Array<Record<string, unknown>>) {
        createdEffects.push(...data);
      },
      async deleteEmbeddedDocuments(_type: string, ids: string[]) {
        deletedIds.push(...ids);
      },
    };

    await updateTokenStatusEffects(actor, mockGameAsActiveGM);

    // Should not create duplicate since unconscious already exists (even if not system-managed)
    expect(createdEffects).toHaveLength(0);
    expect(deletedIds).toHaveLength(0);
  });

  it("creates system-managed effect when only needed", async () => {
    const createdEffects: Array<Record<string, unknown>> = [];
    const deletedIds: string[] = [];

    const actor = {
      type: "character",
      system: {
        attributes: {
          hp: { value: 0 },
          deathSaves: { status: "dying" },
        },
      },
      effects: [
        // GM created a dead effect (wrong status)
        {
          id: "gm1",
          statuses: new Set(["dead"]),
          flags: {},
        },
      ],
      async createEmbeddedDocuments(_type: string, data: Array<Record<string, unknown>>) {
        createdEffects.push(...data);
      },
      async deleteEmbeddedDocuments(_type: string, ids: string[]) {
        deletedIds.push(...ids);
      },
    };

    await updateTokenStatusEffects(actor, mockGameAsActiveGM);

    // Should create unconscious (desired) but not remove dead (non-system-managed)
    expect(createdEffects).toHaveLength(1);
    expect(createdEffects[0]?.statuses).toEqual(["unconscious"]);
    expect(deletedIds).toHaveLength(0);
  });

  it("uses CONST.ACTIVE_EFFECT_SHOW_ICON.ALWAYS when available", async () => {
    const createdEffects: Array<Record<string, unknown>> = [];
    const originalCONST = (globalThis as { CONST?: unknown }).CONST;

    // Mock CONST for this test
    (globalThis as { CONST?: unknown }).CONST = {
      ACTIVE_EFFECT_SHOW_ICON: { ALWAYS: 42 },
    };

    const actor = {
      type: "character",
      system: {
        attributes: {
          hp: { value: 0 },
          deathSaves: { status: "dying" },
        },
      },
      effects: [],
      async createEmbeddedDocuments(_type: string, data: Array<Record<string, unknown>>) {
        createdEffects.push(...data);
      },
      async deleteEmbeddedDocuments() {
        // Not used in this test
      },
    };

    await updateTokenStatusEffects(actor, mockGameAsActiveGM);

    expect(createdEffects).toHaveLength(1);
    expect(createdEffects[0]?.showIcon).toBe(42); // Uses CONST value when available

    // Restore original CONST
    (globalThis as { CONST?: unknown }).CONST = originalCONST;
  });
});

describe("guardSystemManagedEffectDeletion", () => {
  const mockGameAsGM = { user: { isGM: true } };
  const mockGameAsPlayer = { user: { isGM: false } };

  it("blocks non-GM deletion of system-managed effects", () => {
    const effect = {
      flags: {
        "pivot-fantasy": {
          systemManaged: true,
        },
      },
    };

    const result = guardSystemManagedEffectDeletion(effect, mockGameAsPlayer);
    expect(result).toBe(false);
  });

  it("allows GM deletion of system-managed effects", () => {
    const effect = {
      flags: {
        "pivot-fantasy": {
          systemManaged: true,
        },
      },
    };

    const result = guardSystemManagedEffectDeletion(effect, mockGameAsGM);
    expect(result).toBeUndefined();
  });

  it("allows deletion of non-system-managed effects by anyone", () => {
    const effect = {
      flags: {},
    };

    const resultPlayer = guardSystemManagedEffectDeletion(effect, mockGameAsPlayer);
    const resultGM = guardSystemManagedEffectDeletion(effect, mockGameAsGM);

    expect(resultPlayer).toBeUndefined();
    expect(resultGM).toBeUndefined();
  });

  it("allows deletion when effect has no flags", () => {
    const effect = {};

    const result = guardSystemManagedEffectDeletion(effect, mockGameAsPlayer);
    expect(result).toBeUndefined();
  });
});
