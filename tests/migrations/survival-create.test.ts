import { expect, it, vi } from "vitest";
import { initializeSurvival } from "../../src/migrations/m002";
it("initializes fresh Characters without classifying legacy zero HP as new", () => {
  const updateSource = vi.fn();
  initializeSurvival({
    type: "character",
    system: { survivalVersion: 0, attributes: { hp: { value: 10 } } },
    updateSource,
  });
  expect(updateSource).toHaveBeenCalledWith({
    "system.survivalVersion": 1,
    "system.attributes.deathSaves.status": "alive",
  });
  updateSource.mockClear();
  initializeSurvival({ type: "character", system: { survivalVersion: 0 }, updateSource });
  expect(updateSource).toHaveBeenCalledWith({
    "system.survivalVersion": 1,
    "system.attributes.deathSaves.status": "dying",
  });
});
