import { expect, it, vi } from "vitest";
import { initializeSurvival } from "../../src/migrations/m002";
it("initializes an unset character at full hit points and leaves a real zero-HP character dying", () => {
  const updateSource = vi.fn();
  initializeSurvival({
    type: "character",
    system: { survivalVersion: 0, attributes: { hp: { value: 10, max: 10 } } },
    updateSource,
  });
  expect(updateSource).toHaveBeenCalledWith({
    "system.survivalVersion": 1,
    "system.attributes.deathSaves.status": "alive",
  });
  updateSource.mockClear();
  initializeSurvival({
    type: "character",
    system: {
      survivalVersion: 0,
      abilities: { con: { score: 10 } },
      attributes: { hitDie: "d8", hp: { value: 0, max: 0 } },
    },
    updateSource,
  });
  expect(updateSource).toHaveBeenCalledWith({
    "system.survivalVersion": 1,
    "system.attributes.hp.value": 8,
    "system.attributes.hp.max": 8,
    "system.attributes.deathSaves.status": "alive",
  });
  updateSource.mockClear();
  initializeSurvival({
    type: "character",
    system: { survivalVersion: 0, attributes: { hp: { value: 0, max: 16 } } },
    updateSource,
  });
  expect(updateSource).toHaveBeenCalledWith({
    "system.survivalVersion": 1,
    "system.attributes.deathSaves.status": "dying",
  });
});
