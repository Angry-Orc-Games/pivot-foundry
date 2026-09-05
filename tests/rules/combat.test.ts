import { describe, expect, it } from "vitest";

import { selectInitiativeCombatant } from "../../src/rules/combat";

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
