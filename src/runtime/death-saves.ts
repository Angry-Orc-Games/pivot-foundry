import { dicePoolForRollMode, d20PoolFormula, selectKeptD20 } from "../rules/d20-roll";
import {
  correctSurvival,
  DyingAboveZeroError,
  resolveDeathSave,
  SURVIVAL_STATUSES,
  type SurvivalStatus,
} from "../rules/survival";
import { runSurvivalTransaction, type SurvivalActor } from "./survival-transaction";
import { createChat, escapeHtml, field, localize, prompt, runtime, warn } from "./ui";
import { promptRollMode } from "../sheets/character-sheet";
import { waitForDiceSoNiceAnimation } from "./dice-so-nice";

export async function deathSaveDialog(actor: SurvivalActor): Promise<void> {
  let faces: number[] = [];
  let natural = 0;
  let mode = "";
  let rolled: unknown = null;
  const { outcome, after } = await runSurvivalTransaction(actor, async (state) => {
    resolveDeathSave(state, 10); // Validate availability before consuming dice.
    const chosen = await promptRollMode();
    const Roll = runtime().Roll;
    if (!chosen || !Roll) return null;
    mode = chosen;
    const pool = dicePoolForRollMode(chosen);
    const roll = new Roll(d20PoolFormula(pool.dieCount));
    await roll.evaluate();
    rolled = roll;
    faces = (roll.dice ?? [])
      .filter((d) => d.faces === 20)
      .flatMap((d) => (d.results ?? []).map((r) => r.result ?? 0));
    natural = selectKeptD20(faces, pool);
    return { next: resolveDeathSave(state, natural) };
  });
  if (outcome === "changed") warn("StateChanged");
  if (outcome === "invalid" || outcome === "failed") warn("DeathFailed");
  if (outcome !== "updated" || !after) return;
  try {
    const message = await createChat({
      speaker: { alias: actor.name },
      content: `<h3>${escapeHtml(actor.name)} — ${localize("DeathSave")}</h3><p>${faces.join(", ")} → ${natural} (${escapeHtml(mode)})</p><p>${escapeHtml(localize(after.status))}: ${after.successes} / ${after.failures}</p><p>${localize("ManualConsequences")}</p>`,
      rolls: [rolled],
    });
    await waitForDiceSoNiceAnimation(message);
  } catch {
    warn("ReportFailed");
  }
}

export async function correctSurvivalDialog(actor: SurvivalActor): Promise<void> {
  if (runtime().game?.user?.isGM !== true) return;
  let dyingAboveZero = false;
  const { outcome } = await runSurvivalTransaction(
    actor,
    async (s) => {
      const requested = await prompt(
        "Correction",
        `<p>${localize("CorrectionHelp")}</p>
 <label>HP <input type="number" min="0" step="1" name="hp" value="${s.hp}"></label>
 <label>${localize("Temp")} <input type="number" min="0" step="1" name="temp" value="${s.temp}"></label>
 <label>${localize("Successes")} <input type="number" min="0" max="3" step="1" name="successes" value="${s.successes}"></label>
 <label>${localize("Failures")} <input type="number" min="0" max="3" step="1" name="failures" value="${s.failures}"></label>
 <label>${localize("Status")} <select name="status">${SURVIVAL_STATUSES.filter(
   (status) => status !== "unconfirmed",
 )
   .map(
     (status) =>
       `<option value="${status}" ${status === s.status ? "selected" : ""}>${escapeHtml(localize(status))}</option>`,
   )
   .join("")}</select></label>`,
        (form) => ({
          hp: Number(field(form, "hp")),
          temp: Number(field(form, "temp")),
          successes: Number(field(form, "successes")),
          failures: Number(field(form, "failures")),
          status: field(form, "status") as SurvivalStatus,
        }),
      );
      if (!requested) return null;
      try {
        return { next: correctSurvival({ current: s, requested }) };
      } catch (error) {
        dyingAboveZero = error instanceof DyingAboveZeroError;
        throw error;
      }
    },
    { gmOnly: true },
  );
  if (dyingAboveZero) warn("DyingAboveZero");
  else if (outcome !== "updated" && outcome !== "cancelled" && outcome !== "busy")
    warn("ApplyFailed");
}

export async function clearTempHpDialog(actor: SurvivalActor): Promise<void> {
  if (actor.isOwner !== true) return;
  const { outcome } = await runSurvivalTransaction(actor, async (s) => {
    const approved = await prompt("ClearTemp", `<p>${localize("ClearTempHelp")}</p>`, () => true);
    return approved ? { next: { ...s, temp: 0 } } : null;
  });
  if (outcome !== "updated" && outcome !== "cancelled" && outcome !== "busy") warn("ApplyFailed");
}
