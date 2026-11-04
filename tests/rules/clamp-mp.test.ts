import { describe, expect, it } from "vitest";

import { clampMp } from "../../src/rules/resources";

describe("clampMp", () => {
  it("clamps a value above max down to max", () => {
    expect(clampMp(12, 8)).toBe(8);
  });

  it("clamps a negative value up to 0", () => {
    expect(clampMp(-3, 8)).toBe(0);
  });

  it("leaves a value inside the range unchanged", () => {
    expect(clampMp(4, 8)).toBe(4);
    expect(clampMp(0, 8)).toBe(0);
    expect(clampMp(8, 8)).toBe(8);
  });

  it("clamps to 0 when max is 0", () => {
    expect(clampMp(2, 0)).toBe(0);
  });
});
