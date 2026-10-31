import { prepareCharacterSheetContext, type ActorLike } from "../sheets/character-sheet";
import { createFromFile } from "./create-from-file";
import {
  compareDrift,
  IMPORT_MESSAGES,
  mismatchWarning,
  notCheckedWarning,
  toActorData,
  validate,
  type ImportWarning,
  type PivotCharacter,
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
  warnings: string[];
  note: string;
  showWarnings: boolean;
  pending: { file: unknown; owner: string } | null;
  element?: HTMLElement;
  render(options?: { force?: boolean }): unknown;
}

interface WorldUser {
  id?: string;
  name?: string;
  role?: number;
  active?: boolean;
}

interface ImportGame {
  user?: { isGM?: boolean };
  users?: {
    contents?: WorldUser[];
    filter?: (predicate: (user: WorldUser) => boolean) => WorldUser[];
  };
  i18n?: { localize?: (key: string) => string };
  modules?: {
    get?: (id: string) =>
      | {
          active?: boolean;
          api?: {
            deriveComputed?: ValidateOptions["rederive"];
            deriveComputedVersion?: number;
          };
        }
      | undefined;
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
    warnings: string[] = [];
    note = "";
    showWarnings = false;
    pending: { file: unknown; owner: string } | null = null;

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
      warnings: string[];
      note: string;
      showWarnings: boolean;
    }> {
      return {
        users: listUsers(),
        error: this.error,
        kept: this.kept,
        warnings: this.warnings,
        note: this.note,
        showWarnings: this.showWarnings,
      };
    }

    async _onRender(...args: unknown[]): Promise<void> {
      const parent = Object.getPrototypeOf(ImportPivotDialog.prototype) as {
        _onRender?: (this: unknown, ...args: unknown[]) => unknown;
      };
      await parent._onRender?.apply(this, args);
      const form = (this as { element?: HTMLElement }).element;
      const input = form?.querySelector?.('input[name="pivotFile"]');
      if (!(input instanceof HTMLInputElement) || input.dataset.pivotBound === "1") return;
      input.dataset.pivotBound = "1";
      input.addEventListener("change", (event) => {
        const current = input.closest("form");
        if (current) void ImportPivotDialog.onPreview.call(this, event, current);
      });
    }

