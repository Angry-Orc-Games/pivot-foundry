import { afterEach, describe, expect, it, vi } from "vitest";
import { isSurvivalWrite } from "../../src/runtime/actor-guards";
import { readSurvival, runSurvivalTransaction } from "../../src/runtime/survival-transaction";
import { inMemoryCharacter } from "../helpers/in-memory-actor";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Survival transaction", () => {
  it("writes the next state and extra fields in one marked update", async () => {
    const actor = inMemoryCharacter({ hp: 10 }, { system: { magic: { mp: { value: 1 } } } });
    const update = vi.spyOn(actor, "update");
    const result = await runSurvivalTransaction(actor, (state) => ({
      next: { ...state, hp: 4 },
      extra: { "system.magic.mp.value": 3 },
    }));
    expect(result.outcome).toBe("updated");
    expect(readSurvival(actor)).toMatchObject({ hp: 4, status: "alive" });
    expect(actor.system.magic).toEqual({ mp: { value: 3 } });
    expect(update).toHaveBeenCalledTimes(1);
    expect(isSurvivalWrite(update.mock.calls[0]?.[1])).toBe(true);
  });

  it("starts from the effective survival state", async () => {
    const actor = inMemoryCharacter({ hp: 0, status: "alive", failures: 1 });
    const result = await runSurvivalTransaction(actor, (state) => ({ next: state }));
    expect(result.before).toMatchObject({ status: "dying", failures: 0 });
    expect(readSurvival(actor).status).toBe("dying");
  });

  it("holds the lock across the change, then releases it", async () => {
    const actor = inMemoryCharacter();
    let finish: () => void = () => {};
    const first = runSurvivalTransaction(actor, async (state) => {
      await new Promise<void>((resolve) => (finish = resolve));
      return { next: { ...state, hp: 9 } };
    });
    expect((await runSurvivalTransaction(actor, (s) => ({ next: s }))).outcome).toBe("busy");
    finish();
    expect((await first).outcome).toBe("updated");
    expect((await runSurvivalTransaction(actor, (s) => ({ next: s }))).outcome).toBe("updated");
  });

  it("denies non-owners, non-GMs for GM-only changes, and ownership lost mid-change", async () => {
    const notOwned = { ...inMemoryCharacter(), isOwner: false };
    expect((await runSurvivalTransaction(notOwned, (s) => ({ next: s }))).outcome).toBe("denied");

    vi.stubGlobal("game", { user: { isGM: false } });
    const actor = inMemoryCharacter();
    const gmOnly = await runSurvivalTransaction(actor, (s) => ({ next: s }), { gmOnly: true });
    expect(gmOnly.outcome).toBe("denied");

    const lost = await runSurvivalTransaction(actor, (state) => {
      actor.isOwner = false;
      return { next: { ...state, hp: 1 } };
    });
    expect(lost.outcome).toBe("denied");
    expect(actor.writes).toEqual([]);
  });

  it("refuses to overwrite a change made while it was open", async () => {
    const actor = inMemoryCharacter({ hp: 10 });
    const survival = await runSurvivalTransaction(actor, async (state) => {
      Object.assign(actor.system, inMemoryCharacter({ hp: 6 }).system);
      return { next: { ...state, hp: 9 } };
    });
    expect(survival.outcome).toBe("changed");
    expect(readSurvival(actor).hp).toBe(6);

    let pool = 2;
    const watched = await runSurvivalTransaction(
      actor,
      (state) => {
        pool = 1;
        return { next: state };
      },
      { watch: () => pool },
    );
    expect(watched.outcome).toBe("changed");

    const caller = await runSurvivalTransaction(actor, (s) => ({ next: s }), {
      stillValid: () => false,
    });
    expect(caller.outcome).toBe("changed");
    expect(actor.writes).toEqual([]);
  });

  it("reports cancelled and invalid changes without writing", async () => {
    const actor = inMemoryCharacter();
    expect((await runSurvivalTransaction(actor, () => null)).outcome).toBe("cancelled");
    const thrown = await runSurvivalTransaction(actor, () => {
      throw new RangeError("Death save unavailable");
    });
    expect(thrown.outcome).toBe("invalid");
    const overMax = await runSurvivalTransaction(actor, (s) => ({ next: { ...s, hp: 99 } }));
    expect(overMax.outcome).toBe("invalid");
    expect(actor.writes).toEqual([]);
  });

  it("reports a rejected write as failed and does not retry it", async () => {
    const actor = inMemoryCharacter();
    const update = vi.spyOn(actor, "update").mockRejectedValueOnce(new Error("network"));
    const result = await runSurvivalTransaction(actor, (s) => ({ next: { ...s, hp: 3 } }));
    expect(result).toMatchObject({ outcome: "failed", after: { hp: 3 } });
    expect(update).toHaveBeenCalledTimes(1);
    expect((await runSurvivalTransaction(actor, (s) => ({ next: s }))).outcome).toBe("updated");
  });

  it("is the only way to change a Character's survival fields", async () => {
    const actor = inMemoryCharacter({ hp: 10 });
    await actor.update({ "system.attributes.hp.value": 2 });
    expect(readSurvival(actor).hp).toBe(10);
    await runSurvivalTransaction(actor, (state) => ({ next: { ...state, hp: 2 } }));
    expect(readSurvival(actor).hp).toBe(2);
  });
});
