import { afterEach, describe, expect, it, vi } from "vitest";

import { longRestDialog, shortRestDialog } from "../../src/runtime/rest-dialogs";

afterEach(() => {
  vi.unstubAllGlobals();
});

function restActor(
  patch: {
    pool?: number;
    awakened?: boolean;
    temp?: number;
    hitDie?: string;
    hp?: number;
  } = {},
) {
  const awakened = patch.awakened ?? true;
  return {
    name: "Hero",
    type: "character",
    system: {
      attributes: {
        hp: { value: patch.hp ?? 8, max: 20, temp: patch.temp ?? 2 },
        hitDie: patch.hitDie ?? "d8",
        deathSaves: { status: "alive", successes: 0, failures: 0 },
      },
      resources: { pool: { value: patch.pool ?? 3 } },
      abilities: { con: { score: 14 }, int: { score: 16 } },
      magic: {
        awakened,
        ability: awakened ? "int" : null,
        mp: { value: 2 },
      },
      progression: { level: 5 },
    },
    update: vi.fn(async () => undefined),
  };
}

function installRuntime(options: {
  answers?: unknown[];
  rollTotal?: number;
  chat?: () => Promise<unknown>;
  installRoll?: boolean;
}) {
  const warnings: string[] = [];
  const prompts: string[] = [];
  const answers = [...(options.answers ?? [])];
  vi.stubGlobal("ui", {
    notifications: { warn: (message: string) => warnings.push(message) },
  });
  vi.stubGlobal("game", {
    i18n: {
      localize: (key: string) =>
        key === "PIVOT.Rest.ShortRestPrompt" || key === "PIVOT.Rest.ShortRestComplete"
          ? "<b>done</b>"
          : key,
      format: (_key: string, data: { die?: string }) => `die ${data.die ?? ""}`,
    },
  });
  vi.stubGlobal("foundry", {
    applications: {
      api: {
        DialogV2: {
          prompt: vi.fn(async (config: { content?: string }) => {
            prompts.push(config.content ?? "");
            return answers.length > 0 ? answers.shift() : null;
          }),
        },
      },
    },
  });
  if (options.installRoll) {
    vi.stubGlobal(
      "Roll",
      class {
        total: number | undefined = options.rollTotal;
        async evaluate() {}
      },
    );
  }
  const created: Array<{ content?: string }> = [];
  const create = vi.fn(async (data: { content?: string }) => {
    created.push(data);
    if (options.chat) return options.chat();
    return undefined;
  });
  vi.stubGlobal("ChatMessage", { create, applyRollMode: vi.fn() });
  return { warnings, prompts, create, created };
}

describe("shortRestDialog", () => {
  it("refuses a short rest when Pool is empty", async () => {
    const actor = restActor({ pool: 0 });
    const { warnings, prompts } = installRuntime({});
    await shortRestDialog(actor);
    expect(prompts).toEqual([]);
    expect(warnings).toEqual(["PIVOT.Rest.InsufficientPool"]);
    expect(actor.update).not.toHaveBeenCalled();
  });

  it("leaves the actor unchanged when the dialog is cancelled", async () => {
    const actor = restActor();
    const { prompts } = installRuntime({ answers: [null] });
    await shortRestDialog(actor);
    expect(prompts[0]).toContain("PIVOT.Rest.ShortRestInDanger");
    expect(actor.update).not.toHaveBeenCalled();
  });

  it("escapes localized prompt text and heals from each Pool die", async () => {
    const actor = restActor();
    const { prompts, created } = installRuntime({
      answers: [{ poolSpendsRaw: "2", inDanger: false }],
      installRoll: true,
      rollTotal: 4,
    });
    await shortRestDialog(actor);
    expect(prompts[0]).toContain("&lt;b&gt;done&lt;/b&gt;");
    expect(prompts[0]).not.toContain("<b>done</b>");
    expect(actor.update).toHaveBeenCalledWith({
      "system.attributes.hp.value": 20,
      "system.resources.pool.value": 1,
      "system.magic.mp.value": 5,
    });
    const content = created[0]?.content ?? "";
    expect(content).toContain("&lt;b&gt;done&lt;/b&gt;");
    expect(content).toContain("PIVOT.Rest.HpHealed");
    expect(content).toContain("12");
  });

  it("skips MP recovery while in danger and for unawakened characters", async () => {
    const awakened = restActor();
    installRuntime({
      answers: [{ poolSpendsRaw: "1", inDanger: true }],
      installRoll: true,
      rollTotal: 4,
    });
    await shortRestDialog(awakened);
    expect(awakened.update).toHaveBeenCalledWith(
      expect.objectContaining({ "system.magic.mp.value": 2 }),
    );

    vi.unstubAllGlobals();
    const mundane = restActor({ awakened: false });
    const { prompts } = installRuntime({
      answers: [{ poolSpendsRaw: "1", inDanger: false }],
      installRoll: true,
      rollTotal: 4,
    });
    await shortRestDialog(mundane);
    expect(prompts[0]).toContain("PIVOT.Rest.ShortRestNotAwakened");
    expect(prompts[0]).not.toContain('name="inDanger"');
    expect(mundane.update).toHaveBeenCalledWith(
      expect.objectContaining({ "system.magic.mp.value": 2 }),
    );
  });

  it("warns and does not update when the spend, die, or roll cannot finish", async () => {
    const invalidSpend = restActor();
    const spend = installRuntime({ answers: [{ poolSpendsRaw: "0", inDanger: false }] });
    await shortRestDialog(invalidSpend);
    expect(spend.warnings).toEqual(["PIVOT.Rest.RestFailed"]);
    expect(invalidSpend.update).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
    const missingRoll = restActor();
    const noRoll = installRuntime({ answers: [{ poolSpendsRaw: "1", inDanger: false }] });
    await shortRestDialog(missingRoll);
    expect(noRoll.warnings).toEqual(["PIVOT.Rest.RestFailed"]);

    vi.unstubAllGlobals();
    const badDie = restActor({ hitDie: "nope" });
    const die = installRuntime({
      answers: [{ poolSpendsRaw: "1", inDanger: false }],
      installRoll: true,
      rollTotal: 4,
    });
    await shortRestDialog(badDie);
    expect(die.warnings).toEqual(["PIVOT.Rest.RestFailed"]);
    expect(badDie.update).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
    const incomplete = restActor();
    const hung = installRuntime({
      answers: [{ poolSpendsRaw: "1", inDanger: false }],
      installRoll: true,
    });
    await shortRestDialog(incomplete);
    expect(hung.warnings).toEqual(["PIVOT.Rest.RollIncomplete"]);
    expect(incomplete.update).not.toHaveBeenCalled();
  });

  it("keeps a successful update when chat reporting fails", async () => {
    const actor = restActor();
    const { warnings } = installRuntime({
      answers: [{ poolSpendsRaw: "1", inDanger: false }],
      installRoll: true,
      rollTotal: 4,
      chat: async () => {
        throw new Error("chat");
      },
    });
    await shortRestDialog(actor);
    expect(actor.update).toHaveBeenCalledTimes(1);
    expect(warnings).toEqual(["PIVOT.Rest.ChatFailed"]);
  });

  it("warns when the actor update is rejected", async () => {
    const actor = restActor();
    actor.update.mockRejectedValueOnce(new Error("conflict"));
    const { warnings, created } = installRuntime({
      answers: [{ poolSpendsRaw: "1", inDanger: false }],
      installRoll: true,
      rollTotal: 4,
    });
    await shortRestDialog(actor);
    expect(warnings).toEqual(["PIVOT.Rest.RestFailed"]);
    expect(created).toEqual([]);
  });
});

