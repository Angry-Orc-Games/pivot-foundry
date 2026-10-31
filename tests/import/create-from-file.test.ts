import { readFileSync } from "node:fs";

import { JSDOM } from "jsdom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFromFile } from "../../src/import/create-from-file";
import { readPrepared, registerImportButton } from "../../src/import/import-dialog";
import { compareDrift, toActorData, validate } from "../../src/import/pivot-character";
import { calculateManaMaximum } from "../../src/rules/character-derived";
import { prepareCharacterSheetContext } from "../../src/sheets/character-sheet";

type JsonRecord = Record<string, unknown>;

interface CreatedActor {
  id: string;
  name: string;
  type: string;
  system: JsonRecord;
  delete: ReturnType<typeof vi.fn>;
  createEmbeddedDocuments: ReturnType<typeof vi.fn>;
}

interface World {
  create: ReturnType<typeof vi.fn>;
  actors: CreatedActor[];
}

const host = globalThis as {
  game?: unknown;
  Actor?: unknown;
  CONST?: unknown;
};

let prior: { game: unknown; Actor: unknown; CONST: unknown };

function load(name: string): JsonRecord {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
}

const veteran = load("human-veteran.pivot.json");
const elf = load("elf-street-mage.pivot.json");

function withoutHp(): JsonRecord {
  const file = structuredClone(veteran);
  delete (file.computed as JsonRecord).hp;
  return file;
}

function install(options: {
  isGM?: boolean;
  userId?: string;
  users?: { id: string; name: string }[];
  packs?: unknown[];
  embed?: () => unknown;
  deleteFails?: boolean;
}): World {
  const users = options.users ?? [{ id: "player-1", name: "Ada" }];
  const actors: CreatedActor[] = [];
  const create = vi.fn(async (data: { name?: string; type?: string; system?: JsonRecord }) => {
    const actor: CreatedActor = {
      id: `actor-${actors.length + 1}`,
      name: data.name ?? "",
      type: data.type ?? "",
      system: data.system ?? {},
      delete: vi.fn(async () => {
        if (options.deleteFails) throw new Error("delete failed");
      }),
      createEmbeddedDocuments: vi.fn(async (_type: string, data: unknown[]) => {
        if (options.embed) return options.embed();
        return data;
      }),
    };
    actors.push(actor);
    return actor;
  });
  host.Actor = { create };
  host.game = {
    user: { id: options.userId ?? "gm-1", isGM: options.isGM ?? false },
    users: {
      contents: users,
      get(id: string) {
        return users.find((user) => user.id === id);
      },
    },
    packs: options.packs ?? [],
    actors: { get: () => undefined },
  };
  return { create, actors };
}

function directory(): HTMLElement {
  const dom = new JSDOM(
    `<div id="root"><div class="header-actions"><button type="button" class="create-entry">Create Actor</button></div></div>`,
  );
  const root = dom.window.document.querySelector("#root");
  if (!root) throw new Error("missing directory");
  return root as HTMLElement;
}

beforeEach(() => {
  prior = { game: host.game, Actor: host.Actor, CONST: host.CONST };
});

afterEach(() => {
  host.game = prior.game;
  host.Actor = prior.Actor;
  host.CONST = prior.CONST;
});

