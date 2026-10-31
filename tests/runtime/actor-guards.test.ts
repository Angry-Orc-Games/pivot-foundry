import { afterEach, expect, it } from "vitest";
import { guardCharacterHpWrite, guardHpMaximum } from "../../src/runtime/actor-guards";

const warnings: string[] = [];

afterEach(() => {
  warnings.length = 0;
  delete (globalThis as { ui?: unknown }).ui;
});

it("drops a blank HP max and clamps current HP when the submitted max is lower", () => {
  (globalThis as { ui?: unknown }).ui = {
    notifications: { warn: (message: string) => warnings.push(message) },
  };
  const actor = { system: { attributes: { hp: { value: 30, max: 28 } } } };
  const nested = {
    name: "Hera",
    system: { progression: { level: 5 }, attributes: { hp: { max: 20 } } },
  };
  const blank = {
    name: "Hera",
    "system.attributes.hp.max": null,
    "system.progression.level": 5,
  };

  expect(guardHpMaximum(actor, nested)).toBeUndefined();
  expect(nested).toEqual({
    name: "Hera",
    system: { progression: { level: 5 }, attributes: { hp: { max: 20, value: 20 } } },
  });
  expect(guardHpMaximum(actor, blank)).toBeUndefined();
  expect(blank).toEqual({ name: "Hera", "system.progression.level": 5 });
  expect(warnings).toEqual(["InvalidMaximum"]);
});

it("clamps a grouped or flat max that is below current HP, and drops a -=max deletion", () => {
  (globalThis as { ui?: unknown }).ui = {
    notifications: { warn: (message: string) => warnings.push(message) },
  };
  const actor = {
    system: { attributes: { hp: { value: 30, max: 28 } } },
    sheet: { render: (force?: boolean) => warnings.push(`render:${String(force)}`) },
  };
  const grouped = {
    _id: "actor1",
    name: "Hera",
    "system.attributes.hp": { max: 10 },
  };
  const deleted = {
    name: "Hera",
    system: { attributes: { hp: { "-=max": null } } },
  };
  const onlyMax = { "system.attributes.hp.max": 10 };

  expect(guardHpMaximum(actor, grouped)).toBeUndefined();
  expect(grouped).toEqual({
    _id: "actor1",
    name: "Hera",
    "system.attributes.hp": { max: 10, value: 10 },
  });
  expect(guardHpMaximum(actor, deleted)).toBeUndefined();
  expect(deleted).toEqual({ name: "Hera" });
  expect(guardHpMaximum(actor, onlyMax)).toBeUndefined();
  expect(onlyMax).toEqual({
    "system.attributes.hp.max": 10,
    "system.attributes.hp.value": 10,
  });
  expect(warnings).toEqual(["InvalidMaximum"]);
});

it("re-renders when _id is all that remains after a bad max", () => {
  (globalThis as { ui?: unknown }).ui = {
    notifications: { warn: (message: string) => warnings.push(message) },
  };
  const actor = {
    system: { attributes: { hp: { value: 30, max: 28 } } },
    sheet: { render: (force?: boolean) => warnings.push(`render:${String(force)}`) },
  };
  const changes = {
    _id: "actor1",
    system: { attributes: { hp: { max: null } } },
  };

  expect(guardHpMaximum(actor, changes)).toBeUndefined();
  expect(changes).toEqual({ _id: "actor1" });
  expect(warnings).toEqual(["InvalidMaximum", "render:false"]);
});

it("re-renders when a bad max leaves only _id and empty objects", () => {
  (globalThis as { ui?: unknown }).ui = {
    notifications: { warn: (message: string) => warnings.push(message) },
  };
  const actor = {
    system: { attributes: { hp: { value: 30, max: 28 } } },
    sheet: { render: (force?: boolean) => warnings.push(`render:${String(force)}`) },
  };
  const changes = {
    _id: "actor1",
    system: { attributes: { hp: { max: null } }, spare: {} },
  };

  expect(guardHpMaximum(actor, changes)).toBeUndefined();
  expect(warnings).toEqual(["InvalidMaximum", "render:false"]);
});

