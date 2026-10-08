import { describe, it, expect } from "vitest";
import { updateTokenStatusEffects } from "../../src/runtime/status-effects";

describe("updateTokenStatusEffects", () => {
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

    await updateTokenStatusEffects(actor);

    expect(createdEffects).toHaveLength(1);
    expect(createdEffects[0]?.name).toBe("Unconscious");
    expect(createdEffects[0]?.statuses).toEqual(["unconscious"]);
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
      effects: [{ id: "effect1", statuses: new Set(["unconscious"]) }],
      async createEmbeddedDocuments(_type: string, data: Array<Record<string, unknown>>) {
        createdEffects.push(...data);
      },
      async deleteEmbeddedDocuments(_type: string, ids: string[]) {
        deletedIds.push(...ids);
      },
    };

    await updateTokenStatusEffects(actor);

    expect(deletedIds).toEqual(["effect1"]);
    expect(createdEffects).toHaveLength(1);
    expect(createdEffects[0]?.name).toBe("Dead");
    expect(createdEffects[0]?.statuses).toEqual(["dead"]);
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
      effects: [{ id: "effect1", statuses: new Set(["unconscious"]) }],
      async createEmbeddedDocuments(_type: string, data: Array<Record<string, unknown>>) {
        createdEffects.push(...data);
      },
      async deleteEmbeddedDocuments(_type: string, ids: string[]) {
        deletedIds.push(...ids);
      },
    };

    await updateTokenStatusEffects(actor);

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

    await updateTokenStatusEffects(actor);

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
      effects: [{ id: "effect1", statuses: new Set(["unconscious"]) }],
      async createEmbeddedDocuments(_type: string, data: Array<Record<string, unknown>>) {
        createdEffects.push(...data);
      },
      async deleteEmbeddedDocuments(_type: string, ids: string[]) {
        deletedIds.push(...ids);
      },
    };

    await updateTokenStatusEffects(actor);

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

    await updateTokenStatusEffects(actor);

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
    await expect(updateTokenStatusEffects(actor as never)).resolves.toBeUndefined();
  });
});
