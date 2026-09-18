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
}

function extractRestContext(actor: ActorLike): RestContext | null {
  const system = actor.system ?? {};

  const hpCurrent = numberAt(system, ["attributes", "hp", "value"], 0);
  const hpMax = numberAt(system, ["attributes", "hp", "max"], 0);
  const poolCurrent = numberAt(system, ["resources", "pool", "value"], 0);
  const mpCurrent = numberAt(system, ["magic", "mp", "value"], 0);
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
  };
}

function localizeRest(key: string): string {
  return runtime().game?.i18n?.localize?.(`PIVOT.Rest.${key}`) ?? `PIVOT.Rest.${key}`;
}

function warnRest(key: string): void {
  runtime().ui?.notifications?.warn(localizeRest(key));
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

  const magicAbilityMod = calculateMagicAbilityModifier(ctx.awakened, ctx.magicAbilityScore);

  const maxSpends = ctx.poolCurrent;

  const inputs = await prompt(
    localizeRest("ShortRest"),
    `<div>
      <p>${escapeHtml(localizeRest("ShortRestPrompt"))}</p>
      <label>${escapeHtml(localizeRest("PoolDiceToSpend"))} (${escapeHtml(localizeRest("Max"))}: ${maxSpends})<br>
        <input type="number" name="poolSpends" min="0" max="${maxSpends}" step="1" value="1">
      </label>
      <p><em>${escapeHtml(localizeRest("ShortRestPoolInfo"))} (die: ${ctx.hitDie}, Con mod: ${formatSigned(ctx.conMod)})</em></p>
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

  if (!inputs) return;

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

  try {
    const progress = rollProgress();

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
        progress.close();
        warnRest("RestFailed");
        return;
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
        progress.close();
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

    progress.close();
  } catch {
    warnRest("RestFailed");
    return;
  }

  const mpResult = applyShortRestMpRecovery({
    awakened: ctx.awakened,
    magicAbilityMod,
    mpCurrent: ctx.mpCurrent,
    mpMax: ctx.mpMax,
    inDanger: inputs.inDanger,
  });

  const newHp = Math.min(ctx.hpMax, ctx.hpCurrent + totalHealed);
  const update: Record<string, unknown> = {
    "system.attributes.hp.value": newHp,
    "system.resources.pool.value": poolRemaining,
    "system.magic.mp.value": mpResult.mpFinal,
  };

  try {
    await actor.update?.(update);
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

  const update: Record<string, unknown> = {
    "system.attributes.hp.value": hpResult.hpFinal,
    "system.resources.pool.value": poolResult.poolFinal,
    "system.magic.mp.value": mpResult.mpFinal,
  };

  try {
    await actor.update?.(update);
  } catch {
    warnRest("RestFailed");
    return;
  }

  const summary = [
    `${escapeHtml(localizeRest("LongRestComplete"))}`,
    hpResult.hpRecovered > 0
      ? `${escapeHtml(localizeRest("HpRecovered"))}: ${hpResult.hpRecovered}`
      : "",
    poolResult.poolRecovered > 0
      ? `${escapeHtml(localizeRest("PoolRecovered"))}: ${poolResult.poolRecovered}`
      : "",
    mpResult.mpRecovered > 0
      ? `${escapeHtml(localizeRest("MpRecovered"))}: ${mpResult.mpRecovered}`
      : "",
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
