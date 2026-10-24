import { expect, it, vi, afterEach } from "vitest";
import {
  installHealthChatHook,
  messagePayloadUnchanged,
  previewHealth,
  readDamagePayload,
  targetPreviewRow,
  tempHpDialog,
} from "../../src/runtime/health-dialog";
import type { HealthActor } from "../../src/runtime/health";
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

function healthActor(uuid = "Actor.preview"): HealthActor {
  return {
    uuid,
    name: "Hero",
    type: "character",
    isOwner: true,
    system: {
      attributes: {
        hp: { value: 10, max: 20, temp: 2 },
        deathSaves: { status: "alive", successes: 0, failures: 0 },
      },
    },
    update: vi.fn(async () => {}),
  };
}

function stubDialog(prompt: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("foundry", { applications: { api: { DialogV2: { prompt } } } });
  vi.stubGlobal("ui", { notifications: { warn: vi.fn() } });
}

it("applies a previewed amount to the refreshed owned target", async () => {
  const actor = healthActor();
  const prompt = vi.fn(async () => ({ amount: 3, selected: [0], tempChoice: "keep" }));
  stubDialog(prompt);
  vi.stubGlobal("fromUuid", async () => actor);
  const create = vi.fn(async () => {});
  vi.stubGlobal("ChatMessage", { create, applyRollMode: vi.fn() });
  await previewHealth("op-preview-apply", "damage", 3, false, actor);
  expect(actor.update).toHaveBeenCalledWith(
    expect.objectContaining({ "system.attributes.hp.value": 9, "system.attributes.hp.temp": 0 }),
  );
  expect(create).toHaveBeenCalledTimes(1);
});

it("warns when no health targets are selected", async () => {
  const warn = vi.fn();
  vi.stubGlobal("ui", { notifications: { warn } });
  await previewHealth("op-preview-empty", "healing", 1, false, null);
  expect(warn).toHaveBeenCalledWith("NoTargets");
});

it("rejects a non-GM amount edit and a GM flag that changes before confirm", async () => {
  const actor = healthActor("Actor.edit");
  const prompt = vi.fn(async () => ({ amount: 99, selected: [0], tempChoice: "keep" }));
  stubDialog(prompt);
  vi.stubGlobal("game", { user: { isGM: false } });
  await previewHealth("op-preview-edit", "damage", 3, false, actor);
  expect(actor.update).not.toHaveBeenCalled();

  const gm = healthActor("Actor.gm");
  const game = { user: { isGM: true } };
  vi.stubGlobal("game", game);
  prompt.mockImplementationOnce(async () => {
    game.user.isGM = false;
    return { amount: 9, selected: [0], tempChoice: "keep" };
  });
  await previewHealth("op-preview-gm", "damage", 3, false, gm);
  expect(gm.update).not.toHaveBeenCalled();
});

it("warns when a selected target can no longer be resolved and when the report fails", async () => {
  const actor = healthActor("Actor.missing");
  const prompt = vi.fn(async () => ({ amount: 1, selected: [0], tempChoice: "keep" }));
  stubDialog(prompt);
  vi.stubGlobal("fromUuid", async () => null);
  await previewHealth("op-preview-missing", "healing", 1, false, actor);
  expect(actor.update).not.toHaveBeenCalled();

  const reported = healthActor("Actor.report");
  vi.stubGlobal("fromUuid", async () => reported);
  vi.stubGlobal("ChatMessage", {
    create: vi.fn(async () => {
      throw new Error("chat");
    }),
  });
  await previewHealth("op-preview-report", "healing", 1, false, reported);
  expect(reported.update).toHaveBeenCalled();
});

it("wires an apply button only for a complete damage message", () => {
  const button = { remove: vi.fn(), addEventListener: vi.fn() };
  const html = { querySelector: () => button } as unknown as HTMLElement;
  let handler:
    | ((message: { id?: string; flags?: Record<string, unknown> }, node: HTMLElement) => void)
    | undefined;
  installHealthChatHook({
    on: (_name, callback) => {
      handler = callback;
    },
  });
  handler?.({}, html);
  expect(button.remove).toHaveBeenCalledTimes(1);

  const valid = {
    version: 1,
    complete: true,
    amount: 2,
    kind: "damage",
    critical: false,
    actorUuid: "Actor.a",
  };
  const click = { remove: vi.fn(), addEventListener: vi.fn() };
  handler?.({ id: "message-1", flags: { "pivot-fantasy": { survivalRoll: valid } } }, {
    querySelector: () => click,
  } as unknown as HTMLElement);
  expect(click.addEventListener).toHaveBeenCalledWith("click", expect.any(Function));
  installHealthChatHook({});
});

it("previews temporary HP from the temp dialog and rejects an invalid amount", async () => {
  const actor = healthActor("Actor.temp");
  const prompt = vi
    .fn()
    .mockResolvedValueOnce(4)
    .mockResolvedValueOnce({ amount: 4, selected: [0], tempChoice: "replace" });
  stubDialog(prompt);
  vi.stubGlobal("fromUuid", async () => actor);
  vi.stubGlobal("ChatMessage", { create: vi.fn(async () => {}), applyRollMode: vi.fn() });
  await tempHpDialog(actor);
  expect(actor.update).toHaveBeenCalled();

  const invalid = healthActor("Actor.temp-invalid");
  prompt.mockReset();
  prompt.mockResolvedValueOnce(-1);
  await tempHpDialog(invalid);
  expect(invalid.update).not.toHaveBeenCalled();

  prompt.mockResolvedValueOnce(null);
  await tempHpDialog(invalid);
  expect(invalid.update).not.toHaveBeenCalled();
});
