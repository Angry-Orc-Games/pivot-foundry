import { expect, it, vi, afterEach } from "vitest";
import {
  readDamagePayload,
  messagePayloadUnchanged,
  targetPreviewRow,
} from "../../src/runtime/health-dialog";
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

afterEach(() => vi.unstubAllGlobals());
it("rejects edited or deleted source messages after preview", () => {
  const payload = {
    version: 1 as const,
    complete: true as const,
    amount: 4,
    kind: "damage" as const,
    critical: false,
    actorUuid: "Actor.a",
  };
  let current: unknown = { flags: { "pivot-fantasy": { survivalRoll: payload } } };
  vi.stubGlobal("game", { messages: { get: () => current } });
  expect(messagePayloadUnchanged("m", payload)).toBe(true);
  current = { flags: { "pivot-fantasy": { survivalRoll: { ...payload, amount: 99 } } } };
  expect(messagePayloadUnchanged("m", payload)).toBe(false);
  current = undefined;
  expect(messagePayloadUnchanged("m", payload)).toBe(false);
});

it("never reads or displays unowned target stats", () => {
  const row = targetPreviewRow(
    {
      name: "Enemy",
      type: "character",
      isOwner: false,
      get system(): Record<string, unknown> {
        throw Error("private");
      },
    },
    0,
    false,
  );
  expect(row).toContain("Enemy");
  expect(row).toContain("disabled");
  expect(row).not.toContain("HP");
});
it("snapshots primitive flags so in-place edits invalidate a pending preview", () => {
  const payload = {
    version: 1,
    complete: true,
    amount: 4,
    kind: "damage",
    critical: false,
    actorUuid: "Actor.a",
  };
  const message = { flags: { "pivot-fantasy": { survivalRoll: payload } } };
  const snapshot = readDamagePayload(message);
  if (!snapshot) throw Error("Expected valid payload");
  vi.stubGlobal("game", { messages: { get: () => message } });
  payload.amount = 99;
  expect(snapshot.amount).toBe(4);
  expect(messagePayloadUnchanged("m", snapshot)).toBe(false);
});
