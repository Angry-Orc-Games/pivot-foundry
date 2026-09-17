import type { ActorLike } from "../sheets/character-sheet";
import {
  applyLongRestHpRecovery,
  applyLongRestMpRecovery,
  applyLongRestPoolRecovery,
  applyShortRestMpRecovery,
  applyShortRestPoolSpend,
  calculateMagicAbilityModifier,
} from "../rules/rest";
import { abilityModifier } from "../rules/modifiers";
import { createChat, escapeHtml, field, localize, prompt, warn } from "./ui";

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
  const poolMax = numberAt(system, ["resources", "pool", "max"], 1);
  const mpCurrent = numberAt(system, ["magic", "mp", "value"], 0);
  const mpMax = numberAt(system, ["magic", "mp", "max"], 0);
  const awakened = booleanAt(system, ["magic", "awakened"], false);

  const magicAbilityKey = stringAtNullable(system, ["magic", "ability"]);
  const magicAbilityScore = magicAbilityKey
    ? numberAt(system, ["abilities", magicAbilityKey, "score"], 10)
    : null;

  const conScore = numberAt(system, ["abilities", "con", "score"], 10);
  const conMod = abilityModifier(conScore);

  const hitDie = stringAt(system, ["attributes", "hitDie"], "d8");

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

export async function shortRestDialog(actor: ActorLike): Promise<void> {
  const ctx = extractRestContext(actor);
  if (!ctx) {
    warn("Rest.RestFailed");
    return;
  }

  if (ctx.poolCurrent < 1) {
    warn("Rest.InsufficientPool");
    return;
  }

  const magicAbilityMod = calculateMagicAbilityModifier(ctx.awakened, ctx.magicAbilityScore);

  const maxSpends = ctx.poolCurrent;

  const inputs = await prompt(
    "ShortRest",
    `<div>
      <p>${escapeHtml(localize("Rest.ShortRestPrompt"))}</p>
      <label>${escapeHtml(localize("Rest.PoolDiceToSpend"))} (${escapeHtml(localize("Rest.Max"))}: ${maxSpends})<br>
        <input type="number" name="poolSpends" min="0" max="${maxSpends}" step="1" value="1">
      </label>
      <p><em>${escapeHtml(localize("Rest.ShortRestPoolInfo"))} (die: ${ctx.hitDie}, Con mod: ${formatSigned(ctx.conMod)})</em></p>
      ${
        ctx.awakened
          ? `<p>${escapeHtml(localize("Rest.ShortRestMpInfo"))} (${magicAbilityMod} MP)</p>`
          : `<p><em>${escapeHtml(localize("Rest.ShortRestNotAwakened"))}</em></p>`
      }
    </div>`,
    (form) => ({
      poolSpends: Math.max(0, Math.min(maxSpends, Number(field(form, "poolSpends")))),
    }),
  );

  if (!inputs) return;

  let poolRemaining = ctx.poolCurrent;

  for (let i = 0; i < inputs.poolSpends; i++) {
    if (poolRemaining < 1) break;

    const spendResult = applyShortRestPoolSpend({
      die: ctx.hitDie,
      poolCurrent: poolRemaining,
      conMod: ctx.conMod,
    });

    poolRemaining = spendResult.poolRemaining;
  }

  const mpResult = applyShortRestMpRecovery({
    awakened: ctx.awakened,
    magicAbilityMod,
    mpCurrent: ctx.mpCurrent,
    mpMax: ctx.mpMax,
    inDanger: false,
  });

  const update: Record<string, unknown> = {
    "system.resources.pool.value": poolRemaining,
    "system.magic.mp.value": mpResult.mpFinal,
  };

  try {
    await actor.update?.(update);
  } catch {
    warn("Rest.RestFailed");
    return;
  }

  const summary = [
    `${escapeHtml(localize("Rest.ShortRestComplete"))}`,
    `${escapeHtml(localize("Rest.PoolSpent"))}: ${inputs.poolSpends}`,
    mpResult.mpRecovered > 0
      ? `${escapeHtml(localize("Rest.MpRecovered"))}: ${mpResult.mpRecovered}`
      : "",
  ]
    .filter(Boolean)
    .join(" • ");

  await createChat({
    content: `<p><strong>${summary}</strong></p><p><em>${escapeHtml(localize("Rest.ShortRestRollNote"))}</em></p>`,
  });
}

export async function longRestDialog(actor: ActorLike): Promise<void> {
  const ctx = extractRestContext(actor);
  if (!ctx) {
    warn("Rest.RestFailed");
    return;
  }

  const safeInput = await prompt(
    "LongRest",
    `<div>
      <p>${escapeHtml(localize("Rest.LongRestPrompt"))}</p>
      <label>
        <input type="checkbox" name="safeAndComfortable" value="yes">
        ${escapeHtml(localize("Rest.LongRestSafeAndComfortable"))}
      </label>
      <p><em>${escapeHtml(localize("Rest.LongRestMpInfo"))}</em></p>
    </div>`,
    (form) => ({
      safeAndComfortable: field(form, "safeAndComfortable") === "yes",
    }),
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
      "ControlMagic",
      `<div>
        <p>${escapeHtml(localize("Rest.ControlMagicPrompt"))}</p>
        <label>${escapeHtml(localize("Rest.ControlMagicRollResult"))}<br>
          <input type="number" name="roll" min="1" step="1" value="">
        </label>
        <p><em>${escapeHtml(localize("Rest.ControlMagicDC15"))}</em></p>
      </div>`,
      (form) => ({
        roll: Number(field(form, "roll")),
      }),
    );

    if (!rollInput || !Number.isFinite(rollInput.roll)) {
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
    warn("Rest.RestFailed");
    return;
  }

  const summary = [
    `${escapeHtml(localize("Rest.LongRestComplete"))}`,
    hpResult.hpRecovered > 0
      ? `${escapeHtml(localize("Rest.HpRecovered"))}: ${hpResult.hpRecovered}`
      : "",
    poolResult.poolRecovered > 0
      ? `${escapeHtml(localize("Rest.PoolRecovered"))}: ${poolResult.poolRecovered}`
      : "",
    mpResult.mpRecovered > 0
      ? `${escapeHtml(localize("Rest.MpRecovered"))}: ${mpResult.mpRecovered}`
      : "",
  ]
    .filter(Boolean)
    .join(" • ");

  await createChat({ content: `<p><strong>${summary}</strong></p>` });
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
