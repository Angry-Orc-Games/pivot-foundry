import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { registerImportButton } from "../../src/import/import-dialog";
import { validate } from "../../src/import/pivot-character";

const veteran = JSON.parse(
  readFileSync(new URL("./fixtures/human-veteran.pivot.json", import.meta.url), "utf8"),
);

interface RenderedDialog {
  renders: Array<{ force?: boolean } | undefined>;
  constructor: {
    onConfirm?: (this: RenderedDialog, event: Event, form: HTMLFormElement) => Promise<void>;
  };
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

  it("does not create a second actor when Confirm is clicked again", async () => {
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

    await dialog?.constructor.onConfirm?.call(dialog, new Event("submit"), form);
    await dialog?.constructor.onConfirm?.call(dialog, new Event("submit"), form);
    expect(createFromFile).toHaveBeenCalledTimes(1);
  });
});
