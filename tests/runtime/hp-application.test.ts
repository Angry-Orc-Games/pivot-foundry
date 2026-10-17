import { afterEach, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { correctSurvivalDialog } from "../../src/runtime/death-saves";
import { targetPreviewRow } from "../../src/runtime/health-dialog";
import { HealthTransactions, type HealthActor } from "../../src/runtime/health";
import { prepareCharacterSheetContext, type ActorLike } from "../../src/sheets/character-sheet";

afterEach(() => vi.unstubAllGlobals());

function writeDotted(system: Record<string, unknown>, update: Record<string, unknown>): void {
  for (const [path, value] of Object.entries(update)) {
    const parts = path.split(".").filter((part) => part !== "system");
    const leaf = parts.at(-1);
    if (!leaf) continue;
    let cursor = system;
    for (const part of parts.slice(0, -1)) {
      const next = cursor[part];
      if (typeof next !== "object" || next === null) cursor[part] = {};
      cursor = cursor[part] as Record<string, unknown>;
    }
    cursor[leaf] = value;
  }
}

function fullHpCharacter(): HealthActor {
  const system: Record<string, unknown> = {
    progression: { level: 1, xp: 0 },
    attributes: {
      hp: { value: 10, max: 10, temp: 0 },
      hitDie: "d8",
      ac: { bonus: 0 },
      initiative: { bonus: 0 },
      speed: { value: 10, bonus: 0 },
      passivePerception: { mode: "normal" },
      deathSaves: { status: "dying", successes: 0, failures: 0 },
    },
    resources: { pool: { value: 0, maxBonus: 0 } },
  };
  return {
    uuid: "Actor.brannoc",
    name: "Brannoc",
    type: "character",
    isOwner: true,
    system,
    update: async (data) => {
      writeDotted(system, data);
    },
  };
}

function shownHp(actor: HealthActor): string {
  const context = prepareCharacterSheetContext(actor as ActorLike);
  const hp = (context.system as { attributes: { hp: { value: number; max: number } } }).attributes
    .hp;
  return `${hp.value} / ${hp.max}`;
}

function reloaded(actor: HealthActor): HealthActor {
  return { ...actor, system: JSON.parse(JSON.stringify(actor.system)) as Record<string, unknown> };
}

function stubEnglish(): void {
  vi.stubGlobal("game", {
    user: { isGM: true },
    i18n: {
      localize: (key: string) =>
        (
          ({
            "PIVOT.Survival.dying": "Dying",
            "PIVOT.Survival.alive": "Conscious",
            "PIVOT.Survival.dead": "Dead",
            "PIVOT.Survival.stable": "Stable / Unconscious",
            "PIVOT.Survival.Temp": "Temporary HP",
            "PIVOT.Survival.denied": "Permission denied",
          }) as Record<string, string>
        )[key] ?? key,
    },
  });
}

it("applies 3 damage, capped healing, and an exact correction, then keeps them on the sheet", async () => {
  stubEnglish();
  const actor = fullHpCharacter();
  const damagePreview = targetPreviewRow(actor, 0, true, { kind: "damage", amount: 3 });
  expect(damagePreview).toContain("HP 7/10");
  expect(damagePreview).not.toContain("Dying");
  const lethalPreview = targetPreviewRow(actor, 0, true, { kind: "damage", amount: 10 });
  expect(lethalPreview).toContain("HP 0/10");
  expect(lethalPreview).toContain("(Dying)");

  expect((await new HealthTransactions().apply("dmg", [actor], "damage", 3))[0]?.outcome).toBe(
    "updated",
  );
  expect(shownHp(actor)).toBe("7 / 10");
  expect(shownHp(reloaded(actor))).toBe("7 / 10");

  expect((await new HealthTransactions().apply("heal", [actor], "healing", 5))[0]?.outcome).toBe(
    "updated",
  );
  expect(shownHp(actor)).toBe("10 / 10");
  expect(
    (await new HealthTransactions().apply("overheal", [actor], "healing", 5))[0]?.outcome,
  ).toBe("updated");
  expect(shownHp(reloaded(actor))).toBe("10 / 10");

  const dom = new JSDOM(
    `<form>
      <input name="hp" value="4" />
      <input name="temp" value="0" />
      <input name="successes" value="0" />
      <input name="failures" value="0" />
      <input name="status" value="dying" />
    </form>`,
  );
  const form = dom.window.document.querySelector("form");
  vi.stubGlobal("FormData", dom.window.FormData);
  vi.stubGlobal("foundry", {
    applications: {
      api: {
        DialogV2: {
          prompt: async (config: {
            ok: { callback: (event: unknown, button: { form?: HTMLFormElement }) => unknown };
          }) => config.ok.callback(null, { form: form as HTMLFormElement }),
        },
      },
    },
  });
  await correctSurvivalDialog(actor);
  expect(shownHp(actor)).toBe("4 / 10");
  expect(shownHp(reloaded(actor))).toBe("4 / 10");
  expect(prepareCharacterSheetContext(actor as ActorLike).survivalStatus).not.toBe("dying");
});

it("does not revive a dead character when HP is already positive", async () => {
  const actor = fullHpCharacter();
  const attributes = actor.system.attributes as {
    hp: { value: number };
    deathSaves: { status: string };
  };
  attributes.hp.value = 4;
  attributes.deathSaves.status = "dead";
  expect((await new HealthTransactions().apply("dead", [actor], "healing", 3))[0]?.outcome).toBe(
    "failed",
  );
  expect(shownHp(actor)).toBe("4 / 10");
  expect(attributes.deathSaves.status).toBe("dead");
});
