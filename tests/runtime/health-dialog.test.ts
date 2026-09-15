import { expect, it } from "vitest";
import { readDamagePayload } from "../../src/runtime/health-dialog";
it("requires complete validated message flags, rejecting DOM-like amounts and invalid payloads", () => {
  const valid = {
    version: 1,
    complete: true,
    amount: 8,
    kind: "damage",
    critical: false,
    actorUuid: "Actor.a",
  };
  const message = (payload: unknown) => ({ flags: { "pivot-fantasy": { survivalRoll: payload } } });
  expect(readDamagePayload(message(valid))?.amount).toBe(8);
  for (const patch of [
    { complete: false },
    { amount: "8" },
    { amount: -1 },
    { amount: Infinity },
    { kind: "arbitrary" },
    { version: 2 },
  ])
    expect(readDamagePayload(message({ ...valid, ...patch }))).toBeNull();
  expect(readDamagePayload({})).toBeNull();
});