    static async onPreview(
      this: ImportPivotDialog,
      event: Event,
      form: HTMLFormElement,
    ): Promise<void> {
      event.preventDefault();
      if (this.creating || this.kept) return;
      await previewFile(this, form);
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

async function previewFile(dialog: DialogState, form: HTMLFormElement): Promise<void> {
  const read = await readSelected(form);
  if (!read.ok) {
    dialog.pending = null;
    dialog.error = read.error;
    dialog.warnings = [];
    dialog.note = "";
    dialog.showWarnings = false;
    paintPreview(dialog);
    return;
  }

  const game = readGame();
  const validateFile = game?.pivot?.validate ?? validate;
  const rederive = chargenDerive(game);
  const result = validateFile(read.value, rederive ? { rederive } : undefined);
  if (!result.ok) {
    dialog.pending = null;
    dialog.error = result.error.message;
    dialog.warnings = [];
    dialog.note = "";
    dialog.showWarnings = false;
    paintPreview(dialog);
    return;
  }

  const witness = result.warnings ?? [];
  const unchecked = witness.find((warning) => warning.code === "unverifiable");
  const mismatches = mergeWarnings(
    witness.filter((warning) => warning.code === "tampered"),
    sheetWarnings(result.value),
  );
  dialog.pending = { file: read.value, owner: selectedOwner(form) };
  dialog.warnings = mismatches.map((warning) => warning.message);
  dialog.showWarnings = dialog.warnings.length > 0;
  dialog.note = unchecked?.message ?? (rederive ? "" : notCheckedWarning().message);
  dialog.error = "";
  // A mounted form is updated in place. Replacing the template would drop the file input.
  paintPreview(dialog);
}

async function importFile(dialog: DialogState, form: HTMLFormElement): Promise<void> {
  const read = await readSelected(form);
  const file = read.ok ? read.value : dialog.pending?.file;
  if (file === undefined) {
    show(dialog, read.ok ? IMPORT_MESSAGES.malformed : read.error, false);
    return;
  }

  const game = readGame();
  const validateFile = game?.pivot?.validate ?? validate;
  const rederive = chargenDerive(game);
  const result = validateFile(file, rederive ? { rederive } : undefined);
  if (!result.ok) {
    show(dialog, result.error.message, false);
    return;
  }

  const owner = selectedOwner(form) || dialog.pending?.owner || "";
  const create = game?.pivot?.createFromFile ?? createFromFile;
  let created: Awaited<ReturnType<typeof createFromFile>>;
  try {
    created = await create(file, owner);
  } catch {
    show(dialog, IMPORT_MESSAGES.incomplete, false);
    return;
  }
  if (!created.ok) {
    show(dialog, created.error.message, false);
    return;
  }

  show(dialog, "", true);
}

async function readSelected(
  form: HTMLFormElement,
): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
  const input = form.querySelector<HTMLInputElement>('input[type="file"]');
  const selected = input?.files?.[0];
  if (!selected) return { ok: false, error: IMPORT_MESSAGES.malformed };
  try {
    return { ok: true, value: JSON.parse(await selected.text()) };
  } catch {
    return { ok: false, error: IMPORT_MESSAGES.malformed };
  }
}

function sheetWarnings(character: PivotCharacter): ImportWarning[] {
  const draft = toActorData(character);
  const context = prepareCharacterSheetContext({
    name: draft.actor.name,
    type: draft.actor.type,
    system: draft.actor.system as unknown as ActorLike["system"],
    items: draft.items.map((item) => ({
      name: item.name,
      type: item.type,
      system: item.system as unknown as ActorLike["system"],
    })),
  });
  return compareDrift(character, {
    ac: context.derived.armourClass.value,
    poolMax: context.derived.pool.max,
    mpMax: context.derived.magic.mp.max,
    speed: context.derived.speed,
  }).map((line) => mismatchWarning(line.field, line.file, line.sheet));
}

function mergeWarnings(primary: ImportWarning[], extra: ImportWarning[]): ImportWarning[] {
  const seen = new Set(primary.flatMap((warning) => (warning.field ? [warning.field] : [])));
  return [
    ...primary,
    ...extra.filter((warning) => warning.field === undefined || !seen.has(warning.field)),
  ];
}

function selectedOwner(form: HTMLFormElement): string {
  return form.querySelector<HTMLSelectElement>('select[name="ownerUserId"]')?.value ?? "";
}

function paintPreview(dialog: DialogState): void {
  const form = dialog.element;
  const input = form?.querySelector?.('input[name="pivotFile"]');
  if (!form?.ownerDocument || !input) {
    void dialog.render({ force: true });
    return;
  }
  clearRenderedMessages(form);
  const box = previewBox(form);
  box.replaceChildren();
  const doc = form.ownerDocument;
  if (dialog.error) box.append(messageParagraph(doc, "pf-import-error", dialog.error));
  if (dialog.note) box.append(messageParagraph(doc, "pf-import-note", dialog.note));
  if (dialog.showWarnings) {
    const list = doc.createElement("ul");
    list.className = "pf-import-drift";
    for (const line of dialog.warnings) {
      const item = doc.createElement("li");
      item.textContent = line;
      list.append(item);
    }
    box.append(list);
  }
}

function previewBox(form: HTMLElement): HTMLElement {
  const existing = form.querySelector("[data-pivot-preview]");
  if (existing) return existing as HTMLElement;
  const box = form.ownerDocument.createElement("div");
  box.setAttribute("data-pivot-preview", "");
  const submit = form.querySelector('button[type="submit"]');
  // The window root is the form. The button lives in the sheet body, so insert beside it.
  const parent = submit?.parentElement;
  if (submit && parent) parent.insertBefore(box, submit);
  else form.append(box);
  return box;
}

function clearRenderedMessages(form: HTMLElement): void {
  for (const node of form.querySelectorAll(".pf-import-error, .pf-import-note, .pf-import-drift")) {
    if (node.closest("[data-pivot-preview]")) continue;
    node.remove();
  }
}

function messageParagraph(doc: Document, className: string, text: string): HTMLParagraphElement {
  const paragraph = doc.createElement("p");
  paragraph.className = className;
  paragraph.textContent = text;
  return paragraph;
}

function show(dialog: DialogState, error: string, kept: boolean): void {
  dialog.error = error;
  dialog.kept = kept;
  void dialog.render({ force: true });
}

const DERIVE_COMPUTED_VERSION = 1;

function chargenDerive(game: ImportGame | undefined): ValidateOptions["rederive"] {
  const module = game?.modules?.get?.("pivot-chargen");
  const deriveComputed = module?.api?.deriveComputed;
  if (!module?.active || typeof deriveComputed !== "function") return undefined;
  if (module.api?.deriveComputedVersion !== DERIVE_COMPUTED_VERSION) return undefined;
  return deriveComputed;
}

function listUsers(): Array<{ id: string; name: string }> {
  const users: Array<{ id: string; name: string }> = [];
  for (const user of selectableUsers(readGame())) {
    if (!user || typeof user.id !== "string" || user.id.length === 0) continue;
    if (user.active === false) continue;
    if (typeof user.role === "number" && user.role === noneRole()) continue;
    const name = typeof user.name === "string" && user.name.length > 0 ? user.name : user.id;
    users.push({ id: user.id, name });
  }
  return users;
}

function selectableUsers(game: ImportGame | undefined): WorldUser[] {
  const filter = game?.users?.filter;
  if (typeof filter === "function") {
    const active = filter((user) => user.active === true);
    return Array.isArray(active) ? active : [];
  }
  const contents = game?.users?.contents;
  return Array.isArray(contents) ? contents : [];
}

function noneRole(): number {
  const role = (globalThis as { CONST?: { USER_ROLES?: { NONE?: number } } }).CONST?.USER_ROLES
    ?.NONE;
  return typeof role === "number" ? role : 0;
}

function buttonLabel(): string {
  const localized = readGame()?.i18n?.localize?.(BUTTON_KEY);
  if (!localized || localized === BUTTON_KEY) return BUTTON_LABEL;
  return localized;
}

function readGame(): ImportGame | undefined {
  return (globalThis as { game?: ImportGame }).game;
}
