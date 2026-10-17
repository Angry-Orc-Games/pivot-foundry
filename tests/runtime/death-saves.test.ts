import { afterEach, expect, it, vi } from "vitest";
import {
  clearTempHpDialog,
  correctSurvivalDialog,
  deathSaveDialog,
} from "../../src/runtime/death-saves";
import type { HealthActor } from "../../src/runtime/health";
afterEach(() => vi.unstubAllGlobals());
function setup() {
  const actor: HealthActor = {
    uuid: "Actor.death",
    name: "Hero",
    type: "character",
    isOwner: true,
    system: {
      attributes: {
        hp: { value: 0, max: 20, temp: 0 },
        deathSaves: { status: "dying", successes: 0, failures: 0 },
      },
    },
    update: vi.fn(async () => {}),
  };
  vi.stubGlobal("foundry", {
    applications: { api: { DialogV2: { prompt: async () => "normal" } } },
  });
  vi.stubGlobal("ChatMessage", { create: vi.fn(async () => {}), applyRollMode: vi.fn() });
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
  vi.stubGlobal("ChatMessage", {
    create: vi.fn(async () => {
      throw Error("chat");
    }),
  });
  await deathSaveDialog(actor);
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

it("lets a GM correct survival and clears death saves once HP returns", async () => {
  const actor = setup();
  vi.stubGlobal("game", { user: { isGM: true } });
  vi.stubGlobal("foundry", {
    applications: {
      api: {
        DialogV2: {
          prompt: async () => ({
            hp: 5,
            max: 20,
            temp: 0,
            successes: 2,
            failures: 1,
            status: "alive",
          }),
        },
      },
    },
  });
  await correctSurvivalDialog(actor);
  expect(actor.update).toHaveBeenCalledWith(
    expect.objectContaining({
      "system.attributes.hp.value": 5,
      "system.attributes.deathSaves.successes": 0,
      "system.attributes.deathSaves.failures": 0,
      "system.attributes.deathSaves.status": "alive",
    }),
  );
});

it("ignores a non-GM correction and a correction of a changed actor", async () => {
  const ignored = setup();
  const prompt = vi.fn();
  vi.stubGlobal("foundry", { applications: { api: { DialogV2: { prompt } } } });
  await correctSurvivalDialog(ignored);
  expect(prompt).not.toHaveBeenCalled();

  const actor = setup();
  vi.stubGlobal("game", { user: { isGM: true } });
  vi.stubGlobal("ui", { notifications: { warn: vi.fn() } });
  vi.stubGlobal("foundry", {
    applications: {
      api: {
        DialogV2: {
          prompt: async () => {
            actor.system = {
              attributes: {
                hp: { value: 1, max: 20, temp: 0 },
                deathSaves: { status: "alive", successes: 0, failures: 0 },
              },
            };
            return {
              hp: 5,
              max: 20,
              temp: 0,
              successes: 0,
              failures: 0,
              status: "alive",
            };
          },
        },
      },
    },
  });
  await correctSurvivalDialog(actor);
  expect(actor.update).not.toHaveBeenCalled();
});

it("clears temporary HP for the owner and warns when that is no longer allowed", async () => {
  const actor = setup();
  (actor.system.attributes as { hp: { temp: number } }).hp.temp = 3;
  vi.stubGlobal("foundry", {
    applications: { api: { DialogV2: { prompt: async () => true } } },
  });
  await clearTempHpDialog(actor);
  expect(actor.update).toHaveBeenCalledWith({ "system.attributes.hp.temp": 0 });

  const denied = setup();
  denied.isOwner = false;
  await clearTempHpDialog(denied);
  expect(denied.update).not.toHaveBeenCalled();

  const stale = setup();
  (stale.system.attributes as { hp: { temp: number } }).hp.temp = -1;
  vi.stubGlobal("ui", { notifications: { warn: vi.fn() } });
  await clearTempHpDialog(stale);
  expect(stale.update).not.toHaveBeenCalled();
});
