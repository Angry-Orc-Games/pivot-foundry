import type { ActorLike } from "../sheets/character-sheet";
import {
  applyLongRestHpRecovery,
  applyLongRestMpRecovery,
  applyLongRestPoolRecovery,
  applyShortRestMpRecovery,
  applyShortRestPoolSpend,
  calculateMagicAbilityModifier,
  parsePoolSpends,
} from "../rules/rest";
import { abilityModifier } from "../rules/modifiers";
import { parseExplodingFormula, rollExploding } from "../rules/exploding-roll";
import {
  applyHealth,
  reconcileSurvival,
  validateSurvival,
  type SurvivalState,
} from "../rules/survival";
import { busyHealthActors, readSurvival, survivalUpdate } from "./health";
import { rollProgress } from "./roll-progress";
import { prepareCharacterSheetContext } from "../sheets/character-sheet";
import { createChat, escapeHtml, field, prompt, runtime } from "./ui";
import { waitForDiceSoNiceAnimation } from "./dice-so-nice";

interface RestContext {
  actor: ActorLike;
  hpCurrent: number;
  hpMax: number;
  poolCurrent: number;
  poolMax: number;
  mpCurrent: number;
  mpMax: number;
  awakened: boolean;
  magicAbilityScore: number | null;
  conMod: number;
  hitDie: string;
  temp: number;
}

function extractRestContext(actor: ActorLike): RestContext | null {
  const system = actor.system ?? {};

  const hpCurrent = numberAt(system, ["attributes", "hp", "value"], 0);
  const hpMax = numberAt(system, ["attributes", "hp", "max"], 0);
  const poolCurrent = numberAt(system, ["resources", "pool", "value"], 0);
  const mpCurrent = numberAt(system, ["magic", "mp", "value"], 0);
  const temp = numberAt(system, ["attributes", "hp", "temp"], 0);
  const awakened = booleanAt(system, ["magic", "awakened"], false);

  const magicAbilityKey = stringAtNullable(system, ["magic", "ability"]);
  const magicAbilityScore = magicAbilityKey
    ? numberAt(system, ["abilities", magicAbilityKey, "score"], 10)
    : null;

  const conScore = numberAt(system, ["abilities", "con", "score"], 10);
  const conMod = abilityModifier(conScore);

  const hitDie = stringAt(system, ["attributes", "hitDie"], "d8");

  const sheetContext = prepareCharacterSheetContext(actor, true);
  const poolMax = sheetContext.derived.pool.max;
  const mpMax = sheetContext.derived.magic.mp.max;

  return {
    actor,
    hpCurrent,
    hpMax,
    poolCurrent,
    poolMax,
    mpCurrent,
    mpMax,
    awakened,
    magicAbilityScore,
    conMod,
    hitDie,
    temp,
  };
}

function localizeRest(key: string): string {
  return runtime().game?.i18n?.localize?.(`PIVOT.Rest.${key}`) ?? `PIVOT.Rest.${key}`;
}

function warnRest(key: string): void {
  runtime().ui?.notifications?.warn(localizeRest(key));
}

/**
 * Rests change HP, so they share the health lock and refuse states the survival
 * rules cannot heal: Dead, unconfirmed legacy state, or an inconsistent record.
 * A stale HP / status pair is reconciled first, as damage and death saves do.
 */
function restableSurvival(actor: ActorLike): SurvivalState | null {
  const survival = reconcileSurvival(readSurvival(actor));
  if (survival.status === "dead" || survival.status === "unconfirmed") return null;
  try {
    validateSurvival(survival);
  } catch {
    return null;
  }
  return survival;
}

/** Everything a rest reads before its dialogs; any change means another write landed. */
function restSnapshot(actor: ActorLike): string {
  const ctx = extractRestContext(actor);
  return JSON.stringify([readSurvival(actor), ctx?.poolCurrent, ctx?.mpCurrent]);
}

function lockRest(actor: ActorLike): string | null {
  if (!actor.uuid || busyHealthActors.has(actor.uuid) || !restableSurvival(actor)) {
    warnRest("Unavailable");
    return null;
  }
  busyHealthActors.add(actor.uuid);
  return actor.uuid;
}

