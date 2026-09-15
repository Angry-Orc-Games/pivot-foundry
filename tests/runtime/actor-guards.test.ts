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
