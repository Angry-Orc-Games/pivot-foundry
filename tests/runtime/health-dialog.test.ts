import { expect, it, vi, afterEach } from "vitest";
import {
  HealthApplications,
  healthTargetLabel,
  messagePayloadUnchanged,
  readDamagePayload,
  targetPreviewRow,
  uniqueHealthTargets,
} from "../../src/runtime/health-dialog";
import { readSurvival } from "../../src/runtime/survival-transaction";
import { inMemoryCharacter } from "../helpers/in-memory-actor";
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

it("does not label a full-HP character as Dying in the damage target list", () => {
  const row = targetPreviewRow(
    {
      name: "Hera",
      type: "character",
      isOwner: true,
      system: {
        attributes: {
          hp: { value: 10, max: 10, temp: 0 },
          deathSaves: { status: "dying", successes: 2, failures: 1 },
        },
      },
    },
    0,
    true,
  );
  expect(row).toContain("HP 10/10");
  expect(row).toContain("(alive)");
  expect(row).not.toContain("dying");
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

const actor = (uuid: string) => inMemoryCharacter({ hp: 10, temp: 2 }, { uuid });

it("deduplicates linked actor UUIDs but retains synthetic token actors", () => {
  const a = actor("Actor.a");
  expect(
    uniqueHealthTargets([a, a, actor("Scene.s.Token.t.Actor.a"), actor("Scene.s.Token.u.Actor.a")]),
  ).toHaveLength(3);
});

it("checks ownership and continues after uncertain failures without retry", async () => {
  const a = actor("Actor.a"),
    b = actor("Actor.b"),
    c = actor("Actor.c");
  b.isOwner = false;
  vi.spyOn(c, "update").mockRejectedValue(new Error("network"));
  const tx = new HealthApplications();
  expect((await tx.apply("op", [a, b, c], "damage", 5)).map((x) => x.outcome)).toEqual([
    "updated",
    "denied",
    "failed",
  ]);
  expect((await tx.apply("op", [a, c], "damage", 5)).map((x) => x.outcome)).toEqual([
    "duplicate",
    "duplicate",
  ]);
  expect(readSurvival(a)).toMatchObject({ hp: 7, temp: 0 });
});

it("lets a rejected rule be applied again once it can succeed", async () => {
  const a = inMemoryCharacter({ hp: 10, temp: 2 }, { uuid: "Actor.temp" });
  const tx = new HealthApplications();
  expect((await tx.apply("temp", [a], "temp", 4))[0]?.outcome).toBe("failed");
  expect((await tx.apply("temp", [a], "temp", 4, false, "replace"))[0]?.outcome).toBe("updated");
  expect(readSurvival(a).temp).toBe(4);
});

it("blocks overlapping applications before asynchronous update returns", async () => {
  const a = actor("Actor.overlap");
  const write = a.update.bind(a);
  let release: () => void = () => {};
  const update = vi.spyOn(a, "update").mockImplementation(async (data, options) => {
    await new Promise<void>((resolve) => (release = resolve));
    return write(data, options);
  });
  const tx = new HealthApplications();
  const first = tx.apply("same", [a], "damage", 1);
  expect((await tx.apply("same", [a], "damage", 1))[0]?.outcome).toBe("duplicate");
  expect((await tx.apply("other", [a], "damage", 1))[0]?.outcome).toBe("duplicate");
  release();
  await first;
  expect(update).toHaveBeenCalledTimes(1);
  expect(readSurvival(a).hp).toBe(10);
  expect(readSurvival(a).temp).toBe(1);
});

it("revalidates the message immediately before each target write", async () => {
  const a = actor("Actor.lifecycle-a"),
    b = actor("Actor.lifecycle-b");
  let valid = true;
  const write = a.update.bind(a);
  vi.spyOn(a, "update").mockImplementation(async (data, options) => {
    valid = false;
    return write(data, options);
  });
  const results = await new HealthApplications().apply(
    "lifecycle",
    [a, b],
    "damage",
    1,
    false,
    undefined,
    () => valid,
  );
  expect(results.map((r) => r.outcome)).toEqual(["updated", "denied"]);
  expect(b.writes).toEqual([]);
});

it("labels synthetic tokens distinctly while preserving actor-only names", () => {
  const base = { ...actor("Actor.a"), name: "Hero" };
  expect(healthTargetLabel(base)).toBe("Hero");
  expect(healthTargetLabel({ ...base, token: { name: "Hero" } })).toBe("Hero");
  expect(healthTargetLabel({ ...base, token: { name: "Hero Unlinked Zero" } })).toBe(
    "Hero Unlinked Zero (Hero)",
  );
});