it("keeps a max that is at least the HP in the same update", () => {
  (globalThis as { ui?: unknown }).ui = {
    notifications: { warn: (message: string) => warnings.push(message) },
  };
  const actor = { system: { attributes: { hp: { value: 10, max: 20 } } } };
  const corrected = { "system.attributes.hp.max": 5, "system.attributes.hp.value": 5 };
  const raised = { system: { attributes: { hp: { max: 11 } } } };

  expect(guardHpMaximum(actor, corrected)).toBeUndefined();
  expect(corrected).toEqual({ "system.attributes.hp.max": 5, "system.attributes.hp.value": 5 });
  expect(guardHpMaximum(actor, raised)).toBeUndefined();
  expect(raised).toEqual({ system: { attributes: { hp: { max: 11 } } } });
  expect(warnings).toEqual([]);
});
it("rejects Character survival writes that are not Survival transactions", () => {
  const actor = {
    type: "character",
    system: {
      attributes: {
        hp: { value: 0, max: 20, temp: 0 },
        deathSaves: { status: "dying", successes: 0, failures: 0 },
      },
    },
  };
  expect(guardCharacterHpWrite(actor, { "system.attributes.hp.value": 5 })).toBe(false);
  expect(guardCharacterHpWrite(actor, { system: { attributes: { hp: { value: 5 } } } })).toBe(
    false,
  );
  expect(guardCharacterHpWrite(actor, { "system.attributes.hp": { value: 5 } })).toBe(false);
  expect(guardCharacterHpWrite(actor, { "system.attributes.hp.temp": 3 })).toBe(false);
  expect(
    guardCharacterHpWrite(actor, { "system.attributes.deathSaves": { status: "stable" } }),
  ).toBe(false);
  expect(
    guardCharacterHpWrite(actor, {
      "system.attributes.hp.value": 5,
      "system.attributes.deathSaves.status": "alive",
    }),
  ).toBe(false);
});

it("allows marked writes, unchanged values, max edits, and NPCs", () => {
  const actor = {
    type: "character",
    system: { attributes: { hp: { value: 0, max: 20 }, deathSaves: { status: "dying" } } },
  };
  const marked = { "pivot-fantasy": { survivalWrite: true } };
  expect(guardCharacterHpWrite(actor, { "system.attributes.hp.value": 5 }, marked)).toBeUndefined();
  expect(guardCharacterHpWrite(actor, { "system.attributes.hp.value": 0 })).toBeUndefined();
  expect(guardCharacterHpWrite(actor, { "system.attributes.hp.max": 30 })).toBeUndefined();
  expect(guardCharacterHpWrite(actor, { name: "Hera" })).toBeUndefined();
  expect(
    guardCharacterHpWrite({ ...actor, type: "npc" }, { "system.attributes.hp.value": 5 }),
  ).toBeUndefined();
});

it("lets a lowered Character max clamp HP through both guards", () => {
  const actor = {
    type: "character",
    system: {
      attributes: { hp: { value: 12, max: 20 }, deathSaves: { status: "alive" } },
    },
  };
  const lowered = { "system.attributes.hp.max": 8 };
  expect(guardHpMaximum(actor, lowered)).toBeUndefined();
  expect(guardCharacterHpWrite(actor, lowered)).toBeUndefined();
  expect(lowered).toEqual({ "system.attributes.hp.max": 8, "system.attributes.hp.value": 8 });

  const raised = { "system.attributes.hp.max": 8, "system.attributes.hp.value": 4 };
  expect(guardHpMaximum(actor, raised)).toBeUndefined();
  expect(guardCharacterHpWrite(actor, raised)).toBe(false);
});

it("stores the max when a flat, nested, or grouped value is set above it", () => {
  const actor = { system: { attributes: { hp: { value: 10, max: 20 } } } };
  const flat = { "system.attributes.hp.value": 50 };
  const nested = { system: { attributes: { hp: { value: 50 } } } };
  const grouped = { "system.attributes.hp": { value: 50 } };
  const withMax = { "system.attributes.hp.value": 50, "system.attributes.hp.max": 40 };

  expect(guardHpMaximum(actor, flat)).toBeUndefined();
  expect(flat).toEqual({ "system.attributes.hp.value": 20 });
  expect(guardHpMaximum(actor, nested)).toBeUndefined();
  expect(nested).toEqual({ system: { attributes: { hp: { value: 20 } } } });
  expect(guardHpMaximum(actor, grouped)).toBeUndefined();
  expect(grouped).toEqual({ "system.attributes.hp": { value: 20 } });
  expect(guardHpMaximum(actor, withMax)).toBeUndefined();
  expect(withMax).toEqual({ "system.attributes.hp.value": 40, "system.attributes.hp.max": 40 });
});

