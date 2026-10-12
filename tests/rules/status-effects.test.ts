import { describe, it, expect } from "vitest";
import {
  deriveStatusEffects,
  FOUNDRY_STATUS_UNCONSCIOUS,
  FOUNDRY_STATUS_DEAD,
} from "../../src/runtime/status-effects";
import type { SurvivalStatus } from "../../src/rules/survival";

describe("deriveStatusEffects", () => {
  it("returns Dead status when status is dead", () => {
    expect(deriveStatusEffects(0, "dead")).toEqual([FOUNDRY_STATUS_DEAD]);
    expect(deriveStatusEffects(5, "dead")).toEqual([FOUNDRY_STATUS_DEAD]);
  });

  it("returns Unconscious status when at 0 HP and dying", () => {
    expect(deriveStatusEffects(0, "dying")).toEqual([FOUNDRY_STATUS_UNCONSCIOUS]);
  });

  it("returns Unconscious status when at 0 HP and stable", () => {
    expect(deriveStatusEffects(0, "stable")).toEqual([FOUNDRY_STATUS_UNCONSCIOUS]);
  });

  it("returns no status when conscious (HP > 0)", () => {
    expect(deriveStatusEffects(1, "alive")).toEqual([]);
    expect(deriveStatusEffects(10, "alive")).toEqual([]);
  });

  it("returns no status when in unconfirmed state", () => {
    expect(deriveStatusEffects(0, "unconfirmed")).toEqual([]);
    expect(deriveStatusEffects(5, "unconfirmed")).toEqual([]);
  });

  it("prefers Dead over Unconscious when status is dead", () => {
    const result = deriveStatusEffects(0, "dead");
    expect(result).toContain(FOUNDRY_STATUS_DEAD);
    expect(result).not.toContain(FOUNDRY_STATUS_UNCONSCIOUS);
  });

  it("handles edge case of positive HP with dying status (inconsistent state)", () => {
    // This is an inconsistent state, but the function should be defensive
    expect(deriveStatusEffects(5, "dying" as SurvivalStatus)).toEqual([]);
  });

  it("handles edge case of positive HP with stable status (inconsistent state)", () => {
    expect(deriveStatusEffects(5, "stable" as SurvivalStatus)).toEqual([]);
  });

  it("returns empty array for alive status regardless of HP", () => {
    expect(deriveStatusEffects(0, "alive")).toEqual([]);
    expect(deriveStatusEffects(10, "alive")).toEqual([]);
  });
});
