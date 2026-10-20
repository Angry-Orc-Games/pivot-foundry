import { expect, it } from "vitest";
import { startingHitPoints } from "../../src/rules/hit-points";

it("adds the hit die size to the Constitution modifier", () => {
  expect(startingHitPoints("d8", 10)).toBe(8);
  expect(startingHitPoints("d10", 14)).toBe(12);
  expect(startingHitPoints("d6", 8)).toBe(5);
});

it("stays at least 1 so an unset maximum of 0 is not reused", () => {
  expect(startingHitPoints("d4", 1)).toBe(1);
});

it("uses the default die and Constitution when the stats are missing", () => {
  expect(startingHitPoints("d20", Number.NaN)).toBe(8);
});
