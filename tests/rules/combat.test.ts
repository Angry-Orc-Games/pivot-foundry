import { describe, expect, it } from "vitest";

import { resolveActiveCombat, selectInitiativeCombatant } from "../../src/rules/combat";

describe("selectInitiativeCombatant", () => {
  const combatants = [
    { id: "c1", actorId: "hero" },
    { id: "c2", actorId: "other" },
    { id: "c3", actorId: null },
  ];

  it("selects the unique matching combatant", () => {
    expect(selectInitiativeCombatant("hero", combatants)).toEqual({
      kind: "one",
      combatantId: "c1",
    });
  });

  it("returns none when no combatant matches", () => {
    expect(selectInitiativeCombatant("missing", combatants)).toEqual({ kind: "none" });
  });

  it("returns none for an empty actor id", () => {
    expect(selectInitiativeCombatant("", combatants)).toEqual({ kind: "none" });
  });

  it("ignores null and other actor ids", () => {
    expect(selectInitiativeCombatant("other", combatants)).toEqual({
      kind: "one",
      combatantId: "c2",
    });
  });

  it("returns ambiguous when more than one combatant matches", () => {
    expect(
      selectInitiativeCombatant("hero", [
        { id: "a", actorId: "hero" },
        { id: "b", actorId: "hero" },
      ]),
    ).toEqual({ kind: "ambiguous" });
  });
});

describe("resolveActiveCombat", () => {
  it("prefers combats.active over viewed game.combat", () => {
    const active = { id: "active-combat", active: true };
    const viewed = { id: "w4EanWvgyzXg1Etw", active: false };
    expect(
      resolveActiveCombat({
        combat: viewed,
        combats: { active, viewed, contents: [viewed, active] },
      }),
    ).toBe(active);
  });

  it("falls back to game.combat when no active encounter", () => {
    const viewed = { id: "only-viewed" };
    expect(resolveActiveCombat({ combat: viewed, combats: { viewed, contents: [viewed] } })).toBe(
      viewed,
    );
  });

  it("finds active flag in contents when combats.active is unset", () => {
    const inactive = { id: "old", active: false };
    const active = { id: "live", active: true };
    expect(
      resolveActiveCombat({
        combat: inactive,
        combats: { contents: [inactive, active] },
      }),
    ).toBe(active);
  });

  it("returns null when no combat state exists", () => {
    expect(resolveActiveCombat(null)).toBe(null);
    expect(resolveActiveCombat(undefined)).toBe(null);
    expect(resolveActiveCombat({})).toBe(null);
  });
});
