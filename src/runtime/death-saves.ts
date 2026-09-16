import { dicePoolForRollMode, d20PoolFormula, selectKeptD20 } from "../rules/d20-roll";
import {
  resolveDeathSave,
  SURVIVAL_STATUSES,
  validateSurvival,
  validAmount,
  type SurvivalStatus,
} from "../rules/survival";
import { busyHealthActors, readSurvival, survivalUpdate, type HealthActor } from "./health";
import { createChat, escapeHtml, field, localize, prompt, runtime, warn } from "./ui";
import { promptRollMode } from "../sheets/character-sheet";
const busy = busyHealthActors;
export async function deathSaveDialog(actor: HealthActor): Promise<void> {
  if (!actor.uuid || busy.has(actor.uuid) || actor.isOwner !== true) return;
  busy.add(actor.uuid);
  try {
    const source = readSurvival(actor);
    resolveDeathSave(source, 10); // Validate availability before consuming dice.
    const mode = await promptRollMode();
    if (!mode) return;
    const Roll = runtime().Roll;
    if (!Roll) return;
    const pool = dicePoolForRollMode(mode);
    const roll = new Roll(d20PoolFormula(pool.dieCount));
    await roll.evaluate();
    const faces = (roll.dice ?? [])
      .filter((d) => d.faces === 20)
      .flatMap((d) => (d.results ?? []).map((r) => r.result ?? 0));
    const natural = selectKeptD20(faces, pool);
    // A dialog/roll may outlive another client mutation. Do not overwrite a changed state.
    const current = readSurvival(actor);
    if (
      actor.isOwner !== true ||
      JSON.stringify(current) !== JSON.stringify(source) ||
      !actor.update
    ) {
      warn("StateChanged");
      return;
    }
    const next = resolveDeathSave(current, natural);
    await actor.update(survivalUpdate(next));
    try {
      await createChat({
        speaker: { alias: actor.name },
        content: `<h3>${escapeHtml(actor.name)} — ${localize("DeathSave")}</h3><p>${faces.join(", ")} → ${natural} (${escapeHtml(mode)})</p><p>${escapeHtml(localize(next.status))}: ${next.successes} / ${next.failures}</p><p>${localize("ManualConsequences")}</p>`,
      });
    } catch {
      warn("ReportFailed");
    }
  } catch {
    warn("DeathFailed");
  } finally {
    busy.delete(actor.uuid);
  }
}
export async function correctSurvivalDialog(actor: HealthActor): Promise<void> {
  if (runtime().game?.user?.isGM !== true) return;
  const s = readSurvival(actor);
  const next = await prompt(
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
      ...s,
      hp: Number(field(form, "hp")),
      temp: Number(field(form, "temp")),
      successes: Number(field(form, "successes")),
      failures: Number(field(form, "failures")),
      status: field(form, "status") as SurvivalStatus,
    }),
  );
  if (!next || !actor.uuid || busy.has(actor.uuid)) return;
  busy.add(actor.uuid);
  try {
    if (
      runtime().game?.user?.isGM !== true ||
      actor.isOwner !== true ||
      !actor.update ||
      JSON.stringify(readSurvival(actor)) !== JSON.stringify(s)
    )
      throw Error("changed");
    validateSurvival(next);
    if (next.status === "stable" || next.hp > 0) {
      next.successes = 0;
      next.failures = 0;
    }
    await actor.update(survivalUpdate(next));
  } catch {
    warn("ApplyFailed");
  } finally {
    busy.delete(actor.uuid);
  }
}
export async function clearTempHpDialog(actor: HealthActor): Promise<void> {
  if (actor.isOwner !== true) return;
  const approved = await prompt("ClearTemp", `<p>${localize("ClearTempHelp")}</p>`, () => true);
  if (!approved || !actor.uuid || busy.has(actor.uuid)) return;
  busy.add(actor.uuid);
  try {
    if (actor.isOwner !== true || !actor.update || !validAmount(readSurvival(actor).temp))
      throw Error("denied");
    await actor.update({ "system.attributes.hp.temp": 0 });
  } catch {
    warn("ApplyFailed");
  } finally {
    busy.delete(actor.uuid);
  }
}
