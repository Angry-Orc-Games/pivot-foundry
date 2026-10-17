import { describe, expect, it } from "vitest";
import { applyHealth, resolveDeathSave, type SurvivalState } from "../../src/rules/survival";
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
});
it("preserves accumulated successes on damage while dying", () => {
  expect(applyHealth(state({ hp: 0, status: "dying", successes: 2 }), "damage", 1).successes).toBe(
    2,
  );
});
it("grants first temporary HP even with keep selected", () => {
  expect(applyHealth(state({ temp: 0 }), "temp", 5, false, "keep").temp).toBe(5);
});
