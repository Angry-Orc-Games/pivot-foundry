import { afterEach, expect, it, vi } from "vitest";
import { survivalLocks } from "../../src/runtime/survival-transaction";
import { longRestDialog, shortRestDialog } from "../../src/runtime/rest-dialogs";
import type { ActorLike } from "../../src/sheets/character-sheet";

const progressClose = vi.hoisted(() => vi.fn());
vi.mock("../../src/runtime/roll-progress", () => ({
  rollProgress: () => ({
    wait: <T>(work: Promise<T>) => work,
    close: progressClose,
    cancel: () => {},
  }),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  survivalLocks.clear();
  progressClose.mockClear();
});

function setup(hp: number, status: string, prompts: unknown[]) {
  const actor: ActorLike = {
    uuid: "Actor.rest",
    name: "Hero",
    type: "character",
    isOwner: true,
    system: {
      abilities: { con: { score: 10 } },
      progression: { level: 3 },
      attributes: {
        hitDie: "d8",
        hp: { value: hp, max: 20, temp: 2 },
        deathSaves: { status, successes: 1, failures: 1 },
      },
      resources: { pool: { value: 2 } },
      magic: { awakened: false, mp: { value: 0 } },
    },
    update: vi.fn(async () => {}),
  };
  const queue = [...prompts];
  vi.stubGlobal("foundry", {
    applications: { api: { DialogV2: { prompt: async () => queue.shift() ?? null } } },
  });
  vi.stubGlobal("ChatMessage", { create: vi.fn(async () => {}), applyRollMode: vi.fn() });
  const warn = vi.fn();
  vi.stubGlobal("ui", { notifications: { warn } });
  vi.stubGlobal(
    "Roll",
    class {
      total = 3;
      async evaluate() {}
    },
  );
  return { actor, warn };
}

function hpOf(actor: ActorLike) {
  return (actor.system.attributes as { hp: { value: number } }).hp;
}

it("short rest heals a Dying character back to Conscious with counters reset", async () => {
  const { actor } = setup(0, "dying", [{ poolSpendsRaw: "1", inDanger: false }]);
  await shortRestDialog(actor);
  expect(actor.update).toHaveBeenCalledWith(
    expect.objectContaining({
      "system.attributes.hp.value": 3,
      "system.attributes.deathSaves.status": "alive",
      "system.attributes.deathSaves.successes": 0,
      "system.attributes.deathSaves.failures": 0,
      "system.resources.pool.value": 1,
    }),
  );
});

it("long rest refuses to resurrect a Dead character", async () => {
  const { actor, warn } = setup(0, "dead", [{ safeAndComfortable: true }]);
  await longRestDialog(actor);
  expect(actor.update).not.toHaveBeenCalled();
  expect(warn).toHaveBeenCalledWith("PIVOT.Rest.Unavailable");
});

it("long rest writes full HP with a consistent status and clears temp HP", async () => {
  const { actor } = setup(0, "stable", [{ safeAndComfortable: true }]);
  await longRestDialog(actor);
  expect(actor.update).toHaveBeenCalledWith(
    expect.objectContaining({
      "system.attributes.hp.value": 20,
      "system.attributes.hp.temp": 0,
      "system.attributes.deathSaves.status": "alive",
    }),
  );
});

it("does not overwrite damage that lands while the rest dialog is open", async () => {
  const { actor, warn } = setup(10, "alive", []);
  vi.stubGlobal("foundry", {
    applications: {
      api: {
        DialogV2: {
          prompt: async () => {
            hpOf(actor).value = 4;
            return { safeAndComfortable: true };
          },
        },
      },
    },
  });
  await longRestDialog(actor);
  expect(actor.update).not.toHaveBeenCalled();
  expect(warn).toHaveBeenCalledWith("PIVOT.Rest.StateChanged");
});

it("does not start while another HP action holds the actor", async () => {
  const { actor, warn } = setup(10, "alive", [{ poolSpendsRaw: "1", inDanger: false }]);
  survivalLocks.add("Actor.rest");
  await shortRestDialog(actor);
  expect(actor.update).not.toHaveBeenCalled();
  expect(warn).toHaveBeenCalledWith("PIVOT.Rest.Unavailable");
  expect(survivalLocks.has("Actor.rest")).toBe(true);
});

it("releases the actor lock after the rest", async () => {
  const { actor } = setup(10, "alive", [{ poolSpendsRaw: "1", inDanger: false }]);
  await shortRestDialog(actor);
  expect(survivalLocks.has("Actor.rest")).toBe(false);
});

it("closes the progress dialog when the hit die cannot be rolled", async () => {
  const { actor, warn } = setup(10, "alive", [{ poolSpendsRaw: "1", inDanger: false }]);
  (actor.system.attributes as { hitDie: string }).hitDie = "d1";
  await shortRestDialog(actor);
  expect(actor.update).not.toHaveBeenCalled();
  expect(warn).toHaveBeenCalledWith("PIVOT.Rest.RestFailed");
  expect(progressClose).toHaveBeenCalledTimes(1);
});
