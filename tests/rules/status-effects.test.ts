import { describe, it, expect } from "vitest";
import {
  deriveStatusEffects,
  FOUNDRY_STATUS_UNCONSCIOUS,
  FOUNDRY_STATUS_DEAD,
} from "../../src/runtime/status-effects";
import type { SurvivalStatus } from "../../src/rules/survival";

const effects = (hp: number, status: SurvivalStatus, max = 20) =>
  deriveStatusEffects({ hp, max, temp: 0, successes: 0, failures: 0, status });

describe("deriveStatusEffects", () => {
  it("returns Dead status when status is dead", () => {
    expect(effects(0, "dead")).toEqual([FOUNDRY_STATUS_DEAD]);
    expect(effects(5, "dead")).toEqual([FOUNDRY_STATUS_DEAD]);
  });

  it("returns Unconscious status when at 0 HP and dying", () => {
    expect(effects(0, "dying")).toEqual([FOUNDRY_STATUS_UNCONSCIOUS]);
  });

  it("returns Unconscious status when at 0 HP and stable", () => {
    expect(effects(0, "stable")).toEqual([FOUNDRY_STATUS_UNCONSCIOUS]);
  });

  it("returns no status when conscious (HP > 0)", () => {
    expect(effects(1, "alive")).toEqual([]);
    expect(effects(10, "alive")).toEqual([]);
  });

  it("returns no status when in unconfirmed state", () => {
    expect(effects(0, "unconfirmed")).toEqual([]);
    expect(effects(5, "unconfirmed")).toEqual([]);
  });

  it("prefers Dead over Unconscious when status is dead", () => {
    const result = effects(0, "dead");
    expect(result).toContain(FOUNDRY_STATUS_DEAD);
    expect(result).not.toContain(FOUNDRY_STATUS_UNCONSCIOUS);
  });

  it("shows no icon for a stale Dying or Stable status above 0 HP", () => {
    expect(effects(5, "dying")).toEqual([]);
    expect(effects(5, "stable")).toEqual([]);
  });

  it("shows Unconscious for a Conscious Character at 0 HP, which is effectively Dying", () => {
    expect(effects(0, "alive")).toEqual([FOUNDRY_STATUS_UNCONSCIOUS]);
  });

  it("shows no icon at 0 HP before a maximum HP is set", () => {
    expect(effects(0, "alive", 0)).toEqual([]);
  });
});