export async function shortRestDialog(actor: ActorLike): Promise<void> {
  const ctx = extractRestContext(actor);
  if (!ctx) {
    warnRest("RestFailed");
    return;
  }

  if (ctx.poolCurrent < 1) {
    warnRest("InsufficientPool");
    return;
  }

  const lock = lockRest(actor);
  if (!lock) return;
  try {
    await runShortRest(actor, ctx);
  } finally {
    busyHealthActors.delete(lock);
  }
}

async function runShortRest(actor: ActorLike, ctx: RestContext): Promise<void> {
  const snapshot = restSnapshot(actor);

  const magicAbilityMod = calculateMagicAbilityModifier(ctx.awakened, ctx.magicAbilityScore);

  const maxSpends = ctx.poolCurrent;

  const inputs = await prompt(
    localizeRest("ShortRest"),
    `<div>
      <p>${escapeHtml(localizeRest("ShortRestPrompt"))}</p>
      <label>${escapeHtml(localizeRest("PoolDiceToSpend"))} (${escapeHtml(localizeRest("Max"))}: ${maxSpends})<br>
        <input type="number" name="poolSpends" min="0" max="${maxSpends}" step="1" value="1">
      </label>
      <p><em>${escapeHtml(runtime().game?.i18n?.format?.("PIVOT.Rest.ShortRestPoolInfo", { die: ctx.hitDie }) ?? `Each die: exploding ${ctx.hitDie} + Con mod → HP`)} (Con mod: ${formatSigned(ctx.conMod)})</em></p>
      ${
        ctx.awakened
          ? `<label><input type="checkbox" name="inDanger" value="yes"> ${escapeHtml(localizeRest("ShortRestInDanger"))}</label>
             <p>${escapeHtml(localizeRest("ShortRestMpInfo"))} (${magicAbilityMod} MP)</p>`
          : `<p><em>${escapeHtml(localizeRest("ShortRestNotAwakened"))}</em></p>`
      }
    </div>`,
    (form) => {
      const poolSpendsRaw = field(form, "poolSpends");
      const inDanger = field(form, "inDanger") === "yes";
      return { poolSpendsRaw, inDanger };
    },
    localizeRest("Confirm"),
    { localizeTitlesAndButtons: false, cancelLabel: localizeRest("Cancel") },
  );

  // Cancel / dismiss must be a clean no-op (DialogV2 may return a string or partial object).
  if (!inputs || typeof inputs !== "object") return;
  if (typeof inputs.poolSpendsRaw !== "string") return;

  const poolSpends = parsePoolSpends(inputs.poolSpendsRaw, maxSpends);

  if (poolSpends === null) {
    warnRest("RestFailed");
    return;
  }

  const Roll = runtime().Roll;
  if (!Roll) {
    warnRest("RestFailed");
    return;
  }

  let poolRemaining = ctx.poolCurrent;
  let totalHealed = 0;
  const diceResults: Array<{ faces: number; results: number[]; total: number }> = [];
  const diceRolls: InstanceType<typeof Roll>[] = [];

  const progress = rollProgress();
  try {
    for (let i = 0; i < poolSpends; i++) {
      if (poolRemaining < 1) break;

      const spendResult = applyShortRestPoolSpend({
        die: ctx.hitDie,
        poolCurrent: poolRemaining,
        conMod: ctx.conMod,
      });

      poolRemaining = spendResult.poolRemaining;

      const dieFormula = ctx.hitDie;
      if (!parseExplodingFormula(dieFormula)) {
        warnRest("RestFailed");
        return;
      }

      const rollResult = await rollExploding(
        dieFormula,
        { critical: false, enhanced: false },
        async (faces) => {
          const die = new Roll(`1d${faces}`);
          await progress.wait(die.evaluate());
          diceRolls.push(die);
          if (die.total === undefined) throw new Error("Incomplete");
          return die.total;
        },
      );

      if (!rollResult.complete || rollResult.total === null) {
        warnRest("RollIncomplete");
        return;
      }

      const dieTotal = rollResult.total;
      const healedForThisDie = Math.max(0, dieTotal + ctx.conMod);
      totalHealed += healedForThisDie;

      diceResults.push({
        faces: Number(ctx.hitDie.replace(/^d/, "")),
        results: rollResult.chains[0]?.results ?? [],
        total: healedForThisDie,
      });
    }
  } catch {
    warnRest("RestFailed");
    return;
  } finally {
    progress.close();
  }

  const mpResult = applyShortRestMpRecovery({
    awakened: ctx.awakened,
    magicAbilityMod,
    mpCurrent: ctx.mpCurrent,
    mpMax: ctx.mpMax,
    inDanger: inputs.inDanger,
  });

  // Dialogs and dice can outlive another client's write. Never overwrite a changed state.
  if (restSnapshot(actor) !== snapshot) {
    warnRest("StateChanged");
    return;
  }

  try {
    const survival = restableSurvival(actor);
    if (!survival) throw new Error("Rest unavailable");
    const healed = applyHealth(survival, "healing", totalHealed);
    totalHealed = healed.hp - survival.hp;
    await actor.update?.({
      ...survivalUpdate(healed),
      "system.resources.pool.value": poolRemaining,
      "system.magic.mp.value": mpResult.mpFinal,
    });
  } catch {
    warnRest("RestFailed");
    return;
  }

  const diceChains = diceResults
    .map((d) => `d${d.faces}: [${d.results.join(" → ")}] ${formatSigned(ctx.conMod)} = ${d.total}`)
    .join("; ");

  const summary = [
    `${escapeHtml(localizeRest("ShortRestComplete"))}`,
    `${escapeHtml(localizeRest("PoolSpent"))}: ${poolSpends}`,
    `${escapeHtml(localizeRest("HpHealed"))}: ${totalHealed}`,
    mpResult.mpRecovered > 0
      ? `${escapeHtml(localizeRest("MpRecovered"))}: ${mpResult.mpRecovered}`
      : "",
  ]
    .filter(Boolean)
    .join(" • ");

  try {
    const message = await createChat({
      content: `<p><strong>${summary}</strong></p><p><em>${escapeHtml(diceChains)}</em></p>`,
      rolls: diceRolls,
    });
    await waitForDiceSoNiceAnimation(message);
  } catch {
    warnRest("ChatFailed");
  }
}

