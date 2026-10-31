import { prepareCharacterSheetContext, type ActorLike } from "../sheets/character-sheet";
import { createFromFile } from "./create-from-file";
import {
  compareDrift,
  IMPORT_MESSAGES,
  validate,
  type DriftLine,
  type PreparedSnapshot,
  type ValidateOptions,
} from "./pivot-character";

const TEMPLATE = "systems/pivot-fantasy/templates/import/import-dialog.hbs";
const BUTTON_KEY = "PIVOT.Import.Button";
const BUTTON_LABEL = "Import Pivot character";

type AnyConstructor = new (...args: never[]) => object;

interface DialogState {
  creating: boolean;
  error: string;
  kept: boolean;
  drift: DriftLine[];
  showDrift: boolean;
  render(options?: { force?: boolean }): unknown;
}

interface ImportGame {
  user?: { isGM?: boolean };
  users?: { contents?: Array<{ id?: string; name?: string }> };
  i18n?: { localize?: (key: string) => string };
  modules?: {
    get?: (
      id: string,
    ) => { active?: boolean; api?: { derive?: ValidateOptions["rederive"] } } | undefined;
  };
  actors?: { get?: (id: string) => ActorLike | undefined };
  pivot?: {
    validate?: typeof validate;
    createFromFile?: typeof createFromFile;
  };
}

let dialogClass: (new () => DialogState) | undefined;

export function registerImportButton(hooks: {
  on?(event: "renderActorDirectory", handler: (app: unknown, html: HTMLElement) => void): void;
}): void {
  hooks.on?.("renderActorDirectory", (_app, html) => {
    if (readGame()?.user?.isGM !== true) return;
    if (html.querySelector("[data-pivot-import]")) return;
    const actions = html.querySelector(".header-actions");
    if (!actions) return;
    const sample = actions.querySelector("button");
    const button = html.ownerDocument.createElement("button");
    button.type = "button";
    button.className = sample?.className ?? "";
    button.setAttribute("data-pivot-import", "");
    button.textContent = buttonLabel();
    button.addEventListener("click", (event) => {
      event.preventDefault();
      openImportDialog();
    });
    actions.append(button);
  });
}

export function readPrepared(actorId: string): PreparedSnapshot {
  const actor = readGame()?.actors?.get?.(actorId);
  if (!actor) throw new Error("missing actor");
  const derived = prepareCharacterSheetContext(actor).derived;
  return {
    ac: derived.armourClass.value,
    poolMax: derived.pool.max,
    mpMax: derived.magic.mp.max,
    speed: derived.speed,
  };
}

function openImportDialog(): void {
  const Dialog = dialogConstructor();
  if (!Dialog) return;
  const dialog = new Dialog();
  void dialog.render({ force: true });
}

function dialogConstructor(): (new () => DialogState) | undefined {
  if (dialogClass) return dialogClass;
  const api = (
    globalThis as {
      foundry?: {
        applications?: {
          api?: {
            ApplicationV2?: AnyConstructor;
            HandlebarsApplicationMixin?: (base: AnyConstructor) => AnyConstructor;
          };
        };
      };
    }
  ).foundry?.applications?.api;
  if (!api?.ApplicationV2 || !api.HandlebarsApplicationMixin) return undefined;

  const Base = api.HandlebarsApplicationMixin(api.ApplicationV2);

  class ImportPivotDialog extends Base {
    creating = false;
    error = "";
    kept = false;
    drift: DriftLine[] = [];
    showDrift = false;

    static DEFAULT_OPTIONS = {
      classes: ["pivot-fantasy", "pf-import"],
      tag: "form",
      position: { width: 480 },
      window: { title: "PIVOT.Import.Title" },
      form: {
        closeOnSubmit: false,
        handler: ImportPivotDialog.onConfirm,
      },
    };

    static PARTS = {
      form: { template: TEMPLATE },
    };

    render(options?: { force?: boolean }): unknown {
      const parent = Object.getPrototypeOf(ImportPivotDialog.prototype) as {
        render?: (this: unknown, options?: { force?: boolean }) => unknown;
      };
      return parent.render?.call(this, options);
    }

    async _prepareContext(): Promise<{
      users: Array<{ id: string; name: string }>;
      error: string;
      kept: boolean;
      drift: DriftLine[];
      showDrift: boolean;
    }> {
      return {
        users: listUsers(),
        error: this.error,
        kept: this.kept,
        drift: this.drift,
        showDrift: this.showDrift,
      };
    }

    static async onConfirm(
      this: ImportPivotDialog,
      event: Event,
      form: HTMLFormElement,
    ): Promise<void> {
      event.preventDefault();
      if (this.creating || this.kept) return;
      this.creating = true;
      try {
        await importFile(this, form);
      } finally {
        this.creating = false;
      }
    }
  }

  dialogClass = ImportPivotDialog;
  return dialogClass;
}

async function importFile(dialog: DialogState, form: HTMLFormElement): Promise<void> {
  const input = form.querySelector<HTMLInputElement>('input[type="file"]');
  const selected = input?.files?.[0];
  if (!selected) {
    show(dialog, IMPORT_MESSAGES.malformed, false, []);
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await selected.text());
  } catch {
    show(dialog, IMPORT_MESSAGES.malformed, false, []);
    return;
  }

  const game = readGame();
  const validateFile = game?.pivot?.validate ?? validate;
  const rederive = chargenDerive(game);
  const result = validateFile(parsed, rederive ? { rederive } : undefined);
  if (!result.ok) {
    show(dialog, result.error.message, false, []);
    return;
  }

  const owner = form.querySelector<HTMLSelectElement>('select[name="ownerUserId"]')?.value ?? "";
  const create = game?.pivot?.createFromFile ?? createFromFile;
  let created: Awaited<ReturnType<typeof createFromFile>>;
  try {
    created = await create(parsed, owner);
  } catch {
    show(dialog, IMPORT_MESSAGES.incomplete, false, []);
    return;
  }
  if (!created.ok) {
    show(dialog, created.error.message, false, []);
    return;
  }

  const lines = driftLines(result.value, created.value.actorId);
  show(dialog, "", true, lines);
}

function driftLines(character: Parameters<typeof compareDrift>[0], actorId: string): DriftLine[] {
  try {
    return compareDrift(character, readPrepared(actorId));
  } catch {
    return [];
  }
}

function show(dialog: DialogState, error: string, kept: boolean, drift: DriftLine[]): void {
  dialog.error = error;
  dialog.kept = kept;
  dialog.drift = drift;
  dialog.showDrift = drift.length > 0;
  void dialog.render({ force: true });
}

function chargenDerive(game: ImportGame | undefined): ValidateOptions["rederive"] {
  const module = game?.modules?.get?.("pivot-chargen");
  if (module?.active && typeof module.api?.derive === "function") return module.api.derive;
  return undefined;
}

function listUsers(): Array<{ id: string; name: string }> {
  const contents = readGame()?.users?.contents;
  if (!Array.isArray(contents)) return [];
  const users: Array<{ id: string; name: string }> = [];
  for (const user of contents) {
    if (!user || typeof user.id !== "string" || user.id.length === 0) continue;
    const name = typeof user.name === "string" && user.name.length > 0 ? user.name : user.id;
    users.push({ id: user.id, name });
  }
  return users;
}

function buttonLabel(): string {
  const localized = readGame()?.i18n?.localize?.(BUTTON_KEY);
  if (!localized || localized === BUTTON_KEY) return BUTTON_LABEL;
  return localized;
}

function readGame(): ImportGame | undefined {
  return (globalThis as { game?: ImportGame }).game;
}
