import { afterEach, expect, it, vi } from "vitest";
import { readSurvival, runSurvivalTransaction } from "../../src/runtime/survival-transaction";
import { longRestDialog, shortRestDialog } from "../../src/runtime/rest-dialogs";
import type { SurvivalStatus } from "../../src/rules/survival";
import { inMemoryCharacter, type InMemoryActor } from "../helpers/in-memory-actor";

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
  progressClose.mockClear();
});

function setup(hp: number, status: SurvivalStatus, prompts: unknown[]) {
  const actor = inMemoryCharacter(
    { hp, max: 20, temp: 2, status, successes: 1, failures: 1 },
    {
      uuid: "Actor.rest",
      system: {
        abilities: { con: { score: 10 } },
        progression: { level: 3 },
        resources: { pool: { value: 2 } },
        magic: { awakened: false, mp: { value: 0 } },
      },
    },
  );
  (actor.system.attributes as { hitDie?: string }).hitDie = "d8";
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

function hpOf(actor: InMemoryActor) {
  return (actor.system.attributes as { hp: { value: number } }).hp;
}
function poolOf(actor: InMemoryActor) {
  return (actor.system.resources as { pool: { value: number } }).pool.value;
}

it("short rest heals a Dying character back to Conscious with counters reset", async () => {
  const { actor } = setup(0, "dying", [{ poolSpendsRaw: "1", inDanger: false }]);
  await shortRestDialog(actor);
  expect(readSurvival(actor)).toMatchObject({ hp: 3, status: "alive", successes: 0, failures: 0 });
  expect(poolOf(actor)).toBe(1);
});

it("long rest refuses to resurrect a Dead character", async () => {
  const { actor, warn } = setup(0, "dead", [{ safeAndComfortable: true }]);
  await longRestDialog(actor);
  expect(actor.writes).toEqual([]);
  expect(warn).toHaveBeenCalledWith("PIVOT.Rest.Unavailable");
});

it("long rest writes full HP with a consistent status and clears temp HP", async () => {
  const { actor } = setup(0, "stable", [{ safeAndComfortable: true }]);
  await longRestDialog(actor);
  expect(readSurvival(actor)).toMatchObject({ hp: 20, temp: 0, status: "alive" });
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
  expect(hpOf(actor).value).toBe(4);
  expect(actor.writes).toEqual([]);
  expect(warn).toHaveBeenCalledWith("PIVOT.Rest.StateChanged");
});

it("does not start while another Survival transaction holds the Character", async () => {
  const { actor, warn } = setup(10, "alive", [{ poolSpendsRaw: "1", inDanger: false }]);
  let release: () => void = () => {};
  const held = runSurvivalTransaction(actor, async () => {
    await new Promise<void>((resolve) => (release = resolve));
    return null;
  });
  await shortRestDialog(actor);
  expect(actor.writes).toEqual([]);
  expect(warn).toHaveBeenCalledWith("PIVOT.Rest.Unavailable");
  release();
  await held;
});

it("releases the Character after the rest", async () => {
  const { actor } = setup(10, "alive", [{ poolSpendsRaw: "1", inDanger: false }]);
  await shortRestDialog(actor);
  const next = await runSurvivalTransaction(actor, () => null);
  expect(next.outcome).toBe("cancelled");
});

it("does not overwrite a Pool change made during the rest", async () => {
  const { actor, warn } = setup(10, "alive", []);
  vi.stubGlobal("foundry", {
    applications: {
      api: {
        DialogV2: {
          prompt: async () => {
            (actor.system.resources as { pool: { value: number } }).pool.value = 0;
            return { safeAndComfortable: true };
          },
        },
      },
    },
  });
  await longRestDialog(actor);
  expect(actor.writes).toEqual([]);
  expect(warn).toHaveBeenCalledWith("PIVOT.Rest.StateChanged");
});

it("closes the progress dialog when the hit die cannot be rolled", async () => {
  const { actor, warn } = setup(10, "alive", [{ poolSpendsRaw: "1", inDanger: false }]);
  (actor.system.attributes as { hitDie: string }).hitDie = "d1";
  await shortRestDialog(actor);
  expect(actor.writes).toEqual([]);
  expect(warn).toHaveBeenCalledWith("PIVOT.Rest.RestFailed");
  expect(progressClose).toHaveBeenCalledTimes(1);
});
