import { JSDOM } from "jsdom";
import { afterEach, expect, it, vi } from "vitest";
import { damageRollDialog } from "../../src/runtime/damage-roll";
import {
  createPivotCharacterSheetClass,
  prepareCharacterSheetContext,
} from "../../src/sheets/character-sheet";

interface StackedDialog {
  element: HTMLElement;
  bringToFront: () => void;
}

interface PromptConfig {
  content?: unknown;
  render?: (event: unknown, dialog: StackedDialog) => void;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function openBehindSheet(config: PromptConfig): HTMLElement {
  const { document } = new JSDOM("<!doctype html><html><body></body></html>").window;
  const sheet = document.createElement("section");
  sheet.dataset.sheet = "character";
  sheet.style.zIndex = "40";
  document.body.append(sheet);

  const element = document.createElement("section");
  element.className = "application";
  const content = typeof config.content === "string" ? config.content : "";
  element.innerHTML = `<header class="window-header"><button type="button">Close</button></header><div class="window-content">${content}</div>`;
  element.style.zIndex = "1";
  document.body.append(element);

  config.render?.(new Event("render"), {
    element,
    bringToFront() {
      const tops = [...document.body.querySelectorAll("section")].map(
        (node) => Number((node as HTMLElement).style.zIndex) || 0,
      );
      element.style.zIndex = String(Math.max(...tops) + 1);
    },
  });
  return element;
}

function expectInFrontAndFocused(element: HTMLElement): void {
  const sheet = element.ownerDocument.querySelector("[data-sheet='character']");
  expect(Number(element.style.zIndex)).toBeGreaterThan(Number((sheet as HTMLElement).style.zIndex));
  const content = element.querySelector(".window-content");
  expect(content?.contains(element.ownerDocument.activeElement)).toBe(true);
}

function installDialog(): HTMLElement[] {
  const opened: HTMLElement[] = [];
  vi.stubGlobal(
    "Roll",
    class {
      async evaluate() {
        return this;
      }
    },
  );
  vi.stubGlobal("foundry", {
    applications: {
      api: {
        DialogV2: {
          prompt: async (config: PromptConfig) => {
            opened.push(openBehindSheet(config));
            return null;
          },
        },
      },
    },
  });
  return opened;
}

async function rollFromSheet(kind: string, key: string): Promise<void> {
  const actor = {
    name: "Hero",
    type: "character",
    system: {
      progression: { level: 1 },
      abilities: { str: { score: 10, primary: true } },
      skills: {},
    },
    items: [],
  };
  prepareCharacterSheetContext(actor);
  const SheetClass = createPivotCharacterSheetClass({
    applications: {
      api: { HandlebarsApplicationMixin: (base: unknown) => base },
      sheets: {
        // eslint-disable-next-line @typescript-eslint/no-extraneous-class
        ActorSheetV2: class ActorSheetV2 {
          static DEFAULT_OPTIONS = {};
        },
      },
    },
  } as never);
  const sheet = new SheetClass();
  Object.defineProperty(sheet, "document", { value: actor, writable: true });
  const rollAction = (SheetClass as { DEFAULT_OPTIONS?: { actions?: { roll?: unknown } } })
    .DEFAULT_OPTIONS?.actions?.roll as (
    this: unknown,
    event: Event,
    target: { dataset: Record<string, string> },
  ) => Promise<void>;
  await rollAction.call(sheet, new Event("click"), {
    dataset: { rollKind: kind, key, label: kind },
  });
}

it("brings ability, skill, and attack roll dialogs in front of the sheet and focuses them", async () => {
  const opened = installDialog();
  await rollFromSheet("ability", "str");
  await rollFromSheet("skill", "athletics");
  await rollFromSheet("weaponAttack", "sword");
  expect(opened).toHaveLength(3);
  for (const element of opened) expectInFrontAndFocused(element);
});

it("brings the attack damage dialog in front of the sheet and focuses it", async () => {
  const opened = installDialog();
  await damageRollDialog({ name: "Hero" }, "1d6");
  expect(opened).toHaveLength(1);
  expectInFrontAndFocused(opened[0] as HTMLElement);
});
