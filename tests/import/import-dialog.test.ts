import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { registerImportButton } from "../../src/import/import-dialog";
import { validate } from "../../src/import/pivot-character";

const veteran = JSON.parse(
  readFileSync(new URL("./fixtures/human-veteran.pivot.json", import.meta.url), "utf8"),
);
const elf = JSON.parse(
  readFileSync(new URL("./fixtures/elf-street-mage.pivot.json", import.meta.url), "utf8"),
);

interface RenderedDialog {
  kept?: boolean;
  note?: string;
  warnings?: string[];
  renders: Array<{ force?: boolean } | undefined>;
  render: (options?: { force?: boolean }) => void;
  constructor: {
    onConfirm?: (this: RenderedDialog, event: Event, form: HTMLFormElement) => Promise<void>;
    onPreview?: (this: RenderedDialog, event: Event, form: HTMLFormElement) => Promise<void>;
  };
  _prepareContext?: () => Promise<{ kept: boolean; note?: string; warnings?: string[] }>;
}

const dialogs: RenderedDialog[] = [];

class ApplicationV2 {
  renders: Array<{ force?: boolean } | undefined> = [];

  constructor() {
    dialogs.push(this as unknown as RenderedDialog);
  }

  render(options?: { force?: boolean }): void {
    this.renders.push(options);
  }
}

function installFoundry(): void {
  const foundry = {
    applications: {
      api: {
        ApplicationV2,
        HandlebarsApplicationMixin: (base: new (...args: never[]) => object) =>
          class extends base {},
      },
    },
  };
  (globalThis as { foundry?: typeof foundry }).foundry = foundry;
}

function directory(): {
  html: HTMLElement;
  button: {
    textContent: string;
    listeners: Record<string, (event: { preventDefault(): void }) => void>;
  } | null;
} {
  const created: {
    textContent: string;
    listeners: Record<string, (event: { preventDefault(): void }) => void>;
    setAttribute: () => void;
    addEventListener: (name: string, fn: (event: { preventDefault(): void }) => void) => void;
  } = {
    textContent: "",
    listeners: {},
    setAttribute() {},
    addEventListener(name, fn) {
      created.listeners[name] = fn;
    },
  };
  const html = {
    querySelector(selector: string) {
      if (selector === "[data-pivot-import]") return null;
      if (selector === ".header-actions") {
        return {
          querySelector: () => ({ className: "header-control" }),
          append() {},
        };
      }
      return null;
    },
    ownerDocument: { createElement: () => created },
  };
  return { html: html as unknown as HTMLElement, button: created };
}

afterEach(() => {
  dialogs.length = 0;
  delete (globalThis as { foundry?: unknown }).foundry;
  delete (globalThis as { game?: unknown }).game;
});

