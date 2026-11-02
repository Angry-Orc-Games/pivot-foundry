import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import { registerImportButton } from "../../src/import/import-dialog";
import { validate } from "../../src/import/pivot-character";
import { derive } from "./fixtures/pivot-chargen-c39605e/index";

// Real pivot-chargen #47 module API.
// Source: Angry-Orc-Games/pivot-chargen, branch cursor/module-scaffold-ci-c630,
// commit c39605e17648a316cf8d00b34e80a7ee66fcfecf.
// Vendored unmodified packages/rules/src/book.js (git blob 4a4c9bacbee2897097612aafe60940e04f54a859).
// That commit's api is { derive }, where derive is createSession(choices, false).derive().
// It has no deriveComputed export.
const SAMPLES = [
  "human-veteran.pivot.json",
  "elf-street-mage.pivot.json",
  "dwarf-recluse.pivot.json",
  "custom-humanoid.pivot.json",
] as const;

interface RenderedDialog {
  warnings?: string[];
  note?: string;
  constructor: {
    onPreview?: (this: RenderedDialog, event: Event, form: HTMLFormElement) => Promise<void>;
  };
}

const dialogs: RenderedDialog[] = [];

class ApplicationV2 {
  constructor() {
    dialogs.push(this as unknown as RenderedDialog);
  }

  render(): void {}
}

afterEach(() => {
  dialogs.length = 0;
  delete (globalThis as { foundry?: unknown }).foundry;
  delete (globalThis as { game?: unknown }).game;
});

describe("pivot-chargen #47 witness", () => {
  it.each(SAMPLES)(
    "%s gives zero field warnings and the not-checked note when the real module is active",
    async (name) => {
      const file = JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8"));
      const deriveSpy = vi.fn(derive);
      install(deriveSpy);
      const dialog = open();
      await dialog.constructor.onPreview?.call(
        dialog,
        new Event("change"),
        form(JSON.stringify(file)),
      );
      expect(deriveSpy).not.toHaveBeenCalled();
      expect(dialog.warnings ?? []).toEqual([]);
      expect(dialog.note).toBe("Not checked against the character generator.");
    },
  );
});

function install(deriveSpy: (choices: unknown) => unknown): void {
  (globalThis as { foundry?: unknown }).foundry = {
    applications: {
      api: {
        ApplicationV2,
        HandlebarsApplicationMixin: (base: new (...args: never[]) => object) =>
          class extends base {},
      },
    },
  };
  (globalThis as { game?: unknown }).game = {
    user: { isGM: true },
    modules: {
      get: (id: string) =>
        id === "pivot-chargen" ? { active: true, api: { derive: deriveSpy } } : undefined,
    },
    pivot: { validate },
  };
}

function open(): RenderedDialog {
  let handler: ((app: unknown, html: HTMLElement) => void) | undefined;
  registerImportButton({
    on(_event, next) {
      handler = next;
    },
  });
  const button = {
    textContent: "",
    listeners: {} as Record<string, (event: { preventDefault(): void }) => void>,
    setAttribute() {},
    addEventListener(name: string, fn: (event: { preventDefault(): void }) => void) {
      button.listeners[name] = fn;
    },
  };
  const html = {
    querySelector(selector: string) {
      if (selector === "[data-pivot-import]") return null;
      if (selector === ".header-actions") {
        return { querySelector: () => ({ className: "header-control" }), append() {} };
      }
      return null;
    },
    ownerDocument: { createElement: () => button },
  };
  handler?.({}, html as unknown as HTMLElement);
  button.listeners.click?.({ preventDefault() {} });
  const dialog = dialogs.at(-1);
  if (!dialog) throw new Error("missing dialog");
  return dialog;
}

function form(fileText: string): HTMLFormElement {
  return {
    querySelector(selector: string) {
      if (selector.includes("file")) return { files: [{ text: async () => fileText }] };
      return { value: "player-1" };
    },
  } as unknown as HTMLFormElement;
}
