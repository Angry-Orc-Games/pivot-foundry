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
        i18n?: { format?: (key: string, data: Record<string, unknown>) => string };
      };
      ChatMessage?: {
        implementation?: {
          create?: (data: Record<string, unknown>) => Promise<unknown>;
        };
        getSpeaker?: (options: {
          actor?: unknown;
          token?: unknown;
          alias?: string;
        }) => Record<string, unknown>;
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
      i18n: {
        format: vi.fn((key: string, data: Record<string, unknown>) => {
          return `${data.name} rolls for Initiative!`;
        }),
      },
    };

    mockGlobal.ChatMessage = {
      implementation: {
        create: vi.fn(async () => ({ id: "msg1" })),
      },
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
          },
          token: { name: "Hero Token" },
          hidden: false,
          getInitiativeRoll: vi.fn(async () => ({
            total: 15,
            toMessage: vi.fn(async () => ({
              speaker: { alias: "Hero" },
              flavor: "Hero rolls for Initiative!",
            })),
          })),
          _getInitiativeFormula: vi.fn(() => "1d20"),
        },
      ];

      updateEmbeddedDocuments = vi.fn(async () => {});
      update = vi.fn(async () => {});
      combatant = undefined;
      turns = [];
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
        i18n?: { format?: (key: string, data: Record<string, unknown>) => string };
      };
      ChatMessage?: {
        implementation?: {
          create?: (data: Record<string, unknown>) => Promise<unknown>;
        };
        getSpeaker?: (options: {
          actor?: unknown;
          token?: unknown;
          alias?: string;
        }) => Record<string, unknown>;
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
      i18n: {
        format: vi.fn((key: string, data: Record<string, unknown>) => {
          return `${data.name} rolls for Initiative!`;
        }),
      },
    };

    mockGlobal.ChatMessage = {
      implementation: {
        create: vi.fn(async () => ({ id: "msg1" })),
      },
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
          },
          token: { name: "Hero Token" },
          hidden: false,
          getInitiativeRoll: vi.fn(async () => ({
            total: 15,
            toMessage: vi.fn(async () => ({
              speaker: { alias: "Hero" },
              flavor: "Hero rolls for Initiative!",
            })),
          })),
          _getInitiativeFormula: vi.fn(() => "1d20"),
        },
      ];

      updateEmbeddedDocuments = vi.fn(async () => {});
      update = vi.fn(async () => {});
      combatant = undefined;
      turns = [];
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

  it("updates initiative only after DSN wait resolves", async () => {
    const events: string[] = [];

    // Mock globalThis with DSN active
    const mockGlobal = globalThis as typeof globalThis & {
      game?: {
        settings?: { get?: (scope: string, key: string) => unknown };
        modules?: { get?: (id: string) => { active?: boolean } | undefined };
        dice3d?: { waitFor3DAnimationByMessageID?: (id: string) => Promise<void> };
        i18n?: { format?: (key: string, data: Record<string, unknown>) => string };
      };
      ChatMessage?: {
        implementation?: {
          create?: (data: Record<string, unknown>) => Promise<unknown>;
        };
        getSpeaker?: (options: {
          actor?: unknown;
          token?: unknown;
          alias?: string;
        }) => Record<string, unknown>;
      };
    };

    mockGlobal.game = {
      settings: { get: () => "roll" },
      modules: { get: () => ({ active: true }) },
      dice3d: {
        waitFor3DAnimationByMessageID: vi.fn(async () => {
          events.push("dsn-wait-resolved");
          await new Promise((resolve) => setTimeout(resolve, 100));
        }),
      },
      i18n: {
        format: vi.fn((key: string, data: Record<string, unknown>) => {
          return `${data.name} rolls for Initiative!`;
        }),
      },
    };

    mockGlobal.ChatMessage = {
      implementation: {
        create: vi.fn(async () => {
          events.push("message-created");
          return { id: "msg1" };
        }),
      },
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
          },
          token: { name: "Hero Token" },
          hidden: false,
          getInitiativeRoll: vi.fn(async () => ({
            total: 15,
            toMessage: vi.fn(async () => ({
              speaker: { alias: "Hero" },
              flavor: "Hero rolls for Initiative!",
            })),
          })),
          _getInitiativeFormula: vi.fn(() => "1d20"),
        },
      ];

      updateEmbeddedDocuments = vi.fn(async () => {
        events.push("initiative-updated");
      });
      update = vi.fn(async () => {});
      combatant = undefined;
      turns = [];
    }

    const PivotCombat = createPivotCombatClass(BaseCombat as never);
    const combat = new PivotCombat();

    await (
      combat as {
        rollInitiative: (ids: string[], options?: Record<string, unknown>) => Promise<unknown>;
      }
    ).rollInitiative(["c1"]);

    // Verify order: message created, DSN wait resolved, then initiative updated
    expect(events).toEqual(["message-created", "dsn-wait-resolved", "initiative-updated"]);
  });

  it("preserves current turn when updateTurn is true", async () => {
    let updatedTurn: number | undefined;

    // Mock globalThis
    const mockGlobal = globalThis as typeof globalThis & {
      game?: {
        settings?: { get?: (scope: string, key: string) => unknown };
        modules?: { get?: (id: string) => { active?: boolean } | undefined };
        i18n?: { format?: (key: string, data: Record<string, unknown>) => string };
      };
      ChatMessage?: {
        implementation?: {
          create?: (data: Record<string, unknown>) => Promise<unknown>;
        };
        getSpeaker?: (options: {
          actor?: unknown;
          token?: unknown;
          alias?: string;
        }) => Record<string, unknown>;
      };
    };

    mockGlobal.game = {
      settings: { get: () => "roll" },
      modules: { get: () => ({ active: false }) },
      i18n: {
        format: vi.fn((key: string, data: Record<string, unknown>) => {
          return `${data.name} rolls for Initiative!`;
        }),
      },
    };

    mockGlobal.ChatMessage = {
      implementation: {
        create: vi.fn(async () => ({ id: "msg1" })),
      },
      getSpeaker: vi.fn(() => ({ alias: "Test" })),
    };

    class BaseCombat {
      combatants = [
        {
          id: "c1",
          _id: "c1",
          actor: {
            id: "a1",
            name: "Hero1",
          },
          token: { name: "Hero1 Token" },
          hidden: false,
          getInitiativeRoll: vi.fn(async () => ({
            total: 15,
            toMessage: vi.fn(async () => ({
              speaker: { alias: "Hero1" },
              flavor: "Hero1 rolls for Initiative!",
            })),
          })),
          _getInitiativeFormula: vi.fn(() => "1d20"),
        },
        {
          id: "c2",
          _id: "c2",
          actor: {
            id: "a2",
            name: "Hero2",
          },
          token: { name: "Hero2 Token" },
          hidden: false,
          getInitiativeRoll: vi.fn(async () => ({
            total: 10,
            toMessage: vi.fn(async () => ({
              speaker: { alias: "Hero2" },
              flavor: "Hero2 rolls for Initiative!",
            })),
          })),
          _getInitiativeFormula: vi.fn(() => "1d20"),
        },
      ];

      updateEmbeddedDocuments = vi.fn(async () => {});
      update = vi.fn(async (data: { turn?: number }) => {
        updatedTurn = data.turn;
      });
      combatant = { id: "c2" }; // Current combatant is c2
      turns = [{ id: "c1" }, { id: "c2" }, { id: "c3" }];
    }

    const PivotCombat = createPivotCombatClass(BaseCombat as never);
    const combat = new PivotCombat();

    await (
      combat as {
        rollInitiative: (ids: string[], options?: Record<string, unknown>) => Promise<unknown>;
      }
    ).rollInitiative(["c1"], { updateTurn: true });

    // Turn should be updated to index of c2 (which is 1)
    expect(updatedTurn).toBe(1);
  });

  it("handles multiple combatants with different formulas", async () => {
    const rolledFormulas: string[] = [];
    const updatedInitiatives: Array<{ _id: string; initiative: number }> = [];

    // Mock globalThis
    const mockGlobal = globalThis as typeof globalThis & {
      game?: {
        settings?: { get?: (scope: string, key: string) => unknown };
        modules?: { get?: (id: string) => { active?: boolean } | undefined };
        i18n?: { format?: (key: string, data: Record<string, unknown>) => string };
      };
      ChatMessage?: {
        implementation?: {
          create?: (data: Record<string, unknown>) => Promise<unknown>;
        };
        getSpeaker?: (options: {
          actor?: unknown;
          token?: unknown;
          alias?: string;
        }) => Record<string, unknown>;
      };
    };

    mockGlobal.game = {
      settings: { get: () => "roll" },
      modules: { get: () => ({ active: false }) },
      i18n: {
        format: vi.fn((key: string, data: Record<string, unknown>) => {
          return `${data.name} rolls for Initiative!`;
        }),
      },
    };

    mockGlobal.ChatMessage = {
      implementation: {
        create: vi.fn(async () => ({ id: "msg1" })),
      },
      getSpeaker: vi.fn(() => ({ alias: "Test" })),
    };

    class BaseCombat {
      combatants = [
        {
          id: "c1",
          _id: "c1",
          actor: {
            id: "a1",
            name: "Fighter",
          },
          token: { name: "Fighter Token" },
          hidden: false,
          getInitiativeRoll: vi.fn(async (formula: string) => {
            rolledFormulas.push(`c1:${formula}`);
            return {
              total: 18,
              toMessage: vi.fn(async () => ({
                speaker: { alias: "Fighter" },
                flavor: "Fighter rolls for Initiative!",
              })),
            };
          }),
          _getInitiativeFormula: vi.fn(() => "1d20+3"),
        },
        {
          id: "c2",
          _id: "c2",
          actor: {
            id: "a2",
            name: "Rogue",
          },
          token: { name: "Rogue Token" },
          hidden: false,
          getInitiativeRoll: vi.fn(async (formula: string) => {
            rolledFormulas.push(`c2:${formula}`);
            return {
              total: 22,
              toMessage: vi.fn(async () => ({
                speaker: { alias: "Rogue" },
                flavor: "Rogue rolls for Initiative!",
              })),
            };
          }),
          _getInitiativeFormula: vi.fn(() => "1d20+5"),
        },
      ];

      updateEmbeddedDocuments = vi.fn(
        async (_type: string, updates: Array<{ _id: string; initiative: number }>) => {
          updatedInitiatives.push(...updates);
        },
      );
      update = vi.fn(async () => {});
      combatant = undefined;
      turns = [];
    }

    const PivotCombat = createPivotCombatClass(BaseCombat as never);
    const combat = new PivotCombat();

    await (
      combat as {
        rollInitiative: (ids: string[], options?: Record<string, unknown>) => Promise<unknown>;
      }
    ).rollInitiative(["c1", "c2"]);

    // Each combatant should use its own formula
    expect(rolledFormulas).toEqual(["c1:1d20+3", "c2:1d20+5"]);
    // Both initiatives should be updated
    expect(updatedInitiatives).toEqual([
      { _id: "c1", initiative: 18 },
      { _id: "c2", initiative: 22 },
    ]);
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
        i18n?: { format?: (key: string, data: Record<string, unknown>) => string };
      };
      ChatMessage?: {
        implementation?: {
          create?: (data: Record<string, unknown>) => Promise<unknown>;
        };
        getSpeaker?: (options: {
          actor?: unknown;
          token?: unknown;
          alias?: string;
        }) => Record<string, unknown>;
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
      i18n: {
        format: vi.fn((key: string, data: Record<string, unknown>) => {
          return `${data.name} rolls for Initiative!`;
        }),
      },
    };

    mockGlobal.ChatMessage = {
      implementation: {
        create: vi.fn(async () => ({ id: "msg1" })),
      },
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
          },
          token: { name: "Hero Token" },
          hidden: false,
          getInitiativeRoll: vi.fn(async () => ({
            total: 15,
            toMessage: vi.fn(async () => ({
              speaker: { alias: "Hero" },
              flavor: "Hero rolls for Initiative!",
            })),
          })),
          _getInitiativeFormula: vi.fn(() => "1d20"),
        },
      ];

      updateEmbeddedDocuments = vi.fn(async () => {
        updateCalled = true;
      });
      update = vi.fn(async () => {});
      combatant = undefined;
      turns = [];
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
        i18n?: { format?: (key: string, data: Record<string, unknown>) => string };
      };
      ChatMessage?: {
        implementation?: {
          create?: (data: Record<string, unknown>) => Promise<unknown>;
        };
        getSpeaker?: (options: {
          actor?: unknown;
          token?: unknown;
          alias?: string;
        }) => Record<string, unknown>;
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
      i18n: {
        format: vi.fn((key: string, data: Record<string, unknown>) => {
          return `${data.name} rolls for Initiative!`;
        }),
      },
    };

    mockGlobal.ChatMessage = {
      implementation: {
        create: vi.fn(async () => ({ id: "msg1" })),
      },
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
          },
          token: { name: "Hero Token" },
          hidden: false,
          getInitiativeRoll: vi.fn(async () => ({
            total: 15,
            toMessage: vi.fn(async () => ({
              speaker: { alias: "Hero" },
              flavor: "Hero rolls for Initiative!",
            })),
          })),
          _getInitiativeFormula: vi.fn(() => "1d20"),
        },
      ];

      updateEmbeddedDocuments = vi.fn(async () => {
        updateCalled = true;
      });
      update = vi.fn(async () => {});
      combatant = undefined;
      turns = [];
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
});
