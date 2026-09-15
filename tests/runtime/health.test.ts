import { expect, it, vi } from "vitest";
import {
  HealthTransactions,
  uniqueHealthTargets,
  type HealthActor,
} from "../../src/runtime/health";
const actor = (uuid: string): HealthActor => ({
  uuid,
  name: uuid,
  type: "character",
  isOwner: true,
  system: {
    attributes: {
      hp: { value: 10, max: 20, temp: 2 },
      deathSaves: { status: "alive", successes: 0, failures: 0 },
    },
  },
  update: vi.fn(async () => {}),
});
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
  c.update = vi.fn(async () => {
    throw Error("network");
  });
  const tx = new HealthTransactions();
  expect((await tx.apply("op", [a, b, c], "damage", 5)).map((x) => x.outcome)).toEqual([
    "updated",
    "denied",
    "failed",
  ]);
  expect((await tx.apply("op", [a, c], "damage", 5)).map((x) => x.outcome)).toEqual([
    "duplicate",
    "duplicate",
  ]);
  expect(a.update).toHaveBeenCalledWith(
    expect.objectContaining({ "system.attributes.hp.value": 7, "system.attributes.hp.temp": 0 }),
  );
});
it("blocks overlapping applications before asynchronous update returns", async () => {
  const a = actor("Actor.a");
  let release: () => void = () => {};
  a.update = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const tx = new HealthTransactions();
  const first = tx.apply("same", [a], "damage", 1);
  expect((await tx.apply("same", [a], "damage", 1))[0]?.outcome).toBe("duplicate");
  release();
  await first;
  expect(a.update).toHaveBeenCalledTimes(1);
});