export async function longRestDialog(actor: ActorLike): Promise<void> {
  const ctx = extractRestContext(actor);
  if (!ctx) {
    warnRest("RestFailed");
    return;
  }

  const lock = lockRest(actor);
  if (!lock) return;
  try {
    await runLongRest(actor, ctx);
  } finally {
    busyHealthActors.delete(lock);
  }
}

async function runLongRest(actor: ActorLike, ctx: RestContext): Promise<void> {
  const snapshot = restSnapshot(actor);

  const safeInput = await prompt(
    localizeRest("LongRest"),
    `<div>
      <p>${escapeHtml(localizeRest("LongRestPrompt"))}</p>
      <label>
        <input type="checkbox" name="safeAndComfortable" value="yes">
        ${escapeHtml(localizeRest("LongRestSafeAndComfortable"))}
      </label>
      <p><em>${escapeHtml(localizeRest("LongRestMpInfo"))}</em></p>
    </div>`,
    (form) => ({
      safeAndComfortable: field(form, "safeAndComfortable") === "yes",
    }),
    localizeRest("Confirm"),
    { localizeTitlesAndButtons: false, cancelLabel: localizeRest("Cancel") },
  );

  if (!safeInput) return;

  const hpResult = applyLongRestHpRecovery({
    hpCurrent: ctx.hpCurrent,
    hpMax: ctx.hpMax,
  });

  const poolResult = applyLongRestPoolRecovery({
    poolCurrent: ctx.poolCurrent,
    poolMax: ctx.poolMax,
  });

  let controlMagicRoll: number | null = null;

  if (ctx.awakened && !safeInput.safeAndComfortable) {
    const rollInput = await prompt(
      localizeRest("ControlMagic"),
      `<div>
        <p>${escapeHtml(localizeRest("ControlMagicPrompt"))}</p>
        <label>${escapeHtml(localizeRest("ControlMagicRollResult"))}<br>
          <input type="number" name="roll" min="1" step="1" value="">
        </label>
        <p><em>${escapeHtml(localizeRest("ControlMagicDC15"))}</em></p>
      </div>`,
      (form) => ({
        roll: Number(field(form, "roll")),
      }),
      localizeRest("Confirm"),
      { localizeTitlesAndButtons: false, cancelLabel: localizeRest("Cancel") },
    );

    if (!rollInput) return;

    if (!Number.isFinite(rollInput.roll)) {
      controlMagicRoll = null;
    } else {
      controlMagicRoll = rollInput.roll;
    }
  }

  const mpResult = applyLongRestMpRecovery({
    awakened: ctx.awakened,
    mpCurrent: ctx.mpCurrent,
    mpMax: ctx.mpMax,
    safeAndComfortable: safeInput.safeAndComfortable,
    controlMagicRoll,
  });

  if (restSnapshot(actor) !== snapshot) {
    warnRest("StateChanged");
    return;
  }

  let hpRecovered: number;
  try {
    const survival = restableSurvival(actor);
    if (!survival) throw new Error("Rest unavailable");
    const healed = applyHealth(survival, "healing", hpResult.hpRecovered);
    hpRecovered = healed.hp - survival.hp;
    await actor.update?.(buildLongRestUpdate(healed, poolResult.poolFinal, mpResult.mpFinal));
  } catch {
    warnRest("RestFailed");
    return;
  }

  const summary = [
    `${escapeHtml(localizeRest("LongRestComplete"))}`,
    hpRecovered > 0 ? `${escapeHtml(localizeRest("HpRecovered"))}: ${hpRecovered}` : "",
    poolResult.poolRecovered > 0
      ? `${escapeHtml(localizeRest("PoolRecovered"))}: ${poolResult.poolRecovered}`
      : "",
    mpResult.mpRecovered > 0
      ? `${escapeHtml(localizeRest("MpRecovered"))}: ${mpResult.mpRecovered}`
      : "",
    ctx.temp > 0 ? `${escapeHtml(localizeRest("TempHpCleared"))}: ${ctx.temp}` : "",
  ]
    .filter(Boolean)
    .join(" • ");

  try {
    await createChat({ content: `<p><strong>${summary}</strong></p>` });
  } catch {
    warnRest("ChatFailed");
  }
}

