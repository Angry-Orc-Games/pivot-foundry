import { afterEach, expect, it, vi } from "vitest";
import { deathSaveDialog } from "../../src/runtime/death-saves";
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
