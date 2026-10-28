import { afterEach, expect, it, vi } from "vitest";
import { deathSaveDialog } from "../../src/runtime/death-saves";
import { readSurvival, type HealthActor } from "../../src/runtime/health";
import { applyHealth } from "../../src/rules/survival";
afterEach(() => vi.unstubAllGlobals());
function setup(uuid = "Actor.death", hp = 0, status = "dying") {
  const actor: HealthActor = {
    uuid,
    name: "Hero",
    type: "character",
    isOwner: true,
    token: uuid.startsWith("Scene.") ? { name: "Hero Token" } : undefined,
    system: {
      attributes: {
        hp: { value: hp, max: 20, temp: 0 },
        deathSaves: { status, successes: 0, failures: 0 },
      },
    },
    update: vi.fn(async () => {}),
  };
  vi.stubGlobal("foundry", {
    applications: { api: { DialogV2: { prompt: async () => "normal" } } },
  });
  vi.stubGlobal("ChatMessage", { create: vi.fn(async () => {}) });
  return actor;
}
it("writes natural20 recovery once even when chat reporting fails", async () => {
  const actor = setup();
  vi.stubGlobal(
    "Roll",
    class {
      dice = [{ faces: 20, results: [{ result: 20 }] }];
      async evaluate() {}
    },
  );
  const failingCreate = vi.fn(async () => {
    throw Error("chat");
  });
  vi.stubGlobal("ChatMessage", {
    create: failingCreate,
    applyRollMode: vi.fn(),
  });
  await deathSaveDialog(actor);
  expect(failingCreate).toHaveBeenCalledTimes(1);
  expect(actor.update).toHaveBeenCalledTimes(1);
  expect(actor.update).toHaveBeenCalledWith(
    expect.objectContaining({
      "system.attributes.hp.value": 1,
      "system.attributes.deathSaves.status": "alive",
    }),
  );
});
it("rechecks ownership after the roll", async () => {
  const actor = setup();
  vi.stubGlobal(
    "Roll",
    class {
      dice = [{ faces: 20, results: [{ result: 20 }] }];
      async evaluate() {
        actor.isOwner = false;
      }
    },
  );
  await deathSaveDialog(actor);
  expect(actor.update).not.toHaveBeenCalled();
});
it("does not roll stable actors", async () => {
  const actor = setup();
  (actor.system.attributes as { deathSaves: { status: string } }).deathSaves.status = "stable";
  const roll = vi.fn();
  vi.stubGlobal("Roll", roll);
  await deathSaveDialog(actor);
  expect(roll).not.toHaveBeenCalled();
  expect(actor.update).not.toHaveBeenCalled();
});
function rollNine() {
  vi.stubGlobal(
    "Roll",
    class {
      dice = [{ faces: 20, results: [{ result: 9 }] }];
      async evaluate() {}
    },
  );
}
function captureWarnings(): string[] {
  const seen: string[] = [];
  vi.stubGlobal("ui", { notifications: { warn: (message: string) => seen.push(message) } });
  return seen;
}
it("records a death save for a linked actor and a token actor at 0 HP", async () => {
  for (const uuid of ["Actor.linked", "Scene.s.Token.t"]) {
    const seen = captureWarnings();
    const actor = setup(uuid, 0, "alive");
    rollNine();
    await deathSaveDialog(actor);
    expect(seen, uuid).toEqual([]);
    expect(actor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        "system.attributes.hp.value": 0,
        "system.attributes.deathSaves.status": "dying",
        "system.attributes.deathSaves.successes": 0,
        "system.attributes.deathSaves.failures": 1,
      }),
    );
  }
});
it("records a death save after damage drops a stale dying character to 0", async () => {
  for (const uuid of ["Actor.linked", "Scene.s.Token.t"]) {
    const actor = setup(uuid, 10, "dying");
    const down = applyHealth(readSurvival(actor), "damage", 10);
    const attributes = actor.system.attributes as {
      hp: { value: number };
      deathSaves: { status: string; successes: number; failures: number };
    };
    attributes.hp.value = down.hp;
    attributes.deathSaves.status = down.status;
    attributes.deathSaves.successes = down.successes;
    attributes.deathSaves.failures = down.failures;
    const seen = captureWarnings();
    rollNine();
    await deathSaveDialog(actor);
    expect(seen, uuid).toEqual([]);
    expect(actor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        "system.attributes.hp.value": 0,
        "system.attributes.deathSaves.status": "dying",
        "system.attributes.deathSaves.failures": 1,
      }),
    );
  }
});