describe("Import Pivot character button", () => {
  it("stays hidden for a player", () => {
    installFoundry();
    (globalThis as { game?: { user?: { isGM?: boolean } } }).game = { user: { isGM: false } };
    let handler: ((app: unknown, html: HTMLElement) => void) | undefined;
    registerImportButton({
      on(_event, next) {
        handler = next;
      },
    });
    const view = directory();
    handler?.({}, view.html);
    expect(view.button?.listeners.click).toBeUndefined();
  });

  it("forces a repaint when the dialog opens and when the file is missing", async () => {
    installFoundry();
    (globalThis as { game?: { user?: { isGM?: boolean } } }).game = { user: { isGM: true } };
    let handler: ((app: unknown, html: HTMLElement) => void) | undefined;
    registerImportButton({
      on(_event, next) {
        handler = next;
      },
    });
    const view = directory();
    handler?.({}, view.html);
    expect(view.button?.textContent).toBe("Import Pivot character");

    view.button?.listeners.click?.({ preventDefault() {} });
    const dialog = dialogs[0];
    expect(dialog?.renders).toEqual([{ force: true }]);

    const form = {
      querySelector: () => ({ files: [] as File[] }),
    } as unknown as HTMLFormElement;
    await dialog?.constructor.onConfirm?.call(dialog, new Event("submit"), form);
    expect(dialog?.renders).toEqual([{ force: true }, { force: true }]);
  });

  it("ignores a second Confirm while the first import is still pending", async () => {
    installFoundry();
    let release: (value: { ok: true; value: { actorId: string } }) => void = () => {};
    const pending = new Promise<{ ok: true; value: { actorId: string } }>((resolve) => {
      release = resolve;
    });
    const createFromFile = vi.fn(() => pending);
    (globalThis as { game?: unknown }).game = {
      user: { isGM: true },
      pivot: { validate, createFromFile },
    };
    let handler: ((app: unknown, html: HTMLElement) => void) | undefined;
    registerImportButton({
      on(_event, next) {
        handler = next;
      },
    });
    const view = directory();
    handler?.({}, view.html);
    view.button?.listeners.click?.({ preventDefault() {} });
    const dialog = dialogs.at(-1);
    const form = {
      querySelector(selector: string) {
        if (selector.includes("file")) {
          return { files: [{ text: async () => JSON.stringify(veteran) }] };
        }
        return { value: "player-1" };
      },
    } as unknown as HTMLFormElement;
    const confirm = () => dialog?.constructor.onConfirm?.call(dialog, new Event("submit"), form);

    const first = confirm();
    await vi.waitFor(() => expect(createFromFile).toHaveBeenCalledTimes(1));
    const second = confirm();
    await Promise.resolve();
    expect(createFromFile).toHaveBeenCalledTimes(1);

    release({ ok: true, value: { actorId: "actor-1" } });
    await first;
    await second;
    expect(createFromFile).toHaveBeenCalledTimes(1);
  });

  it("blocks Confirm after a successful import", async () => {
    installFoundry();
    const createFromFile = vi.fn(async () => ({ ok: true, value: { actorId: "actor-1" } }));
    (globalThis as { game?: unknown }).game = {
      user: { isGM: true },
      pivot: { validate, createFromFile },
    };
    let handler: ((app: unknown, html: HTMLElement) => void) | undefined;
    registerImportButton({
      on(_event, next) {
        handler = next;
      },
    });
    const view = directory();
    handler?.({}, view.html);
    view.button?.listeners.click?.({ preventDefault() {} });
    const dialog = dialogs.at(-1);
    const form = {
      querySelector(selector: string) {
        if (selector.includes("file")) {
          return { files: [{ text: async () => JSON.stringify(veteran) }] };
        }
        return { value: "player-1" };
      },
    } as unknown as HTMLFormElement;
    const confirm = () => dialog?.constructor.onConfirm?.call(dialog, new Event("submit"), form);

    await confirm();
    expect(dialog?.kept).toBe(true);
    expect((await dialog?._prepareContext?.())?.kept).toBe(true);
    await confirm();
    expect(createFromFile).toHaveBeenCalledTimes(1);
  });

  it("lists the edited AC and MP before Confirm and then imports the file", async () => {
    installFoundry();
    const edited = structuredClone(elf) as { computed: { ac: number; mp: number } };
    const rules = structuredClone(edited.computed);
    edited.computed.ac = 16;
    edited.computed.mp = 20;
    const createFromFile = vi.fn(async () => ({ ok: true, value: { actorId: "actor-1" } }));
    (globalThis as { game?: unknown }).game = {
      user: { isGM: true },
      modules: {
        get: (id: string) =>
          id === "pivot-chargen" ? { active: true, api: { derive: () => rules } } : undefined,
      },
      pivot: { validate, createFromFile },
    };
    let handler: ((app: unknown, html: HTMLElement) => void) | undefined;
    registerImportButton({
      on(_event, next) {
        handler = next;
      },
    });
    const view = directory();
    handler?.({}, view.html);
    view.button?.listeners.click?.({ preventDefault() {} });
    const dialog = dialogs.at(-1);
    const form = {
      querySelector(selector: string) {
        if (selector.includes("file")) {
          return { files: [{ text: async () => JSON.stringify(edited) }] };
        }
        return { value: "player-1" };
      },
    } as unknown as HTMLFormElement;

    await dialog?.constructor.onPreview?.call(dialog, new Event("change"), form);
    expect(createFromFile).not.toHaveBeenCalled();
    expect(dialog?.warnings).toEqual(["AC: file 16, rules 14", "MP max: file 20, rules 15"]);
    expect(dialog?.note ?? "").toBe("");

    await dialog?.constructor.onConfirm?.call(dialog, new Event("submit"), form);
    expect(createFromFile).toHaveBeenCalledTimes(1);
    expect(createFromFile).toHaveBeenCalledWith(
      expect.objectContaining({ computed: expect.objectContaining({ ac: 16, mp: 20 }) }),
      "player-1",
    );
  });

  it("imports the previewed file after a repaint clears the form", async () => {
    installFoundry();
    const edited = structuredClone(elf) as { computed: { ac: number; mp: number } };
    const rules = structuredClone(edited.computed);
    edited.computed.ac = 16;
    edited.computed.mp = 20;
    const holder = {
      files: [{ text: async () => JSON.stringify(edited) }],
      owner: "player-1",
    };
    const createFromFile = vi.fn(async () => ({ ok: true, value: { actorId: "actor-1" } }));
    (globalThis as { game?: unknown }).game = {
      user: { isGM: true },
      modules: {
        get: (id: string) =>
          id === "pivot-chargen" ? { active: true, api: { derive: () => rules } } : undefined,
      },
      pivot: { validate, createFromFile },
    };
    let handler: ((app: unknown, html: HTMLElement) => void) | undefined;
    registerImportButton({
      on(_event, next) {
        handler = next;
      },
    });
    const view = directory();
    handler?.({}, view.html);
    view.button?.listeners.click?.({ preventDefault() {} });
    const dialog = dialogs.at(-1);
    if (!dialog) throw new Error("missing dialog");
    dialog.render = () => {
      holder.files = [];
      holder.owner = "";
      dialog.renders.push({ force: true });
    };
    const form = {
      querySelector(selector: string) {
        if (selector.includes("file")) return { files: holder.files };
        return { value: holder.owner };
      },
    } as unknown as HTMLFormElement;

    await dialog.constructor.onPreview?.call(dialog, new Event("change"), form);
    expect(holder.files).toEqual([]);
    expect(holder.owner).toBe("");
    expect(dialog.warnings).toEqual(["AC: file 16, rules 14", "MP max: file 20, rules 15"]);
    await dialog.constructor.onConfirm?.call(dialog, new Event("submit"), form);
    expect(createFromFile).toHaveBeenCalledWith(
      expect.objectContaining({ computed: expect.objectContaining({ ac: 16, mp: 20 }) }),
      "player-1",
    );
  });

  it("shows the generator note before Confirm when pivot-chargen is inactive", async () => {
    installFoundry();
    const createFromFile = vi.fn(async () => ({ ok: true, value: { actorId: "actor-1" } }));
    (globalThis as { game?: unknown }).game = {
      user: { isGM: true },
      pivot: { validate, createFromFile },
    };
    let handler: ((app: unknown, html: HTMLElement) => void) | undefined;
    registerImportButton({
      on(_event, next) {
        handler = next;
      },
    });
    const view = directory();
    handler?.({}, view.html);
    view.button?.listeners.click?.({ preventDefault() {} });
    const dialog = dialogs.at(-1);
    const form = {
      querySelector(selector: string) {
        if (selector.includes("file")) {
          return { files: [{ text: async () => JSON.stringify(veteran) }] };
        }
        return { value: "player-1" };
      },
    } as unknown as HTMLFormElement;

    await dialog?.constructor.onPreview?.call(dialog, new Event("change"), form);
    expect(createFromFile).not.toHaveBeenCalled();
    expect(dialog?.warnings ?? []).toEqual([]);
    expect(dialog?.note).toBe("Not checked against the character generator.");
    await dialog?.constructor.onConfirm?.call(dialog, new Event("submit"), form);
    expect(createFromFile).toHaveBeenCalledTimes(1);
  });
});
