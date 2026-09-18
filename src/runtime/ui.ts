export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
export function localize(key: string): string {
  return runtime().game?.i18n?.localize?.(`PIVOT.Survival.${key}`) ?? key;
}
export interface RuntimeRoll {
  total?: number;
  dice?: Array<{ faces?: number; results?: Array<{ result?: number }> }>;
  evaluate(): Promise<unknown>;
  toMessage(data: Record<string, unknown>): Promise<unknown>;
}
export interface RuntimeGlobals {
  game?: { user?: { id?: string; isGM?: boolean }; i18n?: { localize?: (key: string) => string } };
  foundry?: {
    applications?: {
      api?: { DialogV2?: { prompt(config: Record<string, unknown>): Promise<unknown> } };
    };
  };
  Roll?: new (formula: string, data?: Record<string, unknown>) => RuntimeRoll;
  ChatMessage?: {
    create(data: Record<string, unknown>): Promise<unknown>;
    applyRollMode?(data: Record<string, unknown>, mode: string): unknown;
  };
  ui?: { notifications?: { warn(message: string): void } };
}
export function runtime(): RuntimeGlobals {
  return globalThis as unknown as RuntimeGlobals;
}
export function warn(key: string): void {
  runtime().ui?.notifications?.warn(localize(key));
}
export interface PromptOptions {
  localizeTitlesAndButtons?: boolean;
  cancelLabel?: string;
}

export async function prompt<T>(
  title: string,
  content: string,
  read: (form: HTMLFormElement) => T,
  label = "Confirm",
  options: PromptOptions = {},
): Promise<T | null> {
  const dialog = runtime().foundry?.applications?.api?.DialogV2;
  if (!dialog) return null;

  const shouldLocalize = options.localizeTitlesAndButtons ?? true;
  const windowTitle = shouldLocalize ? localize(title) : title;
  const okLabel = shouldLocalize ? localize(label) : label;
  const cancelLabel = options.cancelLabel ?? (shouldLocalize ? localize("Cancel") : "Cancel");

  try {
    return (await dialog.prompt({
      window: { title: windowTitle },
      content,
      ok: {
        label: okLabel,
        callback: (_event: unknown, button: { form?: HTMLFormElement }) =>
          button.form ? read(button.form) : null,
      },
      buttons: [{ action: "cancel", label: cancelLabel, callback: () => null }],
      rejectClose: false,
    })) as T | null;
  } catch {
    return null;
  }
}
export function field(form: HTMLFormElement, name: string): string {
  return String(new FormData(form).get(name) ?? "");
}

export async function createChat(data: Record<string, unknown>): Promise<unknown> {
  const Chat = runtime().ChatMessage;
  if (!Chat) throw new Error("Chat unavailable");
  Chat.applyRollMode?.(data, "roll");
  return Chat.create(data);
}
