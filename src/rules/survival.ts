export const SURVIVAL_STATUSES = ["alive", "dying", "stable", "dead", "unconfirmed"] as const;
export type SurvivalStatus = (typeof SURVIVAL_STATUSES)[number];
export interface SurvivalState {
  hp: number;
  max: number;
  temp: number;
  successes: number;
  failures: number;
  status: SurvivalStatus;
}
export type HealthKind = "damage" | "healing" | "temp";
export function validAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
export function validateSurvival(s: SurvivalState): void {
  if (
    ![s.hp, s.max, s.temp, s.successes, s.failures].every(validAmount) ||
    s.hp > s.max ||
    s.successes > 3 ||
    s.failures > 3 ||
    !SURVIVAL_STATUSES.includes(s.status)
  )
    throw new RangeError("Invalid survival state");
  if (
    (s.hp > 0 && s.status !== "alive" && s.status !== "unconfirmed") ||
    (s.hp === 0 && s.status === "alive" && s.max > 0)
  )
    throw new RangeError("Inconsistent survival state; GM correction required");
}
export function applyHealth(
  source: SurvivalState,
  kind: HealthKind,
  amount: number,
  critical = false,
  tempChoice?: "keep" | "replace",
): SurvivalState {
  validateSurvival(source);
  if (
    !validAmount(amount) ||
    !["damage", "healing", "temp"].includes(kind) ||
    source.status === "unconfirmed"
  )
    throw new RangeError("Invalid health transaction");
  const s = { ...source };
  if (kind === "temp") {
    if (s.temp > 0 && !tempChoice) throw new RangeError("Choose Keep Existing or Replace");
    if (tempChoice !== "keep") s.temp = amount;
    return s;
  }
  if (kind === "healing") {
    if (s.status === "dead") throw new RangeError("Healing cannot resurrect");
    s.hp = Math.min(s.max, s.hp + amount);
    if (s.hp > source.hp) {
      s.successes = 0;
      s.failures = 0;
      s.status = "alive";
    }
    return s;
  }
  if (amount === 0 || s.status === "dead") return s;
  const damage = Math.max(0, amount - s.temp);
  s.temp = Math.max(0, s.temp - amount);
  if (s.hp === 0) {
    s.status = "dying";
    s.successes = 0;
    s.failures = Math.min(3, s.failures + (critical ? 2 : 1));
    if (s.failures === 3 || (s.max > 0 && damage >= s.max)) s.status = "dead";
    return s;
  }
  const remainder = damage - s.hp;
  s.hp = Math.max(0, s.hp - damage);
  if (s.hp === 0) {
    s.successes = 0;
    s.failures = 0;
    s.status = remainder >= s.max ? "dead" : "dying";
  }
  return s;
}
export function resolveDeathSave(source: SurvivalState, natural: number): SurvivalState {
  validateSurvival(source);
  if (
    source.hp !== 0 ||
    source.status !== "dying" ||
    !Number.isInteger(natural) ||
    natural < 1 ||
    natural > 20
  )
    throw new RangeError("Death save unavailable");
  if (natural === 20) return { ...source, hp: 1, successes: 0, failures: 0, status: "alive" };
  const s = { ...source };
  if (natural >= 10) s.successes++;
  else s.failures = Math.min(3, s.failures + (natural === 1 ? 2 : 1));
  if (s.failures >= 3) s.status = "dead";
  else if (s.successes >= 3) {
    s.status = "stable";
    s.successes = 0;
    s.failures = 0;
  }
  return s;
}
