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

  it("passes gm messageMode for a hidden combatant on a public roll", async () => {
    let passedOptions: { messageMode?: string; rollMode?: string; create?: boolean } | undefined;
    let chatDataType: number | undefined;

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
      settings: {
        get: (_scope: string, key: string) => (key === "messageMode" ? "public" : "roll"),
      },
      modules: { get: () => ({ active: false }) },
      i18n: {
        format: vi.fn((key: string, data: Record<string, unknown>) => {
          return `${data.name} rolls for Initiative!`;
        }),
      },
    };

    mockGlobal.ChatMessage = {
      implementation: {
        create: vi.fn(async (data: Record<string, unknown>) => {
          chatDataType = data.type as number | undefined;
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
          hidden: true,
          getInitiativeRoll: vi.fn(async () => ({
            total: 15,
            toMessage: vi.fn(
              async (
                _data,
                options?: { messageMode?: string; rollMode?: string; create?: boolean },
              ) => {
                passedOptions = options;
                return {
                  speaker: { alias: "Hero" },
                  flavor: "Hero rolls for Initiative!",
                };
              },
            ),
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

    expect(passedOptions).toEqual({ messageMode: "gm", create: false });
    expect(chatDataType).toBeUndefined();
  });

  it("honors messageOptions.messageMode when provided", async () => {
    let passedOptions: { messageMode?: string; rollMode?: string; create?: boolean } | undefined;

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
      settings: {
        get: (_scope: string, key: string) => (key === "messageMode" ? "public" : "roll"),
      },
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
            name: "Hero",
          },
          token: { name: "Hero Token" },
          hidden: false,
          getInitiativeRoll: vi.fn(async () => ({
            total: 15,
            toMessage: vi.fn(
              async (
                _data,
                options?: { messageMode?: string; rollMode?: string; create?: boolean },
              ) => {
                passedOptions = options;
                return {
                  speaker: { alias: "Hero" },
                  flavor: "Hero rolls for Initiative!",
                };
              },
            ),
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
    ).rollInitiative(["c1"], { messageOptions: { messageMode: "blind" } });

    expect(passedOptions).toEqual({ messageMode: "blind", create: false });
  });

  it("merges messageOptions without copying messageMode onto the chat data", async () => {
    let receivedMessageData: Record<string, unknown> = {};
    let receivedOptions: { messageMode?: string; rollMode?: string; create?: boolean } = {};

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
      settings: {
        get: (_scope: string, key: string) => (key === "messageMode" ? "public" : "roll"),
      },
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
            name: "Hero",
          },
          token: { name: "Hero Token" },
          hidden: false,
          getInitiativeRoll: vi.fn(async () => ({
            total: 15,
            toMessage: vi.fn(
              async (
                data: Record<string, unknown>,
                options?: { messageMode?: string; rollMode?: string; create?: boolean },
              ) => {
                receivedMessageData = data;
                receivedOptions = options ?? {};
                return {
                  speaker: { alias: "Hero" },
                  flavor: "Hero rolls for Initiative!",
                  customField: data.customField,
                };
              },
            ),
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
    ).rollInitiative(["c1"], {
      messageOptions: { customField: "test-value", messageMode: "gm" },
    });

    expect(receivedMessageData.customField).toBe("test-value");
    expect(receivedMessageData.messageMode).toBeUndefined();
    expect(receivedMessageData.rollMode).toBeUndefined();
    expect(receivedOptions).toEqual({ messageMode: "gm", create: false });
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

  async function postedInitiative(input: {
    setting?: unknown;
    hidden?: boolean;
    messageOptions?: Record<string, unknown>;
  }): Promise<{ data: Record<string, unknown>; options: Record<string, unknown> }> {
    let data: Record<string, unknown> = {};
    let options: Record<string, unknown> = {};
    const mockGlobal = globalThis as typeof globalThis & {
      game?: {
        settings?: { get?: (scope: string, key: string) => unknown };
        modules?: { get?: (id: string) => { active?: boolean } | undefined };
        i18n?: { format?: (key: string, data: Record<string, unknown>) => string };
      };
      ChatMessage?: {
        implementation?: { create?: (data: Record<string, unknown>) => Promise<unknown> };
        getSpeaker?: () => Record<string, unknown>;
      };
    };
    mockGlobal.game = {
      settings: {
        get: (_scope: string, key: string) => (key === "messageMode" ? input.setting : "gmroll"),
      },
      modules: { get: () => ({ active: false }) },
      i18n: { format: (_key: string, payload: Record<string, unknown>) => `${payload.name} rolls` },
    };
    mockGlobal.ChatMessage = {
      implementation: { create: vi.fn(async () => ({ id: "msg1" })) },
      getSpeaker: () => ({ alias: "Test" }),
    };

    class BaseCombat {
      combatants = [
        {
          id: "c1",
          _id: "c1",
          actor: { id: "a1", name: "Hero" },
          token: { name: "Hero Token" },
          hidden: input.hidden ?? false,
          getInitiativeRoll: vi.fn(async () => ({
            total: 15,
            _evaluated: true,
            toMessage: vi.fn(
              async (
                messageData: Record<string, unknown>,
                messageOptions?: Record<string, unknown>,
              ) => {
                data = messageData;
                options = messageOptions ?? {};
                return { speaker: { alias: "Hero" } };
              },
            ),
          })),
          _getInitiativeFormula: () => "1d20",
        },
      ];
      updateEmbeddedDocuments = vi.fn(async () => {});
      update = vi.fn(async () => {});
      combatant = undefined;
      turns: unknown[] = [];
    }

    const combat = new (createPivotCombatClass(BaseCombat as never))() as {
      rollInitiative: (ids: string[], options?: Record<string, unknown>) => Promise<unknown>;
    };
    await combat.rollInitiative(
      ["c1"],
      input.messageOptions ? { messageOptions: input.messageOptions } : {},
    );
    return { data, options };
  }

  it.each(["public", "gm", "blind", "self"])(
    "follows core.messageMode %s for a visible combatant",
    async (mode) => {
      const { data, options } = await postedInitiative({ setting: mode });
      expect(options).toEqual({ messageMode: mode, create: false });
      expect(data.messageMode).toBeUndefined();
      expect(data.rollMode).toBeUndefined();
    },
  );

  it.each(["gm", "blind", "self"])("keeps messageMode %s for a hidden combatant", async (mode) => {
    const { options } = await postedInitiative({ setting: mode, hidden: true });
    expect(options).toEqual({ messageMode: mode, create: false });
  });

  it("defaults a missing or non-string message mode to public", async () => {
    const missing = await postedInitiative({ setting: undefined });
    const numeric = await postedInitiative({ setting: 4 });
    expect(missing.options).toEqual({ messageMode: "public", create: false });
    expect(numeric.options).toEqual({ messageMode: "public", create: false });
  });

  it("sends a hidden combatant to the GM when messageOptions asks for public", async () => {
    const { options } = await postedInitiative({
      setting: "self",
      hidden: true,
      messageOptions: { messageMode: "public" },
    });
    expect(options).toEqual({ messageMode: "gm", create: false });
  });
});

describe("PivotCombat rollInitiative with unevaluated v14 rolls", () => {
  function makeUnevaluatedRoll(result: number) {
    const roll = {
      _evaluated: false,
      total: undefined as number | undefined,
      evaluate: vi.fn(async () => {
        roll._evaluated = true;
        roll.total = result;
        return roll;
      }),
      toMessage: vi.fn<
        (data: Record<string, unknown>, opts?: Record<string, unknown>) => Promise<unknown>
      >(async (data) => ({ ...data })),
    };
    return roll;
  }

  function setup(options: { currentId?: string; reorder?: boolean } = {}) {
    let msgCount = 0;
    const create = vi.fn(async () => ({ id: `msg${++msgCount}` }));
    const g = globalThis as Record<string, unknown>;
    g.game = {
      settings: { get: () => "roll" },
      modules: { get: () => ({ active: false }) },
      i18n: { format: (_k: string, d: Record<string, unknown>) => `${String(d.name)} rolls` },
    };
    g.ChatMessage = {
      implementation: { create },
      getSpeaker: () => ({ alias: "Test" }),
    };
    const rolls = { c1: makeUnevaluatedRoll(3), c2: makeUnevaluatedRoll(12) };
    const updates: Array<{ _id: string; initiative: number }> = [];
    const updateCalls: Array<Record<string, unknown>> = [];

    class BaseCombat {
      combatants = (["c1", "c2"] as const).map((id) => ({
        id,
        _id: id,
        actor: { id: `a-${id}`, name: id },
        hidden: false,
        getInitiativeRoll: vi.fn(async () => rolls[id]),
        _getInitiativeFormula: () => "1d20",
      }));
      combatant = options.currentId ? { id: options.currentId } : undefined;
      turns: Array<{ id: string }> = [{ id: "c1" }, { id: "c2" }];
      updateEmbeddedDocuments = vi.fn(
        async (_t: string, u: Array<{ _id: string; initiative: number }>) => {
          updates.push(...u);
          // Simulate core re-sorting turns by initiative (descending)
          if (options.reorder) this.turns = [{ id: "c2" }, { id: "c1" }];
        },
      );
      update = vi.fn(async (data: Record<string, unknown>) => {
        updateCalls.push(data);
      });
    }

    const PivotCombat = createPivotCombatClass(BaseCombat as never);
    const combat = new PivotCombat() as {
      rollInitiative: (ids: string[], options?: Record<string, unknown>) => Promise<unknown>;
    };
    return { combat, rolls, updates, updateCalls, create };
  }

  it("evaluates the roll and stores its total, with one message per roll and create:false", async () => {
    const { combat, rolls, updates, create } = setup();
    await combat.rollInitiative(["c1", "c2"]);

    expect(rolls.c1.evaluate).toHaveBeenCalledTimes(1);
    expect(rolls.c2.evaluate).toHaveBeenCalledTimes(1);
    expect(updates).toEqual([
      { _id: "c1", initiative: 3 },
      { _id: "c2", initiative: 12 },
    ]);
    expect(create).toHaveBeenCalledTimes(2);
    for (const roll of [rolls.c1, rolls.c2]) {
      expect(roll.toMessage).toHaveBeenCalledTimes(1);
      expect(roll.toMessage.mock.calls[0]?.[1]).toEqual(expect.objectContaining({ create: false }));
    }
  });

  it("does not re-evaluate an already evaluated roll", async () => {
    const { combat, rolls, updates } = setup();
    rolls.c1._evaluated = true;
    rolls.c1.total = 7;
    await combat.rollInitiative(["c1"]);
    expect(rolls.c1.evaluate).not.toHaveBeenCalled();
    expect(updates).toEqual([{ _id: "c1", initiative: 7 }]);
  });

  it("preserves the current turn after rolling once the round has started", async () => {
    const { combat, updateCalls } = setup({ currentId: "c1", reorder: true });
    await combat.rollInitiative(["c2"]);
    // c2 rolled higher and was sorted first; current combatant c1 is now index 1
    expect(updateCalls).toEqual([{ turn: 1 }]);
  });
});
