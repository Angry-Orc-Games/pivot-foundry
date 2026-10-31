import type { ActorLike } from "../sheets/character-sheet";
import {
  applyLongRestHpRecovery,
  canRest,
  applyLongRestMpRecovery,
  applyLongRestPoolRecovery,
  applyShortRestMpRecovery,
  applyShortRestPoolSpend,
  calculateMagicAbilityModifier,
  parsePoolSpends,
} from "../rules/rest";
import { abilityModifier } from "../rules/modifiers";
import { parseExplodingFormula, rollExploding } from "../rules/exploding-roll";
import { applyHealth, type SurvivalState } from "../rules/survival";
import {
  runSurvivalTransaction,
  type SurvivalChange,
  type SurvivalTransactionResult,
} from "./survival-transaction";
import { rollProgress } from "./roll-progress";
import { prepareCharacterSheetContext } from "../sheets/character-sheet";
import { createChat, escapeHtml, field, prompt, runtime } from "./ui";

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
 * Rests change HP, so each runs as one Survival transaction that also watches Pool and MP.
 * The survival rules cannot heal a Dead, Unconfirmed, or inconsistent record.
 */
async function runRest(
  actor: ActorLike,
  rest: (state: SurvivalState) => Promise<SurvivalChange | null>,
): Promise<SurvivalTransactionResult> {
  const result = await runSurvivalTransaction(
    actor,
    async (state) => {
      if (!canRest(state)) {
        warnRest("Unavailable");
        return null;
      }
      return rest(state);
    },
    {
      watch: () => [
        numberAt(actor.system, ["resources", "pool", "value"], 0),
        numberAt(actor.system, ["magic", "mp", "value"], 0),
      ],
    },
  );
  if (result.outcome === "busy" || result.outcome === "denied") warnRest("Unavailable");
  if (result.outcome === "changed") warnRest("StateChanged");
  if (result.outcome === "invalid" || result.outcome === "failed") warnRest("RestFailed");
  return result;
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

  await runShortRest(actor, ctx);
}

async function runShortRest(actor: ActorLike, ctx: RestContext): Promise<void> {
  const magicAbilityMod = calculateMagicAbilityModifier(ctx.awakened, ctx.magicAbilityScore);

  const maxSpends = ctx.poolCurrent;
  let poolSpends = 0;
  const diceResults: Array<{ faces: number; results: number[]; total: number }> = [];
  let mpRecovered = 0;

  const { outcome, before, after } = await runRest(actor, async (state) => {
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

    if (!inputs) return null;

    const spends = parsePoolSpends(inputs.poolSpendsRaw, maxSpends);

    if (spends === null) {
      warnRest("RestFailed");
      return null;
    }
    poolSpends = spends;

    const Roll = runtime().Roll;
    if (!Roll) {
      warnRest("RestFailed");
      return null;
    }

    let poolRemaining = ctx.poolCurrent;
    let totalHealed = 0;

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
          return null;
        }

        const rollResult = await rollExploding(
          dieFormula,
          { critical: false, enhanced: false },
          async (faces) => {
            const die = new Roll(`1d${faces}`);
            await progress.wait(die.evaluate());
            if (die.total === undefined) throw new Error("Incomplete");
            return die.total;
          },
        );

        if (!rollResult.complete || rollResult.total === null) {
          warnRest("RollIncomplete");
          return null;
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
      return null;
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
    mpRecovered = mpResult.mpRecovered;

    return {
      next: applyHealth(state, "healing", totalHealed),
      extra: {
        "system.resources.pool.value": poolRemaining,
        "system.magic.mp.value": mpResult.mpFinal,
      },
    };
  });
  if (outcome !== "updated" || !before || !after) return;
  const totalHealed = after.hp - before.hp;

  const diceChains = diceResults
    .map((d) => `d${d.faces}: [${d.results.join(" → ")}] ${formatSigned(ctx.conMod)} = ${d.total}`)
    .join("; ");

  const summary = [
    `${escapeHtml(localizeRest("ShortRestComplete"))}`,
    `${escapeHtml(localizeRest("PoolSpent"))}: ${poolSpends}`,
    `${escapeHtml(localizeRest("HpHealed"))}: ${totalHealed}`,
    mpRecovered > 0 ? `${escapeHtml(localizeRest("MpRecovered"))}: ${mpRecovered}` : "",
  ]
    .filter(Boolean)
    .join(" • ");

  try {
    await createChat({
      content: `<p><strong>${summary}</strong></p><p><em>${escapeHtml(diceChains)}</em></p>`,
    });
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

  await runLongRest(actor, ctx);
}

async function runLongRest(actor: ActorLike, ctx: RestContext): Promise<void> {
  let poolRecovered = 0;
  let mpRecovered = 0;

  const { outcome, before, after } = await runRest(actor, async (state) => {
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

    if (!safeInput) return null;

    const hpResult = applyLongRestHpRecovery({
      hpCurrent: state.hp,
      hpMax: state.max,
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

      if (!rollInput) return null;

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
    poolRecovered = poolResult.poolRecovered;
    mpRecovered = mpResult.mpRecovered;

    // Long Rest clears Temporary HP; status and counters follow the healed state.
    return {
      next: { ...applyHealth(state, "healing", hpResult.hpRecovered), temp: 0 },
      extra: {
        "system.resources.pool.value": poolResult.poolFinal,
        "system.magic.mp.value": mpResult.mpFinal,
      },
    };
  });
  if (outcome !== "updated" || !before || !after) return;
  const hpRecovered = after.hp - before.hp;

  const summary = [
    `${escapeHtml(localizeRest("LongRestComplete"))}`,
    hpRecovered > 0 ? `${escapeHtml(localizeRest("HpRecovered"))}: ${hpRecovered}` : "",
    poolRecovered > 0 ? `${escapeHtml(localizeRest("PoolRecovered"))}: ${poolRecovered}` : "",
    mpRecovered > 0 ? `${escapeHtml(localizeRest("MpRecovered"))}: ${mpRecovered}` : "",
    before.temp > 0 ? `${escapeHtml(localizeRest("TempHpCleared"))}: ${before.temp}` : "",
  ]
    .filter(Boolean)
    .join(" • ");

  try {
    await createChat({ content: `<p><strong>${summary}</strong></p>` });
  } catch {
    warnRest("ChatFailed");
  }
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
