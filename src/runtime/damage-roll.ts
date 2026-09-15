import { SYSTEM_ID } from "../config";
import { parseExplodingFormula, rollExploding } from "../rules/exploding-roll";
import { escapeHtml, field, localize, prompt, runtime, warn } from "./ui";

export interface DamagePayload {
  version: 1;
  complete: true;
  amount: number;
  kind: "damage" | "healing";
  critical: boolean;
  actorUuid: string;
}
export async function damageRollDialog(
  actor: { name: string; uuid?: string },
  formula = "1d6",
): Promise<void> {
  const input = await prompt(
    "RollTitle",
    `<label>${localize("Formula")} <input name="formula" value="${escapeHtml(formula)}"></label>
    <label>${localize("Kind")} <select name="kind"><option value="damage">${localize("Damage")}</option><option value="healing">${localize("Healing")}</option></select></label>
    <label><input type="checkbox" name="critical">${localize("Critical")}</label>
    <label><input type="checkbox" name="enhanced">${localize("Enhanced")}</label>`,
    (form) => ({
      formula: field(form, "formula"),
      kind: field(form, "kind") === "healing" ? ("healing" as const) : ("damage" as const),
      critical: field(form, "critical") === "on",
      enhanced: field(form, "enhanced") === "on",
    }),
    "Roll",
  );
  if (!input) return;
  const Roll = runtime().Roll;
  if (!Roll) return;
  try {
    if (!parseExplodingFormula(input.formula)) {
      const fallback = await prompt(
        "OrdinaryTitle",
        `<p>${localize("OrdinaryWarning")}</p><p>${escapeHtml(input.formula)}</p>`,
        () => true,
        "OrdinaryRoll",
      );
      if (!fallback) return;
      const ordinary = new Roll(input.formula);
      await ordinary.evaluate();
      await ordinary.toMessage({
        speaker: { alias: actor.name },
        flavor: escapeHtml(localize("OrdinaryWarning")),
      });
      return;
    }
    const result = await rollExploding(
      input.formula,
      { critical: input.kind === "damage" && input.critical, enhanced: input.enhanced },
      async (faces) => {
        const die = new Roll(`1d${faces}`);
        await die.evaluate();
        if (die.total === undefined) throw new Error("Incomplete");
        return die.total;
      },
    );
    const content = `<section class="pivot-survival-roll"><h3>${escapeHtml(actor.name)} — ${localize(input.kind === "damage" ? "Damage" : "Healing")}</h3>
      <p>${escapeHtml(input.formula)} ${input.critical && input.kind === "damage" ? localize("Critical") : ""} ${input.enhanced ? localize("Enhanced") : ""}</p>
      <p>${result.chains.map((chain) => `d${chain.faces}: [${chain.results.join(" → ")}]`).join("; ")} ${result.modifier >= 0 ? "+" : ""}${result.modifier}</p>
      <strong>${result.complete ? result.total : localize("Incomplete")}</strong>
      ${result.complete ? `<button type="button" data-pivot-apply>${localize("Apply")}</button>` : ""}</section>`;
    const payload: DamagePayload | null =
      result.complete && result.total !== null
        ? {
            version: 1,
            complete: true,
            amount: result.total,
            kind: input.kind,
            critical: input.kind === "damage" && input.critical,
            actorUuid: actor.uuid ?? "",
          }
        : null;
    await runtime().ChatMessage?.create({
      speaker: { alias: actor.name },
      content,
      flags: { [SYSTEM_ID]: { survivalRoll: payload } },
    });
  } catch {
    warn("RollFailed");
  }
}
