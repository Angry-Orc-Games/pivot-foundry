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
  Roll?: new (formula: string) => RuntimeRoll;
  ChatMessage?: { create(data: Record<string, unknown>): Promise<unknown> };
  ui?: { notifications?: { warn(message: string): void } };
}
export function runtime(): RuntimeGlobals {
  return globalThis as unknown as RuntimeGlobals;
}
export function warn(key: string): void {
  runtime().ui?.notifications?.warn(localize(key));
}
export async function prompt<T>(
  title: string,
  content: string,
  read: (form: HTMLFormElement) => T,
  label = "Confirm",
): Promise<T | null> {
  const dialog = runtime().foundry?.applications?.api?.DialogV2;
  if (!dialog) return null;
  try {
    return (await dialog.prompt({
      window: { title: localize(title) },
      content,
      ok: {
        label: localize(label),
        callback: (_event: unknown, button: { form?: HTMLFormElement }) =>
          button.form ? read(button.form) : null,
      },
      buttons: [{ action: "cancel", label: localize("Cancel"), callback: () => null }],
      rejectClose: false,
    })) as T | null;
  } catch {
    return null;
  }
}
export function field(form: HTMLFormElement, name: string): string {
  return String(new FormData(form).get(name) ?? "");
}