describe("longRestDialog", () => {
  it("recovers HP, Pool, and MP and clears temporary HP when the rest is safe", async () => {
    const actor = restActor({ temp: 4 });
    const { created } = installRuntime({ answers: [{ safeAndComfortable: true }] });
    await longRestDialog(actor);
    expect(actor.update).toHaveBeenCalledWith({
      "system.attributes.hp.value": 20,
      "system.resources.pool.value": 5,
      "system.magic.mp.value": 23,
      "system.attributes.hp.temp": 0,
    });
    expect(created[0]?.content).toContain("PIVOT.Rest.TempHpCleared");
  });

  it("asks for Control Magic when an awakened rest is not safe", async () => {
    const actor = restActor();
    installRuntime({ answers: [{ safeAndComfortable: false }, { roll: 16 }] });
    await longRestDialog(actor);
    expect(actor.update).toHaveBeenCalledWith(
      expect.objectContaining({ "system.magic.mp.value": 23 }),
    );

    vi.unstubAllGlobals();
    const half = restActor();
    installRuntime({ answers: [{ safeAndComfortable: false }, { roll: Number.NaN }] });
    await longRestDialog(half);
    expect(half.update).toHaveBeenCalledWith(
      expect.objectContaining({ "system.magic.mp.value": 13 }),
    );
  });

  it("does not update when either prompt is cancelled", async () => {
    const first = restActor();
    installRuntime({ answers: [null] });
    await longRestDialog(first);
    expect(first.update).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
    const second = restActor();
    installRuntime({ answers: [{ safeAndComfortable: false }, null] });
    await longRestDialog(second);
    expect(second.update).not.toHaveBeenCalled();
  });

  it("skips the Control Magic prompt for an unawakened character", async () => {
    const actor = restActor({ awakened: false });
    const { prompts } = installRuntime({ answers: [{ safeAndComfortable: false }] });
    await longRestDialog(actor);
    expect(prompts).toHaveLength(1);
    expect(actor.update).toHaveBeenCalledWith(
      expect.objectContaining({ "system.magic.mp.value": 2 }),
    );
  });

  it("reports an update failure and a chat failure separately", async () => {
    const rejected = restActor();
    rejected.update.mockRejectedValueOnce(new Error("conflict"));
    const failedUpdate = installRuntime({ answers: [{ safeAndComfortable: true }] });
    await longRestDialog(rejected);
    expect(failedUpdate.warnings).toEqual(["PIVOT.Rest.RestFailed"]);
    expect(failedUpdate.created).toEqual([]);

    vi.unstubAllGlobals();
    const actor = restActor({ temp: 0 });
    const failedChat = installRuntime({
      answers: [{ safeAndComfortable: true }],
      chat: async () => {
        throw new Error("chat");
      },
    });
    await longRestDialog(actor);
    expect(actor.update).toHaveBeenCalledTimes(1);
    expect(failedChat.warnings).toEqual(["PIVOT.Rest.ChatFailed"]);
  });
});
