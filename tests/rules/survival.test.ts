import { describe, expect, it } from "vitest";
import {
  applyHealth,
  correctSurvival,
  effectiveSurvival,
  resolveDeathSave,
  type SurvivalState,
} from "../../src/rules/survival";
const state = (patch: Partial<SurvivalState> = {}): SurvivalState => ({
  hp: 10,
  max: 20,
  temp: 5,
  successes: 0,
  failures: 0,
  status: "alive",
  ...patch,
});
describe("HP and survival", () => {
  it("uses temp before HP and preserves source", () => {
    const s = state();
    expect(applyHealth(s, "damage", 8)).toMatchObject({ temp: 0, hp: 7 });
    expect(s.hp).toBe(10);
  });
  it("kills on massive damage after temp absorption", () => {
    expect(applyHealth(state(), "damage", 35).status).toBe("dead");
    expect(applyHealth(state(), "damage", 34).status).toBe("dying");
  });
  it("counts critical damage at zero even when temp absorbs it", () => {
    expect(applyHealth(state({ hp: 0, status: "stable" }), "damage", 1, true)).toMatchObject({
      status: "dying",
      failures: 2,
      temp: 4,
    });
  });
  it("caps healing and resets saves but never resurrects", () => {
    expect(
      applyHealth(state({ hp: 0, status: "stable", failures: 2 }), "healing", 30),
    ).toMatchObject({ hp: 20, status: "alive", failures: 0, temp: 5 });
    expect(() => applyHealth(state({ hp: 0, status: "dead" }), "healing", 5)).toThrow();
  });
  it("requires explicit temp replacement and never stabilizes", () => {
    expect(applyHealth(state({ hp: 0, status: "dying" }), "temp", 9, false, "keep")).toMatchObject({
      hp: 0,
      temp: 5,
      status: "dying",
    });
    expect(applyHealth(state(), "temp", 9, false, "replace").temp).toBe(9);
    expect(() => applyHealth(state(), "temp", 9)).toThrow();
  });
  it("rejects invalid quantities and unconfirmed legacy state", () => {
    expect(() => applyHealth(state(), "damage", NaN)).toThrow();
    expect(() => applyHealth(state({ status: "unconfirmed" }), "damage", 3)).toThrow();
  });
  it("resolves natural 1, natural 20, stability and death", () => {
    expect(resolveDeathSave(state({ hp: 0, status: "dying" }), 1).failures).toBe(2);
    expect(resolveDeathSave(state({ hp: 0, status: "dying", failures: 2 }), 20)).toMatchObject({
      hp: 1,
      status: "alive",
      failures: 0,
    });
    expect(resolveDeathSave(state({ hp: 0, status: "dying", successes: 2 }), 10)).toMatchObject({
      status: "stable",
      successes: 0,
      failures: 0,
    });
    expect(resolveDeathSave(state({ hp: 0, status: "dying", failures: 2 }), 9).status).toBe("dead");
  });
  it("blocks death saves while stable dead or conscious", () => {
    for (const status of ["stable", "dead", "alive"] as const)
      expect(() => resolveDeathSave(state({ status }), 10)).toThrow();
  });
  it("applies damage when HP was raised without clearing dying", () => {
    expect(applyHealth(state({ hp: 10, temp: 0, status: "dying" }), "damage", 3)).toMatchObject({
      hp: 7,
      status: "alive",
      successes: 0,
      failures: 0,
    });
  });
  it("lets a death save resolve once that character is damaged to 0 HP", () => {
    const down = applyHealth(state({ hp: 10, temp: 0, status: "dying" }), "damage", 10);
    expect(down).toMatchObject({ hp: 0, status: "dying", successes: 0, failures: 0 });
    expect(resolveDeathSave(down, 9)).toMatchObject({ hp: 0, status: "dying", failures: 1 });
  });
  it("records a death save at 0 HP when status is still alive", () => {
    expect(resolveDeathSave(state({ hp: 0, temp: 0, status: "alive" }), 9)).toMatchObject({
      hp: 0,
      status: "dying",
      failures: 1,
    });
  });
});
it("preserves accumulated successes on damage while dying", () => {
  expect(applyHealth(state({ hp: 0, status: "dying", successes: 2 }), "damage", 1).successes).toBe(
    2,
  );
});
it("grants first temporary HP even with keep selected", () => {
  expect(applyHealth(state({ temp: 0 }), "temp", 5, false, "keep").temp).toBe(5);
});

it("shows Conscious at full HP when Dying is stale, and does not add Exhaustion", () => {
  const stored = state({ hp: 20, max: 20, status: "dying", successes: 2, failures: 1 });
  const shown = effectiveSurvival(stored);
  expect(shown).toEqual({
    hp: 20,
    max: 20,
    temp: 5,
    successes: 0,
    failures: 0,
    status: "alive",
  });
  expect(shown).not.toHaveProperty("exhaustion");
  expect(stored).toMatchObject({ status: "dying", successes: 2, failures: 1 });
});

it("keeps a real Dying character at 0 HP, and Dead at full HP", () => {
  expect(effectiveSurvival(state({ hp: 0, max: 20, status: "dying", failures: 1 }))).toMatchObject({
    status: "dying",
    failures: 1,
  });
  expect(effectiveSurvival(state({ hp: 20, max: 20, status: "dead" })).status).toBe("dead");
  expect(effectiveSurvival(state({ hp: 8, max: 16, status: "stable" })).status).toBe("alive");
});

it("treats a Conscious Character at 0 HP as Dying with cleared counters", () => {
  expect(effectiveSurvival(state({ hp: 0, max: 20, status: "alive", failures: 2 }))).toMatchObject({
    status: "dying",
    successes: 0,
    failures: 0,
  });
  expect(effectiveSurvival(state({ hp: 0, max: 0, status: "alive" })).status).toBe("alive");
  expect(effectiveSurvival(state({ hp: 0, max: 20, status: "unconfirmed" })).status).toBe(
    "unconfirmed",
  );
});

describe("Survival correction", () => {
  const requested = { hp: 0, temp: 0, successes: 1, failures: 2, status: "dying" as const };

  it("sets the requested state and keeps max HP", () => {
    expect(correctSurvival({ current: state(), requested })).toEqual({ max: 20, ...requested });
  });

  it("clears counters when the GM stabilizes or restores HP", () => {
    expect(
      correctSurvival({ current: state(), requested: { ...requested, status: "stable" } }),
    ).toMatchObject({ status: "stable", successes: 0, failures: 0 });
    expect(
      correctSurvival({
        current: state(),
        requested: { ...requested, hp: 4, status: "alive" },
      }),
    ).toMatchObject({ hp: 4, successes: 0, failures: 0 });
  });

  it("confirms a legacy Unconfirmed Character", () => {
    expect(
      correctSurvival({
        current: state({ hp: 0, status: "unconfirmed" }),
        requested: { ...requested, status: "stable" },
      }).status,
    ).toBe("stable");
  });

  it("rejects Unconfirmed, inconsistent, and out-of-range corrections", () => {
    expect(() =>
      correctSurvival({ current: state(), requested: { ...requested, status: "unconfirmed" } }),
    ).toThrow(RangeError);
    expect(() =>
      correctSurvival({ current: state(), requested: { ...requested, hp: 5, status: "dying" } }),
    ).toThrow(RangeError);
    expect(() =>
      correctSurvival({ current: state(), requested: { ...requested, hp: 21, status: "alive" } }),
    ).toThrow(RangeError);
    expect(() =>
      correctSurvival({ current: state(), requested: { ...requested, failures: 4 } }),
    ).toThrow(RangeError);
  });
});