it("leaves a value at or below the resulting max unchanged", () => {
  const actor = { system: { attributes: { hp: { value: 10, max: 20 } } } };
  const atMax = { "system.attributes.hp.value": 20 };
  const below = { system: { attributes: { hp: { value: 0 } } } };
  const grouped = { "system.attributes.hp": { value: 15, temp: 2 } };
  const raisedMax = { "system.attributes.hp.max": 25, name: "Hera" };

  expect(guardHpMaximum(actor, atMax)).toBeUndefined();
  expect(atMax).toEqual({ "system.attributes.hp.value": 20 });
  expect(guardHpMaximum(actor, below)).toBeUndefined();
  expect(below).toEqual({ system: { attributes: { hp: { value: 0 } } } });
  expect(guardHpMaximum(actor, grouped)).toBeUndefined();
  expect(grouped).toEqual({ "system.attributes.hp": { value: 15, temp: 2 } });
  expect(guardHpMaximum(actor, raisedMax)).toBeUndefined();
  expect(raisedMax).toEqual({ "system.attributes.hp.max": 25, name: "Hera" });
});

it("clamps an unlinked token actor for flat, nested, and grouped updates", () => {
  const tokenActor = {
    token: { actorLink: false },
    system: { attributes: { hp: { value: 12, max: 20, temp: 0 } } },
  };
  const flat = { "system.attributes.hp.value": 40 };
  const nested = { system: { attributes: { hp: { value: 40 } } } };
  const grouped = { "system.attributes.hp": { value: 40 } };
  const lowerMax = { "system.attributes.hp.max": 8 };

  expect(guardHpMaximum(tokenActor, flat)).toBeUndefined();
  expect(flat).toEqual({ "system.attributes.hp.value": 20 });
  expect(guardHpMaximum(tokenActor, nested)).toBeUndefined();
  expect(nested).toEqual({ system: { attributes: { hp: { value: 20 } } } });
  expect(guardHpMaximum(tokenActor, grouped)).toBeUndefined();
  expect(grouped).toEqual({ "system.attributes.hp": { value: 20 } });
  expect(guardHpMaximum(tokenActor, lowerMax)).toBeUndefined();
  expect(lowerMax).toEqual({
    "system.attributes.hp.max": 8,
    "system.attributes.hp.value": 8,
  });
});

it("does not write death-save status when HP is 0 or clamped", () => {
  const dying = {
    system: {
      attributes: {
        hp: { value: 0, max: 20, temp: 0 },
        deathSaves: { status: "dying", successes: 1, failures: 0 },
      },
    },
  };
  const stable = {
    system: {
      attributes: {
        hp: { value: 0, max: 20, temp: 0 },
        deathSaves: { status: "stable", successes: 0, failures: 0 },
      },
    },
  };
  const wounded = {
    system: {
      attributes: {
        hp: { value: 5, max: 20, temp: 0 },
        deathSaves: { status: "dying", successes: 1, failures: 0 },
      },
    },
  };
  const stayDying = { "system.attributes.hp.value": 0 };
  const stayStable = { system: { attributes: { hp: { value: 0 } } } };
  const clamped = { "system.attributes.hp.value": 50 };
  const dropped = { system: { attributes: { hp: { max: 0 } } } };

  expect(guardHpMaximum(dying, stayDying)).toBeUndefined();
  expect(stayDying).toEqual({ "system.attributes.hp.value": 0 });
  expect(guardHpMaximum(stable, stayStable)).toBeUndefined();
  expect(stayStable).toEqual({ system: { attributes: { hp: { value: 0 } } } });
  expect(guardHpMaximum(dying, clamped)).toBeUndefined();
  expect(clamped).toEqual({ "system.attributes.hp.value": 20 });
  expect(guardHpMaximum(wounded, dropped)).toBeUndefined();
  expect(dropped).toEqual({ system: { attributes: { hp: { max: 0, value: 0 } } } });
});
