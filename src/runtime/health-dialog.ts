import { SYSTEM_ID } from "../config";
import type { DamagePayload } from "./damage-roll";
import { healthTransactions, readSurvival, uniqueHealthTargets, type HealthActor } from "./health";
import { validAmount } from "../rules/survival";
import { createChat, escapeHtml, field, localize, prompt, runtime, warn } from "./ui";
interface MessageLike {
  id?: string;
  flags?: Record<string, unknown>;
}
export function readDamagePayload(message: MessageLike): DamagePayload | null {
  const flags = message.flags?.[SYSTEM_ID] as { survivalRoll?: unknown } | undefined;
  const p = flags?.survivalRoll as Partial<DamagePayload> | undefined;
  if (
    !p ||
    p.version !== 1 ||
    p.complete !== true ||
    !validAmount(p.amount) ||
    (p.kind !== "damage" && p.kind !== "healing") ||
    typeof p.critical !== "boolean" ||
    typeof p.actorUuid !== "string"
  )
    return null;
  return p as DamagePayload;
}
function targets(): HealthActor[] {
  const globals = globalThis as unknown as {
    canvas?: { tokens?: { controlled?: Array<{ actor?: HealthActor }> } };
    game?: { user?: { targets?: Iterable<{ actor?: HealthActor }> } };
  };
  return [
    ...(globals.canvas?.tokens?.controlled ?? []),
    ...Array.from(globals.game?.user?.targets ?? []),
  ].flatMap((token) => (token.actor ? [token.actor] : []));
}
async function resolveActor(uuid: string): Promise<HealthActor | null> {
  const globals = globalThis as unknown as {
    fromUuid?: (uuid: string) => Promise<HealthActor | null>;
  };
  return uuid ? ((await globals.fromUuid?.(uuid)) ?? null) : null;
}
export function installHealthChatHook(hooks: {
  on?: (
    name: "renderChatMessageHTML",
    callback: (message: MessageLike, html: HTMLElement) => void,
  ) => unknown;
}): void {
  hooks.on?.("renderChatMessageHTML", (message, html) => {
    const button = html.querySelector<HTMLButtonElement>("[data-pivot-apply]");
    if (!button) return;
    if (!readDamagePayload(message) || !message.id) {
      button.remove();
      return;
    }
    button.addEventListener("click", () => {
      void applyMessage(message);
    });
  });
}
async function applyMessage(message: MessageLike): Promise<void> {
  const payload = readDamagePayload(message);
  if (!payload || !message.id) return;
  try {
    const self = await resolveActor(payload.actorUuid);
    await previewHealth(message.id, payload.kind, payload.amount, payload.critical, self, () =>
      messagePayloadUnchanged(message.id ?? "", payload),
    );
  } catch {
    warn("ApplyFailed");
  }
}
export async function previewHealth(
  operation: string,
  kind: "damage" | "healing" | "temp",
  amount: number,
  critical: boolean,
  self: HealthActor | null,
  revalidate: () => boolean = () => true,
): Promise<void> {
  const actors = uniqueHealthTargets([...(self ? [self] : []), ...targets()]);
  if (!actors.length) {
    warn("NoTargets");
    return;
  }
  const gm = runtime().game?.user?.isGM === true;
  const preview = await prompt(
    "Preview",
    `<p>${localize("ManualReductions")}</p>
 <label>${localize("Amount")} <input name="amount" type="number" min="0" step="1" value="${amount}" ${gm ? "" : "readonly"}></label>
 <p>${localize(kind === "damage" ? "Damage" : kind === "healing" ? "Healing" : "Temp")}</p>
 ${actors.map((actor, index) => targetPreviewRow(actor, index, actor === self)).join("")}
 ${kind === "temp" ? `<label>${localize("TempChoice")} <select name="tempChoice"><option value="keep">${localize("Keep")}</option><option value="replace">${localize("Replace")}</option></select></label>` : ""}`,
    (form) => ({
      amount: Number(field(form, "amount")),
      selected: new FormData(form).getAll("target").map((value) => Number(value)),
      tempChoice:
        field(form, "tempChoice") === "replace" ? ("replace" as const) : ("keep" as const),
    }),
  );
  if (!preview) return;
  if (
    !validAmount(preview.amount) ||
    (!gm && preview.amount !== amount) ||
    (gm && runtime().game?.user?.isGM !== true)
  ) {
    warn("ApplyFailed");
    return;
  }
  const selected = actors.filter((_actor, index) => preview.selected.includes(index));
  // Resolve identities again after the dialog: never use DOM-supplied actor IDs.
  const refreshed: HealthActor[] = [];
  for (const actor of selected) {
    const current = await resolveActor(actor.uuid ?? "");
    if (current) refreshed.push(current);
    else warn("MissingTarget");
  }
  const results = await healthTransactions.apply(
    operation,
    refreshed,
    kind,
    preview.amount,
    critical,
    preview.tempChoice,
    revalidate,
  );
  const content = results
    .map(
      ({ actor, outcome }) => `<p>${escapeHtml(actor.name)}: ${escapeHtml(localize(outcome))}</p>`,
    )
    .join("");
  if (!results.length) return;
  // Failure to report never re-enters application; the transaction has already been consumed.
  try {
    await createChat({
      content: `<h3>${localize("ApplicationResult")}</h3>${content}<p>${localize("ManualConsequences")}</p>`,
    });
  } catch {
    warn("ReportFailed");
  }
}
export async function tempHpDialog(actor: HealthActor): Promise<void> {
  const amount = await prompt(
    "Temp",
    `<label>${localize("Amount")} <input type="number" name="amount" min="0" step="1" value="0"></label>`,
    (form) => Number(field(form, "amount")),
  );
  if (amount === null) return;
  if (!validAmount(amount)) {
    warn("ApplyFailed");
    return;
  }
  await previewHealth(crypto.randomUUID(), "temp", amount, false, actor);
}

export function messagePayloadUnchanged(id: string, expected: DamagePayload): boolean {
  const globals = globalThis as unknown as {
    game?: { messages?: { get(id: string): MessageLike | undefined } };
  };
  const message = globals.game?.messages?.get(id);
  const current = message ? readDamagePayload(message) : null;
  return (
    current !== null &&
    current.version === expected.version &&
    current.complete === expected.complete &&
    current.amount === expected.amount &&
    current.kind === expected.kind &&
    current.critical === expected.critical &&
    current.actorUuid === expected.actorUuid
  );
}

export function targetPreviewRow(actor: HealthActor, index: number, checked: boolean): string {
  const name = escapeHtml(actor.name);
  if (actor.isOwner !== true)
    return `<label><input type="checkbox" disabled>${name} — ${escapeHtml(localize("denied"))}</label>`;
  const state = readSurvival(actor);
  return `<label><input type="checkbox" name="target" value="${index}" ${checked ? "checked" : ""}>${name} — HP ${state.hp}/${state.max}, ${localize("Temp")} ${state.temp} (${escapeHtml(localize(state.status))})</label>`;
}
