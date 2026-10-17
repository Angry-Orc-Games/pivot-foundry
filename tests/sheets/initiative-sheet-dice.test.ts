import { afterEach, describe, expect, it, vi } from "vitest";
import { initiativeRollFormula, rollSheetInitiative } from "../../src/sheets/character-sheet";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

type Faces = number[];

function makeRollClass(faces: Faces, formulas: string[]) {
  return class MockRoll {
    formula: string;
    dice: {
      faces: number;
      number: number;
      modifiers: string[];
      results: { result: number; active: boolean; discarded?: boolean }[];
    }[] = [];
    total = 0;
    constructor(formula: string) {
      this.formula = formula;
      formulas.push(formula);
    }
    async evaluate() {
      const m = /^(\d+)d20(kh1|kl1)?([+-]\d+)$/.exec(this.formula);
      if (!m) throw new Error(`unexpected formula ${this.formula}`);
      const count = Number(m[1]);
      const rolled = faces.slice(0, count);
      const keepVal =
        m[2] === "kh1"
          ? Math.max(...rolled)
          : m[2] === "kl1"
            ? Math.min(...rolled)
            : (rolled[0] ?? 0);
      let keptOnce = false;
      const results = rolled.map((r) => {
        const active = !keptOnce && r === keepVal;
        if (active) keptOnce = true;
        return active ? { result: r, active } : { result: r, active, discarded: true };
      });
      this.dice = [{ faces: 20, number: count, modifiers: m[2] ? [m[2]] : [], results }];
      this.total = keepVal + Number(m[3]);
      return this;
    }
    async toMessage(data: Record<string, unknown>) {
      return { ...data, rolls: [this] };
    }
  };
}

function setup(dsnActive: boolean) {
  const order: string[] = [];
  const created: Record<string, unknown>[] = [];
  const updates: unknown[] = [];
  vi.stubGlobal("ChatMessage", {
    create: vi.fn(async (data: Record<string, unknown>) => {
      order.push("chat");
      created.push(data);
      return { id: "msg1" };
    }),
  });
  const waitFor = vi.fn(async (id: string) => {
    expect(id).toBe("msg1");
    await Promise.resolve();
    order.push("dsn-wait");
    return true;
  });
  vi.stubGlobal("game", {
    settings: { get: () => "roll" },
    i18n: { localize: (k: string) => k },
    modules: { get: (id: string) => (id === "dice-so-nice" ? { active: dsnActive } : undefined) },
    dice3d: { waitFor3DAnimationByMessageID: waitFor },
  });
  const combat = {
    combatants: [
      {
        id: "c1",
        actorId: "a1",
        update: vi.fn(async (d: unknown) => {
          order.push("update");
          updates.push(d);
        }),
      },
    ],
  };
  return { order, created, updates, waitFor, combat };
}

const cases = [
  { mode: "normal", faces: [11], dice: 1, kept: 11, formula: "1d20+3" },
  { mode: "advantage", faces: [6, 17], dice: 2, kept: 17, formula: "2d20kh1+3" },
  { mode: "disadvantage", faces: [6, 17], dice: 2, kept: 6, formula: "2d20kl1+3" },
] as const;

describe("sheet initiative posts real d20 dice for Dice So Nice", () => {
  it("builds keep-modifier formulas matching selectKeptD20 semantics", () => {
    expect(initiativeRollFormula({ dieCount: 1, pick: "single" }, 2)).toBe("1d20+2");
    expect(initiativeRollFormula({ dieCount: 2, pick: "highest" }, -1)).toBe("2d20kh1-1");
    expect(initiativeRollFormula({ dieCount: 2, pick: "lowest" }, 0)).toBe("2d20kl1+0");
  });

  for (const c of cases) {
    it(`${c.mode}: message carries ${c.dice} d20, total = kept + mod = stored initiative`, async () => {
      const env = setup(true);
      const formulas: string[] = [];
      const RollClass = makeRollClass([...c.faces], formulas);
      const result = await rollSheetInitiative({
        actor: { id: "a1", name: "Hero" } as never,
        RollConstructor: RollClass,
        mode: c.mode,
        modifier: 3,
        label: "Initiative",
        combat: env.combat as never,
      });

      expect(formulas).toEqual([c.formula]);
      expect(env.created).toHaveLength(1);
      const rolls = env.created[0]?.rolls as InstanceType<typeof RollClass>[];
      expect(rolls).toHaveLength(1);
      const d20s = (rolls[0]?.dice ?? []).filter((d) => d.faces === 20);
      expect(d20s.flatMap((d) => d.results)).toHaveLength(c.dice);
      expect(result.kept).toBe(c.kept);
      expect(result.total).toBe(c.kept + 3);
      expect(rolls[0]?.total).toBe(result.total);
      expect(String(env.created[0]?.flavor)).toContain(String(c.kept + 3));
      expect(env.updates).toEqual([{ initiative: c.kept + 3 }]);
      expect(env.waitFor).toHaveBeenCalledTimes(1);
      expect(env.order).toEqual(["chat", "dsn-wait", "update"]);
    });
  }
});
