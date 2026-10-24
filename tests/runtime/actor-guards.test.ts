import { afterEach, expect, it } from "vitest";
import { guardHpMaximum } from "../../src/runtime/actor-guards";

const warnings: string[] = [];

afterEach(() => {
  warnings.length = 0;
  delete (globalThis as { ui?: unknown }).ui;
});

it("drops a blank or too-small HP max and keeps the rest of the submit", () => {
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
  expect(nested).toEqual({ name: "Hera", system: { progression: { level: 5 } } });
  expect(guardHpMaximum(actor, blank)).toBeUndefined();
  expect(blank).toEqual({ name: "Hera", "system.progression.level": 5 });
  expect(warnings).toEqual(["InvalidMaximum", "InvalidMaximum"]);
});

it("drops a grouped HP max and a -=max deletion, and re-renders when that was the only change", () => {
  (globalThis as { ui?: unknown }).ui = {
    notifications: { warn: (message: string) => warnings.push(message) },
  };
  const actor = {
    system: { attributes: { hp: { value: 30, max: 28 } } },
    sheet: { render: (force?: boolean) => warnings.push(`render:${String(force)}`) },
  };
  const grouped = {
    name: "Hera",
    "system.attributes.hp": { max: 10 },
  };
  const deleted = {
    name: "Hera",
    system: { attributes: { hp: { "-=max": null } } },
  };
  const onlyMax = { "system.attributes.hp.max": 10 };

  expect(guardHpMaximum(actor, grouped)).toBeUndefined();
  expect(grouped).toEqual({ name: "Hera" });
  expect(guardHpMaximum(actor, deleted)).toBeUndefined();
  expect(deleted).toEqual({ name: "Hera" });
  expect(guardHpMaximum(actor, onlyMax)).toBeUndefined();
  expect(onlyMax).toEqual({});
  expect(warnings).toEqual(["InvalidMaximum", "InvalidMaximum", "InvalidMaximum", "render:false"]);
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
