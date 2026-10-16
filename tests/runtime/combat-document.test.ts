import { describe, expect, it, vi } from "vitest";
import { createPivotCombatClass } from "../../src/runtime/combat-document";

describe("PivotCombat rollInitiative", () => {
  it("waits for DSN animation when module is active", async () => {
    let waitCalled = false;
    let waitMessageId = "";

    // Mock globalThis with DSN active
    const mockGlobal = globalThis as typeof globalThis & {
      game?: {
        settings?: { get?: (scope: string, key: string) => unknown };
        modules?: { get?: (id: string) => { active?: boolean } | undefined };
        dice3d?: { waitFor3DAnimationByMessageID?: (id: string) => Promise<void> };
      };
      ChatMessage?: {
        implementation?: { createDocuments?: (data: unknown[]) => Promise<unknown> };
        applyRollMode?: (data: Record<string, unknown>, mode: string) => void;
        getSpeaker?: (options: { actor: unknown }) => Record<string, unknown>;
      };
    };

    mockGlobal.game = {
      settings: { get: () => "roll" },
      modules: { get: () => ({ active: true }) },
      dice3d: {
        waitFor3DAnimationByMessageID: vi.fn(async (id: string) => {
          waitCalled = true;
          waitMessageId = id;
        }),
      },
    };

    mockGlobal.ChatMessage = {
      implementation: {
        createDocuments: vi.fn(async () => [{ id: "msg1" }]),
      },
      applyRollMode: vi.fn(),
      getSpeaker: vi.fn(() => ({ alias: "Test" })),
    };

    // Create mock base Combat class
    class BaseCombat {
      combatants = [
        {
          id: "c1",
          _id: "c1",
          actor: {
            id: "a1",
            name: "Hero",
            getInitiativeRoll: vi.fn(async () => ({
              evaluate: vi.fn(async () => ({})),
              total: 15,
            })),
          },
        },
      ];

      updateEmbeddedDocuments = vi.fn(async () => {});
      update = vi.fn(async () => {});

      _getInitiativeFormula() {
        return "1d20";
      }
    }

    const PivotCombat = createPivotCombatClass(BaseCombat as never);
    const combat = new PivotCombat();

    await (
      combat as {
        rollInitiative: (ids: string[], options?: Record<string, unknown>) => Promise<unknown>;
      }
    ).rollInitiative(["c1"]);

    expect(waitCalled).toBe(true);
    expect(waitMessageId).toBe("msg1");
  });

  it("does not wait when DSN is not active", async () => {
    let waitCalled = false;

    // Mock globalThis with DSN inactive
    const mockGlobal = globalThis as typeof globalThis & {
      game?: {
        settings?: { get?: (scope: string, key: string) => unknown };
        modules?: { get?: (id: string) => { active?: boolean } | undefined };
        dice3d?: { waitFor3DAnimationByMessageID?: (id: string) => Promise<void> };
      };
      ChatMessage?: {
        implementation?: { createDocuments?: (data: unknown[]) => Promise<unknown> };
        applyRollMode?: (data: Record<string, unknown>, mode: string) => void;
        getSpeaker?: (options: { actor: unknown }) => Record<string, unknown>;
      };
    };

    mockGlobal.game = {
      settings: { get: () => "roll" },
      modules: { get: () => ({ active: false }) },
      dice3d: {
        waitFor3DAnimationByMessageID: vi.fn(async () => {
          waitCalled = true;
        }),
      },
    };

    mockGlobal.ChatMessage = {
      implementation: {
        createDocuments: vi.fn(async () => [{ id: "msg1" }]),
      },
      applyRollMode: vi.fn(),
      getSpeaker: vi.fn(() => ({ alias: "Test" })),
    };

    class BaseCombat {
      combatants = [
        {
          id: "c1",
          _id: "c1",
          actor: {
            id: "a1",
            name: "Hero",
            getInitiativeRoll: vi.fn(async () => ({
              evaluate: vi.fn(async () => ({})),
              total: 15,
            })),
          },
        },
      ];

      updateEmbeddedDocuments = vi.fn(async () => {});
      update = vi.fn(async () => {});

      _getInitiativeFormula() {
        return "1d20";
      }
    }

    const PivotCombat = createPivotCombatClass(BaseCombat as never);
    const combat = new PivotCombat();

    await (
      combat as {
        rollInitiative: (ids: string[], options?: Record<string, unknown>) => Promise<unknown>;
      }
    ).rollInitiative(["c1"]);

    expect(waitCalled).toBe(false);
  });

  it("continues when DSN wait times out", async () => {
    let updateCalled = false;
    let waitPromiseStarted = false;

    // Mock globalThis with DSN that times out
    const mockGlobal = globalThis as typeof globalThis & {
      game?: {
        settings?: { get?: (scope: string, key: string) => unknown };
        modules?: { get?: (id: string) => { active?: boolean } | undefined };
        dice3d?: { waitFor3DAnimationByMessageID?: (id: string) => Promise<void> };
      };
      ChatMessage?: {
        implementation?: { createDocuments?: (data: unknown[]) => Promise<unknown> };
        applyRollMode?: (data: Record<string, unknown>, mode: string) => void;
        getSpeaker?: (options: { actor: unknown }) => Record<string, unknown>;
      };
    };

    mockGlobal.game = {
      settings: { get: () => "roll" },
      modules: { get: () => ({ active: true }) },
      dice3d: {
        // Create a promise that will never resolve to simulate a stuck animation
        waitFor3DAnimationByMessageID: vi.fn(async () => {
          waitPromiseStarted = true;
          await new Promise<void>(() => {
            // Never resolves
          });
        }),
      },
    };

    mockGlobal.ChatMessage = {
      implementation: {
        createDocuments: vi.fn(async () => [{ id: "msg1" }]),
      },
      applyRollMode: vi.fn(),
      getSpeaker: vi.fn(() => ({ alias: "Test" })),
    };

    class BaseCombat {
      combatants = [
        {
          id: "c1",
          _id: "c1",
          actor: {
            id: "a1",
            name: "Hero",
            getInitiativeRoll: vi.fn(async () => ({
              evaluate: vi.fn(async () => ({})),
              total: 15,
            })),
          },
        },
      ];

      updateEmbeddedDocuments = vi.fn(async () => {
        updateCalled = true;
      });
      update = vi.fn(async () => {});

      _getInitiativeFormula() {
        return "1d20";
      }
    }

    const PivotCombat = createPivotCombatClass(BaseCombat as never);
    const combat = new PivotCombat();

    await (
      combat as {
        rollInitiative: (ids: string[], options?: Record<string, unknown>) => Promise<unknown>;
      }
    ).rollInitiative(["c1"]);

    // Initiative should be updated even though wait timed out (due to 10s timeout in the code)
    expect(waitPromiseStarted).toBe(true);
    expect(updateCalled).toBe(true);
  }, 15000);

  it("continues when DSN wait rejects", async () => {
    let updateCalled = false;

    // Mock globalThis with DSN that rejects
    const mockGlobal = globalThis as typeof globalThis & {
      game?: {
        settings?: { get?: (scope: string, key: string) => unknown };
        modules?: { get?: (id: string) => { active?: boolean } | undefined };
        dice3d?: { waitFor3DAnimationByMessageID?: (id: string) => Promise<void> };
      };
      ChatMessage?: {
        implementation?: { createDocuments?: (data: unknown[]) => Promise<unknown> };
        applyRollMode?: (data: Record<string, unknown>, mode: string) => void;
        getSpeaker?: (options: { actor: unknown }) => Record<string, unknown>;
      };
    };

    mockGlobal.game = {
      settings: { get: () => "roll" },
      modules: { get: () => ({ active: true }) },
      dice3d: {
        waitFor3DAnimationByMessageID: vi.fn(async () => {
          throw new Error("DSN error");
        }),
      },
    };

    mockGlobal.ChatMessage = {
      implementation: {
        createDocuments: vi.fn(async () => [{ id: "msg1" }]),
      },
      applyRollMode: vi.fn(),
      getSpeaker: vi.fn(() => ({ alias: "Test" })),
    };

    class BaseCombat {
      combatants = [
        {
          id: "c1",
          _id: "c1",
          actor: {
            id: "a1",
            name: "Hero",
            getInitiativeRoll: vi.fn(async () => ({
              evaluate: vi.fn(async () => ({})),
              total: 15,
            })),
          },
        },
      ];

      updateEmbeddedDocuments = vi.fn(async () => {
        updateCalled = true;
      });
      update = vi.fn(async () => {});

      _getInitiativeFormula() {
        return "1d20";
      }
    }

    const PivotCombat = createPivotCombatClass(BaseCombat as never);
    const combat = new PivotCombat();

    await (
      combat as {
        rollInitiative: (ids: string[], options?: Record<string, unknown>) => Promise<unknown>;
      }
    ).rollInitiative(["c1"]);

    // Initiative should be updated even though wait rejected
    expect(updateCalled).toBe(true);
  });

  it("updates combatant initiative after animation completes", async () => {
    let updatedInitiative: number | undefined;

    // Mock globalThis with DSN active
    const mockGlobal = globalThis as typeof globalThis & {
      game?: {
        settings?: { get?: (scope: string, key: string) => unknown };
        modules?: { get?: (id: string) => { active?: boolean } | undefined };
        dice3d?: { waitFor3DAnimationByMessageID?: (id: string) => Promise<void> };
      };
      ChatMessage?: {
        implementation?: { createDocuments?: (data: unknown[]) => Promise<unknown> };
        applyRollMode?: (data: Record<string, unknown>, mode: string) => void;
        getSpeaker?: (options: { actor: unknown }) => Record<string, unknown>;
      };
    };

    mockGlobal.game = {
      settings: { get: () => "roll" },
      modules: { get: () => ({ active: true }) },
      dice3d: {
        waitFor3DAnimationByMessageID: vi.fn(async () => {}),
      },
    };

    mockGlobal.ChatMessage = {
      implementation: {
        createDocuments: vi.fn(async () => [{ id: "msg1" }]),
      },
      applyRollMode: vi.fn(),
      getSpeaker: vi.fn(() => ({ alias: "Test" })),
    };

    class BaseCombat {
      combatants = [
        {
          id: "c1",
          _id: "c1",
          actor: {
            id: "a1",
            name: "Hero",
            getInitiativeRoll: vi.fn(async () => ({
              evaluate: vi.fn(async () => ({})),
              total: 18,
            })),
          },
        },
      ];

      updateEmbeddedDocuments = vi.fn(
        async (_type: string, updates: Array<{ _id: string; initiative: number }>) => {
          updatedInitiative = updates[0]?.initiative;
        },
      );
      update = vi.fn(async () => {});

      _getInitiativeFormula() {
        return "1d20";
      }
    }

    const PivotCombat = createPivotCombatClass(BaseCombat as never);
    const combat = new PivotCombat();

    await (
      combat as {
        rollInitiative: (ids: string[], options?: Record<string, unknown>) => Promise<unknown>;
      }
    ).rollInitiative(["c1"]);

    expect(updatedInitiative).toBe(18);
  });
});