describe("createFromFile", () => {
  it.each([
    ["malformed", null, "malformed"],
    ["wrong system", { system: "other" }, "wrong-system"],
    ["version 1", { system: "pivot", v: 1 }, "unknown-format"],
    ["format other than 2", { system: "pivot", format: 1 }, "unknown-format"],
    ["missing hit points", withoutHp(), "schema"],
  ])("%s does not call Actor.create", async (_label, file, code) => {
    const world = install({ isGM: true });
    const result = await createFromFile(file, "player-1");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(code);
    expect(world.create).not.toHaveBeenCalled();
  });

  it("returns the validate error before the GM check", async () => {
    const world = install({ isGM: false });
    const result = await createFromFile(null, "player-1");
    expect(result).toEqual({
      ok: false,
      error: {
        code: "malformed",
        message: "This file is not a Pivot character JSON object.",
      },
    });
    expect(world.create).not.toHaveBeenCalled();
  });

  it("returns forbidden for a non-GM and does not create", async () => {
    const world = install({ isGM: false });
    const result = await createFromFile(veteran, "player-1");
    expect(result).toEqual({
      ok: false,
      error: { code: "forbidden", message: "Only a GM can import a character." },
    });
    expect(world.create).not.toHaveBeenCalled();
  });

  it("returns the choose-player error for an empty owner id", async () => {
    const world = install({ isGM: true });
    const result = await createFromFile(veteran, "");
    expect(result).toEqual({
      ok: false,
      error: { code: "schema", message: "Choose a player.", field: "ownerUserId" },
    });
    expect(world.create).not.toHaveBeenCalled();
  });

  it("creates one character owned by the chosen player", async () => {
    const world = install({ isGM: true, userId: "gm-1" });
    const result = await createFromFile(veteran, "player-1");
    expect(result).toEqual({ ok: true, value: { actorId: "actor-1" } });
    expect(world.create).toHaveBeenCalledTimes(1);
    const payload = world.create.mock.calls[0]?.[0] as {
      name: string;
      type: string;
      ownership: Record<string, number>;
      items?: unknown;
      system: { identity: { player: string; concept: string } };
      flags: { "pivot-chargen": { source: { choices: { name: string } } } };
    };
    expect(payload).toMatchObject({
      name: "Human Veteran",
      type: "character",
      ownership: { "player-1": 3, "gm-1": -1 },
    });
    expect(payload).not.toHaveProperty("items");
    expect(payload.system.identity.player).toBe("Ada");
    expect(payload.system.identity.concept).toBe(
      "A heavy-armoured veteran called back to the road.",
    );
    expect(payload.flags["pivot-chargen"].source.choices.name).toBe("Human Veteran");
    const actor = world.actors[0];
    if (!actor) throw new Error("missing actor");
    expect(actor.createEmbeddedDocuments).toHaveBeenCalledTimes(1);
    const embedded = actor.createEmbeddedDocuments.mock.calls[0]?.[1] as Array<{
      name: string;
      _id?: string;
    }>;
    expect(embedded).toHaveLength(15);
    expect(embedded.every((item) => item._id === undefined)).toBe(true);
  });

  it("does not write INHERIT when the GM is the owner", async () => {
    const world = install({
      isGM: true,
      userId: "player-1",
      users: [{ id: "player-1", name: "Ada" }],
    });
    await createFromFile(veteran, "player-1");
    const payload = world.create.mock.calls[0]?.[0] as { ownership: Record<string, number> };
    expect(payload.ownership).toEqual({ "player-1": 3 });
  });

  it("uses Foundry ownership levels when CONST provides them", async () => {
    host.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { OWNER: 7, INHERIT: -5 } };
    const world = install({ isGM: true, userId: "gm-1" });
    await createFromFile(veteran, "player-1");
    const payload = world.create.mock.calls[0]?.[0] as { ownership: Record<string, number> };
    expect(payload.ownership).toEqual({ "player-1": 7, "gm-1": -5 });
  });

  it("leaves the player name blank when the user record has no name", async () => {
    const world = install({ isGM: true, users: [{ id: "player-1", name: "" }] });
    await createFromFile(veteran, "player-1");
    const payload = world.create.mock.calls[0]?.[0] as {
      system: { identity: { player: string } };
    };
    expect(payload.system.identity.player).toBe("");
  });

  it("replaces a shell with the first item pack entry of the same name and type", async () => {
    const packs = [
      {
        metadata: { type: "Actor" },
        index: { contents: [{ _id: "actor-human", name: "Human", type: "feature" }] },
        async getDocument() {
          return {
            toObject: () => ({
              name: "Human",
              type: "feature",
              system: { notes: "actor pack", effects: [{ type: "nope" }] },
            }),
          };
        },
      },
      {
        documentName: "Item",
        index: [
          { _id: "olympian", name: "Olympian", type: "feature" },
          { _id: "sword", name: "Arming sword", type: "weapon" },
          { _id: "other", name: "Olympian", type: "weapon" },
        ],
        async getDocument(id: string) {
          if (id === "olympian") {
            return {
              toObject: () => ({
                _id: "olympian",
                name: "Olympian",
                type: "feature",
                system: {
                  category: "feat",
                  source: "compendium",
                  notes: "from the pack",
                  effects: [{ type: "acBonus", amount: 1 }],
                },
              }),
            };
          }
          return {
            toObject: () => ({
              _id: "sword",
              name: "Arming sword",
              type: "weapon",
              system: {
                category: "meleeMedium",
                notes: "pack sword",
                effects: [{ type: "acBonus", amount: 1 }],
              },
            }),
          };
        },
      },
    ];
    const world = install({ isGM: true, packs });
    await createFromFile(veteran, "player-1");
    const actor = world.actors[0];
    if (!actor) throw new Error("missing actor");
    const embedded = actor.createEmbeddedDocuments.mock.calls[0]?.[1] as Array<{
      name: string;
      type: string;
      system: Record<string, unknown>;
      _id?: string;
    }>;
    const human = embedded.find((item) => item.name === "Human");
    const olympian = embedded.find((item) => item.name === "Olympian");
    const sword = embedded.find((item) => item.name === "Arming sword");
    expect(human).toMatchObject({
      type: "feature",
      system: { source: "pivot-chargen", notes: "", effects: [] },
    });
    expect(olympian).toMatchObject({
      type: "feature",
      system: { source: "compendium", notes: "from the pack", effects: [] },
    });
    expect(olympian?._id).toBeUndefined();
    expect(sword).toMatchObject({
      type: "weapon",
      system: {
        category: "meleeMedium",
        notes: "pack sword",
        effects: [{ type: "acBonus", amount: 1 }],
      },
    });
  });

  it("does not keep an actor when an item pack lookup throws", async () => {
    const packs = [
      {
        documentName: "Item",
        index: [{ _id: "human", name: "Human", type: "feature" }],
        async getDocument() {
          throw new Error("pack unavailable");
        },
      },
    ];
    const world = install({ isGM: true, packs });
    const result = await createFromFile(veteran, "player-1");
    expect(result).toEqual({
      ok: false,
      error: { code: "incomplete", message: "Import did not finish, so no character was kept." },
    });
    for (const actor of world.actors) expect(actor.delete).toHaveBeenCalledTimes(1);
  });

  it("deletes the actor when embedding items throws", async () => {
    const world = install({
      isGM: true,
      embed: () => {
        throw new Error("embed failed");
      },
    });
    const result = await createFromFile(veteran, "player-1");
    expect(result).toEqual({
      ok: false,
      error: { code: "incomplete", message: "Import did not finish, so no character was kept." },
    });
    expect(world.actors[0]?.delete).toHaveBeenCalledTimes(1);
  });

  it("does not delete when Actor.create throws", async () => {
    const world = install({ isGM: true });
    world.create.mockReset();
    world.create.mockRejectedValue(new Error("create failed"));
    await expect(createFromFile(veteran, "player-1")).rejects.toThrow("create failed");
    expect(world.actors).toHaveLength(0);
  });

  it("does not create when the owner is not a user in the world", async () => {
    const world = install({
      isGM: true,
      users: [
        { id: "player-1", name: "Ada" },
        { id: "gm-1", name: "Ken" },
      ],
    });
    const missing = await createFromFile(veteran, "missing-user");
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.field).toBe("ownerUserId");
    expect(world.create).not.toHaveBeenCalled();

    const player = await createFromFile(veteran, "player-1");
    const gm = await createFromFile(veteran, "gm-1");
    expect(player.ok).toBe(true);
    expect(gm.ok).toBe(true);
  });

  it("deletes the actor when embedding creates no items", async () => {
    const world = install({ isGM: true, embed: () => [] });
    const result = await createFromFile(veteran, "player-1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("incomplete");
    expect(world.actors[0]?.delete).toHaveBeenCalledTimes(1);
    expect(world.actors).toHaveLength(1);
  });

  it("reports the import error when removing the actor also fails", async () => {
    const world = install({
      isGM: true,
      deleteFails: true,
      embed: () => {
        throw new Error("embed failed");
      },
    });
    const result = await createFromFile(veteran, "player-1");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("incomplete");
      expect(result.error.message).toContain("could not be removed");
    }
    expect(world.actors[0]?.delete).toHaveBeenCalledTimes(1);
  });

  it("creates the edited AC and MP and does not block on the warning", async () => {
    const edited = structuredClone(elf);
    const computed = edited.computed as { ac: number; mp: number };
    computed.ac = 16;
    computed.mp = 20;
    const world = install({ isGM: true });
    const created = await createFromFile(edited, "player-1");
    expect(created.ok).toBe(true);
    const payload = world.create.mock.calls[0]?.[0] as {
      name: string;
      type: string;
      system: { attributes: { ac: { bonus: number } } };
    };
    const context = prepareCharacterSheetContext({
      name: payload.name,
      type: payload.type,
      system: payload.system,
      items: [],
    });
    expect(context.derived.armourClass.value).toBe(16);
    expect(context.derived.magic.mp.max).toBe(20);
  });

  it("drift: actor keeps file computed values", async () => {
    const edited = structuredClone(elf) as {
      choices: { aw: boolean; magicAb: string };
      computed: {
        ac: number;
        mp: number;
        abilities: Record<string, { score: number; mod: number }>;
      };
    };
    const rules = structuredClone(edited.computed);
    edited.computed.ac = 16;
    edited.computed.mp = 20;
    const world = install({ isGM: true });
    const created = await createFromFile(edited, "player-1");
    expect(created.ok).toBe(true);

    const actor = world.actors[0];
    if (!actor) throw new Error("missing actor");
    const system = actor.system as {
      attributes: { ac: { bonus: number } };
      magic: { mp: { value: number; maxBonus: number } };
    };
    const dex = edited.computed.abilities.dex?.mod;
    if (dex === undefined) throw new Error("missing dexterity");
    const ability = edited.computed.abilities[edited.choices.magicAb];
    if (!ability) throw new Error("missing magic ability");
    const base = calculateManaMaximum({
      awakened: edited.choices.aw,
      level: 1,
      abilityScore: ability.score,
    });
    const fileAcBonus = edited.computed.ac - 10 - dex;
    const rulesAcBonus = rules.ac - 10 - dex;

    expect(system.attributes.ac.bonus).toBe(fileAcBonus);
    expect(system.attributes.ac.bonus).not.toBe(rulesAcBonus);
    expect(system.magic.mp.value).toBe(edited.computed.mp);
    expect(system.magic.mp.value).not.toBe(rules.mp);
    expect(system.magic.mp.maxBonus).toBe(edited.computed.mp - base);
    expect(system.magic.mp.maxBonus).not.toBe(rules.mp - base);

    const context = prepareCharacterSheetContext({
      name: actor.name,
      type: actor.type,
      system,
      items: [],
    });
    expect(context.derived.armourClass.value).toBe(edited.computed.ac);
    expect(context.derived.magic.mp.max).toBe(edited.computed.mp);
    expect(context.derived.armourClass.value).not.toBe(rules.ac);
    expect(context.derived.magic.mp.max).not.toBe(rules.mp);
  });

  it("creates a second actor on a second success", async () => {
    const world = install({ isGM: true });
    const first = await createFromFile(veteran, "player-1");
    const second = await createFromFile(elf, "player-1");
    expect(first).toEqual({ ok: true, value: { actorId: "actor-1" } });
    expect(second).toEqual({ ok: true, value: { actorId: "actor-2" } });
    expect(world.create).toHaveBeenCalledTimes(2);
  });
});

