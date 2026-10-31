import { afterEach, expect, it, vi } from "vitest";
import en from "../../lang/en.json";
import {
  clearTempHpDialog,
  correctSurvivalDialog,
  deathSaveDialog,
} from "../../src/runtime/death-saves";
import { readSurvival } from "../../src/runtime/survival-transaction";
import { applyHealth, type SurvivalStatus } from "../../src/rules/survival";
import { inMemoryCharacter } from "../helpers/in-memory-actor";
afterEach(() => vi.unstubAllGlobals());
function setup(uuid = "Actor.death", hp = 0, status: SurvivalStatus = "dying") {
  const actor = inMemoryCharacter({ hp, status }, { uuid });
  if (uuid.startsWith("Scene.")) actor.token = { name: "Hero Token" };
  dialogReturns("normal");
  vi.stubGlobal("ChatMessage", { create: vi.fn(async () => {}) });
  return actor;
}
function dialogReturns(value: unknown) {
  vi.stubGlobal("foundry", {
    applications: { api: { DialogV2: { prompt: async () => value } } },
  });
}
function rollNatural(result: number, onEvaluate: () => void = () => {}) {
  vi.stubGlobal(
    "Roll",
    class {
      dice = [{ faces: 20, results: [{ result }] }];
      async evaluate() {
        onEvaluate();
      }
    },
  );
}
function captureWarnings(): string[] {
  const seen: string[] = [];
  vi.stubGlobal("ui", { notifications: { warn: (message: string) => seen.push(message) } });
  return seen;
}
it("writes natural20 recovery once even when chat reporting fails", async () => {
  const actor = setup();
  rollNatural(20);
  vi.stubGlobal("ChatMessage", {
    create: vi.fn(async () => {
      throw Error("chat");
    }),
  });
  await deathSaveDialog(actor);
  expect(actor.writes).toHaveLength(1);
  expect(readSurvival(actor)).toMatchObject({ hp: 1, status: "alive" });
});
it("writes the death save before posting its card, with the roll attached", async () => {
  const actor = setup();
  rollNatural(20);
  const atPost: Array<{ status: string; rolls: unknown }> = [];
  vi.stubGlobal("ChatMessage", {
    create: vi.fn(async (data: { rolls?: unknown[] }) => {
      atPost.push({ status: readSurvival(actor).status, rolls: data.rolls?.length });
    }),
  });
  await deathSaveDialog(actor);
  expect(atPost).toEqual([{ status: "alive", rolls: 1 }]);
});
it("posts no death-save card and warns when the write fails", async () => {
  const actor = setup();
  const seen = captureWarnings();
  rollNatural(20);
  const create = vi.fn(async () => {});
  vi.stubGlobal("ChatMessage", { create });
  actor.update = async () => {
    throw Error("write");
  };
  await deathSaveDialog(actor);
  expect(create).not.toHaveBeenCalled();
  expect(seen).toEqual(["DeathFailed"]);
  expect(readSurvival(actor)).toMatchObject({ hp: 0, status: "dying" });
});
it("rechecks ownership after the roll", async () => {
  const actor = setup();
  rollNatural(20, () => (actor.isOwner = false));
  await deathSaveDialog(actor);
  expect(actor.writes).toEqual([]);
});
it("does not roll stable actors", async () => {
  const actor = setup(undefined, 0, "stable");
  const roll = vi.fn();
  vi.stubGlobal("Roll", roll);
  await deathSaveDialog(actor);
  expect(roll).not.toHaveBeenCalled();
  expect(actor.writes).toEqual([]);
});
it("refuses a death save when the Character changed during the roll", async () => {
  const actor = setup();
  const seen = captureWarnings();
  rollNatural(9, () => Object.assign(actor.system, inMemoryCharacter({ hp: 5 }).system));
  await deathSaveDialog(actor);
  expect(seen).toEqual(["StateChanged"]);
  expect(readSurvival(actor)).toMatchObject({ hp: 5, status: "alive" });
});
it("records a death save for a linked actor and a token actor at 0 HP", async () => {
  for (const uuid of ["Actor.linked", "Scene.s.Token.t"]) {
    const seen = captureWarnings();
    const actor = setup(uuid, 0, "alive");
    rollNatural(9);
    await deathSaveDialog(actor);
    expect(seen, uuid).toEqual([]);
    expect(readSurvival(actor)).toMatchObject({
      hp: 0,
      status: "dying",
      successes: 0,
      failures: 1,
    });
  }
});
it("records a death save after damage drops a stale dying character to 0", async () => {
  for (const uuid of ["Actor.linked", "Scene.s.Token.t"]) {
    const actor = setup(uuid, 10, "dying");
    const down = applyHealth(readSurvival(actor), "damage", 10);
    Object.assign(actor.system, inMemoryCharacter(down).system);
    const seen = captureWarnings();
    rollNatural(9);
    await deathSaveDialog(actor);
    expect(seen, uuid).toEqual([]);
    expect(readSurvival(actor)).toMatchObject({ hp: 0, status: "dying", failures: 1 });
  }
});

it("lets the GM stabilize a Dying Character and clears the counters", async () => {
  vi.stubGlobal("game", { user: { isGM: true } });
  const actor = inMemoryCharacter({ hp: 0, status: "dying", failures: 2 });
  dialogReturns({ hp: 0, temp: 0, successes: 1, failures: 2, status: "stable" });
  await correctSurvivalDialog(actor);
  expect(readSurvival(actor)).toMatchObject({ status: "stable", successes: 0, failures: 0 });
});

it("warns and writes nothing for an inconsistent correction", async () => {
  vi.stubGlobal("game", { user: { isGM: true } });
  const seen = captureWarnings();
  const actor = inMemoryCharacter({ hp: 0, status: "dying" });
  dialogReturns({ hp: 5, temp: 0, successes: 0, failures: 0, status: "dying" });
  await correctSurvivalDialog(actor);
  expect(seen).toEqual(["ApplyFailed"]);
  expect(actor.writes).toEqual([]);
});

it("refuses Dying or Stable above 0 HP and tells the GM why, whatever the temporary HP", async () => {
  const notice = "Dying and Stable need 0 HP. Set HP to 0 first, or choose Conscious.";
  for (const status of ["dying", "stable"] as const) {
    vi.stubGlobal("game", {
      user: { isGM: true },
      i18n: { localize: (key: string) => (en as Record<string, string>)[key] ?? key },
    });
    const seen = captureWarnings();
    const actor = inMemoryCharacter({ hp: 5, temp: 4, status: "alive" });
    dialogReturns({ hp: 5, temp: 9, successes: 1, failures: 1, status });
    await correctSurvivalDialog(actor);
    expect(seen, status).toEqual([notice]);
    expect(actor.writes, status).toEqual([]);
    expect(readSurvival(actor), status).toMatchObject({ hp: 5, temp: 4, status: "alive" });
  }
});

it("does not open a correction for a player", async () => {
  vi.stubGlobal("game", { user: { isGM: false } });
  const prompt = vi.fn();
  vi.stubGlobal("foundry", { applications: { api: { DialogV2: { prompt } } } });
  await correctSurvivalDialog(inMemoryCharacter());
  expect(prompt).not.toHaveBeenCalled();
});

it("clears only Temporary HP after confirmation", async () => {
  const actor = inMemoryCharacter({ hp: 7, temp: 4 });
  dialogReturns(null);
  await clearTempHpDialog(actor);
  expect(readSurvival(actor).temp).toBe(4);
  dialogReturns(true);
  await clearTempHpDialog(actor);
  expect(readSurvival(actor)).toMatchObject({ hp: 7, temp: 0, status: "alive" });
});