/** Long Rest clears temporary HP; survival status and counters follow the healed state. */
export function buildLongRestUpdate(
  healed: SurvivalState,
  poolFinal: number,
  mpFinal: number,
): Record<string, unknown> {
  return {
    ...survivalUpdate({ ...healed, temp: 0 }),
    "system.resources.pool.value": poolFinal,
    "system.magic.mp.value": mpFinal,
  };
}

function numberAt(source: Record<string, unknown>, path: string[], fallback: number): number {
  let current: unknown = source;
  for (const part of path) {
    if (!isRecord(current)) return fallback;
    current = current[part];
  }
  return typeof current === "number" && Number.isFinite(current) ? current : fallback;
}

function stringAt(source: Record<string, unknown>, path: string[], fallback: string): string {
  let current: unknown = source;
  for (const part of path) {
    if (!isRecord(current)) return fallback;
    current = current[part];
  }
  return typeof current === "string" ? current : fallback;
}

function stringAtNullable(source: Record<string, unknown>, path: string[]): string | null {
  let current: unknown = source;
  for (const part of path) {
    if (!isRecord(current)) return null;
    current = current[part];
  }
  return typeof current === "string" ? current : null;
}

function booleanAt(source: Record<string, unknown>, path: string[], fallback: boolean): boolean {
  let current: unknown = source;
  for (const part of path) {
    if (!isRecord(current)) return fallback;
    current = current[part];
  }
  return typeof current === "boolean" ? current : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}
