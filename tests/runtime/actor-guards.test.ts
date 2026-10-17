import { expect, it } from "vitest";
import { guardHpMaximum } from "../../src/runtime/actor-guards";
it("rejects max below current but permits simultaneous valid correction", () => {
  const actor = { system: { attributes: { hp: { value: 10, max: 20 } } } };
  expect(guardHpMaximum(actor, { "system.attributes.hp.max": 5 })).toBe(false);
  expect(
    guardHpMaximum(actor, { "system.attributes.hp.max": 5, "system.attributes.hp.value": 5 }),
  ).toBeUndefined();
  expect(guardHpMaximum(actor, { system: { attributes: { hp: { max: 11 } } } })).toBeUndefined();
});

it("clamps a current HP edit to the current maximum", () => {
  const actor = { system: { attributes: { hp: { value: 4, max: 10 } } } };
  const changes = { system: { attributes: { hp: { value: 25 } } } };
  expect(guardHpMaximum(actor, changes)).toBeUndefined();
  expect(changes.system.attributes.hp.value).toBe(10);
});

it("sets dying when a current HP edit reaches zero", () => {
  const actor = {
    system: {
      attributes: {
        hp: { value: 4, max: 10 },
        deathSaves: { status: "alive", successes: 1, failures: 2 },
      },
    },
  };
  const changes: {
    system: {
      attributes: {
        hp: { value: number };
        deathSaves?: { status?: string; successes?: number; failures?: number };
      };
    };
  } = { system: { attributes: { hp: { value: 0 } } } };
  expect(guardHpMaximum(actor, changes)).toBeUndefined();
  expect(changes.system.attributes.hp.value).toBe(0);
  expect(changes.system.attributes.deathSaves).toMatchObject({
    status: "dying",
    successes: 0,
    failures: 0,
  });
});

it("keeps a death status submitted with the HP change", () => {
  const actor = {
    system: {
      attributes: {
        hp: { value: 10, max: 10 },
        deathSaves: { status: "alive", successes: 0, failures: 0 },
      },
    },
  };
  const changes: Record<string, unknown> = {
    "system.attributes.hp.value": 0,
    "system.attributes.deathSaves.status": "dead",
    "system.attributes.deathSaves.failures": 3,
  };
  expect(guardHpMaximum(actor, changes)).toBeUndefined();
  expect(changes["system.attributes.deathSaves.status"]).toBe("dead");
  expect(changes["system.attributes.deathSaves.failures"]).toBe(3);
});

it("sets alive when a current HP edit rises above zero", () => {
  const actor = {
    system: {
      attributes: { hp: { value: 0, max: 10 }, deathSaves: { status: "dead" } },
    },
  };
  const changes: Record<string, unknown> = { "system.attributes.hp.value": 3 };
  expect(guardHpMaximum(actor, changes)).toBeUndefined();
  expect(changes["system.attributes.deathSaves.status"]).toBe("alive");
  expect(changes["system.attributes.deathSaves.successes"]).toBe(0);
  expect(changes["system.attributes.deathSaves.failures"]).toBe(0);
});