describe("readPrepared", () => {
  it("reads the sheet totals for a created character", () => {
    const veteranResult = validate(veteran);
    const elfResult = validate(elf);
    if (!veteranResult.ok || !elfResult.ok) throw new Error("sample failed validation");
    const veteranDraft = toActorData(veteranResult.value);
    const elfDraft = toActorData(elfResult.value);
    const actors = new Map<string, unknown>([
      [
        "veteran",
        {
          id: "veteran",
          name: veteranDraft.actor.name,
          type: veteranDraft.actor.type,
          system: veteranDraft.actor.system,
          items: veteranDraft.items,
        },
      ],
      [
        "elf",
        {
          id: "elf",
          name: elfDraft.actor.name,
          type: elfDraft.actor.type,
          system: elfDraft.actor.system,
          items: elfDraft.items,
        },
      ],
    ]);
    host.game = { actors: { get: (id: string) => actors.get(id) } };

    expect(readPrepared("veteran")).toEqual({ ac: 16, poolMax: 1, mpMax: 0, speed: 10 });
    const elfSnap = readPrepared("elf");
    expect(elfSnap).toEqual({ ac: 14, poolMax: 1, mpMax: 15, speed: 10 });
    expect(compareDrift(elfResult.value, elfSnap)).toEqual([]);
    expect(compareDrift(veteranResult.value, readPrepared("veteran"))).toEqual([]);
  });
});

describe("registerImportButton", () => {
  it("does nothing when the hook registrar has no on", () => {
    expect(() => registerImportButton({})).not.toThrow();
  });

  it("adds one native directory button for a GM", () => {
    host.game = { user: { isGM: true } };
    const html = directory();
    let handler: ((app: unknown, element: HTMLElement) => void) | undefined;
    registerImportButton({
      on(_event, next) {
        handler = next;
      },
    });
    handler?.(null, html);
    handler?.(null, html);
    const buttons = html.querySelectorAll("[data-pivot-import]");
    expect(buttons).toHaveLength(1);
    const button = buttons[0];
    expect(button?.textContent).toBe("Import Pivot character");
    expect(button?.className).toBe("create-entry");
    expect(button?.getAttribute("type")).toBe("button");
    expect(button?.className).not.toMatch(/\bpf-/);
  });

  it("does not add the button for anyone else", () => {
    host.game = { user: { isGM: false } };
    const html = directory();
    let handler: ((app: unknown, element: HTMLElement) => void) | undefined;
    registerImportButton({
      on(_event, next) {
        handler = next;
      },
    });
    handler?.(null, html);
    expect(html.querySelector("[data-pivot-import]")).toBeNull();
  });
});
