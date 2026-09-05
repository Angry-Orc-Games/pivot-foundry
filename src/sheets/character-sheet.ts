import {
  abilities,
  armourCategories,
  canonicalSkills,
  featureCategories,
  hitDice,
  SYSTEM_ID,
  weaponCategories,
} from "../config";
import type { FoundryRuntime, TypeDataModelConstructor } from "../foundry-runtime";
import { selectInitiativeCombatant } from "../rules/combat";
import {
  type AbilityKey,
  calculateArmourClass,
  calculateAttackSummary,
  calculateCharacterDerived,
  calculateTotalWeight,
  type PassivePerceptionMode,
  type SkillSourceMap,
} from "../rules/character-derived";
import {
  applyAttackCrit,
  d20PoolFormula,
  dicePoolForRollMode,
  isRollMode,
  type RollMode,
  selectKeptD20,
} from "../rules/d20-roll";
import {
  recoverBoundedResource,
  recoverPoolOnLongRest,
  spendBoundedResource,
} from "../rules/resources";

const CHARACTER_TEMPLATE = `systems/${SYSTEM_ID}/templates/actors/character-sheet.hbs`;

type RecordValue = Record<string, unknown>;

export interface ItemLike {
  id?: string;
  _id?: string;
  name: string;
  type: string;
  system: RecordValue;
  sheet?: { render?: (force?: boolean) => unknown };
}

export interface ActorLike {
  id?: string;
  _id?: string;
  name: string;
  type: string;
  system: RecordValue;
  items?: Iterable<ItemLike> | { contents: ItemLike[] };
  update?: (data: Record<string, unknown>) => Promise<unknown>;
  createEmbeddedDocuments?: (
    type: "Item",
    data: Array<Record<string, unknown>>,
  ) => Promise<unknown>;
  deleteEmbeddedDocuments?: (type: "Item", ids: string[]) => Promise<unknown>;
}

export const POOL_VALUE_PATH = "resources.pool.value";

export const ROLL_MODE_LABEL_KEYS: Record<RollMode, string> = {
  normal: "PIVOT.RollMode.Normal",
  advantage: "PIVOT.RollMode.Advantage",
  disadvantage: "PIVOT.RollMode.Disadvantage",
  superAdvantage: "PIVOT.RollMode.SuperAdvantage",
};

export type D20RollKind = "ability" | "save" | "skill" | "initiative" | "weaponAttack";
export type FormulaRollKind = "weaponDamage" | "magicAbility";

export type SheetRollRequest =
  | {
      kind: "d20";
      rollKind: D20RollKind;
      label: string;
      modifier: number;
      applyAttackCrit: boolean;
    }
  | {
      kind: "formula";
      rollKind: FormulaRollKind;
      label: string;
      formula: string;
    };

export interface CombatantLike {
  id?: string;
  actorId?: string | null;
  update?: (data: Record<string, unknown>) => Promise<unknown>;
}

export interface CombatLike {
  combatants?: Iterable<CombatantLike> | { contents: CombatantLike[] };
}

export interface CharacterSheetContext {
  actor: ActorLike;
  system: RecordValue;
  form: {
    languagesText: string;
    instrumentsText: string;
    academiaText: string;
    craftingText: string;
  };
  disabledAttr: "" | "disabled";
  editable: boolean;
  config: {
    abilities: typeof abilities;
    magicAbilities: typeof abilities;
    skills: typeof canonicalSkills;
    hitDice: typeof hitDice;
    hitDiceChoices: Record<string, string>;
    weaponCategories: typeof weaponCategories;
    armourCategories: typeof armourCategories;
    featureCategories: typeof featureCategories;
  };
  derived: ReturnType<typeof calculateCharacterDerived>;
  abilityRows: Array<{
    key: AbilityKey;
    label: string;
    short: string;
    scorePath: string;
    primaryPath: string;
    score: number;
    primary: boolean;
    mod: number;
    save: number;
    disabledAttr: "" | "disabled";
  }>;
  skillRows: Array<{
    id: string;
    label: string;
    ability: string;
    abilityPath: string;
    proficientPath: string;
    deepeningPath: string;
    expertisePath: string;
    bonusPath: string;
    proficient: boolean;
    deepening: number;
    expertise: boolean;
    bonus: number;
    total: number;
    disabledAttr: "" | "disabled";
  }>;
  items: {
    weapons: Array<
      ItemLike & {
        summary: ReturnType<typeof calculateAttackSummary>;
        disabledAttr: "" | "disabled";
      }
    >;
    armour: Array<ItemLike & { disabledAttr: "" | "disabled" }>;
    equipment: Array<ItemLike & { disabledAttr: "" | "disabled" }>;
    features: Array<ItemLike & { disabledAttr: "" | "disabled" }>;
    magicStreams: Array<ItemLike & { disabledAttr: "" | "disabled" }>;
    magicAbilities: Array<ItemLike & { disabledAttr: "" | "disabled" }>;
  };
}

export function createPivotCharacterSheetClass(foundry: FoundryRuntime): TypeDataModelConstructor {
  const BaseSheet = foundry.applications.api.HandlebarsApplicationMixin(
    foundry.applications.sheets.ActorSheetV2,
  );

  class PivotCharacterSheet extends BaseSheet {
    static DEFAULT_OPTIONS = {
      classes: [SYSTEM_ID, "sheet", "actor", "character"],
      position: { width: 960, height: 760 },
      tag: "form",
      window: {
        title: "PIVOT.Sheets.Character.Title",
      },
      form: {
        closeOnSubmit: false,
        submitOnChange: true,
        handler: submitDocumentForm,
      },
      actions: {
        roll: rollAction,
        adjustResource: adjustResourceAction,
        recoverPoolLongRest: recoverPoolLongRestAction,
        createItem: createItemAction,
        openItem: openItemAction,
        deleteItem: deleteItemAction,
      },
    };

    static PARTS = {
      form: {
        template: CHARACTER_TEMPLATE,
      },
    };

    static TABS = {
      primary: {
        tabs: [
          { id: "core", label: "PIVOT.Tabs.Core" },
          { id: "skills", label: "PIVOT.Tabs.Skills" },
          { id: "combat", label: "PIVOT.Tabs.Combat" },
          { id: "equipment", label: "PIVOT.Tabs.Equipment" },
          { id: "magic", label: "PIVOT.Tabs.Magic" },
          { id: "features", label: "PIVOT.Tabs.Features" },
        ],
        initial: "core",
      },
    };

    async _prepareContext(options: Record<string, unknown>): Promise<Record<string, unknown>> {
      const parentContext = await callOptionalSuper(this, "_prepareContext", options);
      const actor = getSheetDocument(this);
      return {
        ...parentContext,
        ...prepareCharacterSheetContext(actor, parentContext.editable !== false),
      };
    }
  }

  return PivotCharacterSheet;
}

export function prepareCharacterSheetContext(
  actor: ActorLike,
  editable = true,
): CharacterSheetContext {
  const system = actor.system ?? {};
  const itemList = getActorItems(actor);
  const armour = itemList.filter((item) => item.type === "armour");
  const equipment = itemList.filter((item) =>
    ["equipment", "weapon", "armour"].includes(item.type),
  );
  const weapons = itemList.filter((item) => item.type === "weapon");
  const features = itemList.filter((item) => item.type === "feature");
  const magicStreams = itemList.filter((item) => item.type === "magicStream");
  const magicAbilities = itemList.filter((item) => item.type === "magicAbility");
  const disabledAttr = editable ? "" : "disabled";

  const abilitySources = Object.fromEntries(
    abilities.map(({ key }) => {
      const source = objectAt(system, ["abilities", key]);
      return [
        key,
        {
          score: numberAt(source, ["score"], 10),
          primary: booleanAt(source, ["primary"], false),
        },
      ];
    }),
  ) as Record<AbilityKey, { score: number; primary: boolean }>;

  const skillSources = Object.fromEntries(
    canonicalSkills.map((skill) => {
      const source = objectAt(system, ["skills", skill.id]);
      const defaultAbility = skill.ability === "varies" ? magicAbility(system) : skill.ability;
      return [
        skill.id,
        {
          ability: abilityAt(source, ["ability"], defaultAbility),
          proficient: booleanAt(source, ["proficient"], false),
          deepening: numberAt(source, ["deepening"], 0),
          expertise: booleanAt(source, ["expertise"], false),
          bonus: numberAt(source, ["bonus"], 0),
        },
      ];
    }),
  ) as SkillSourceMap;

  const derived = calculateCharacterDerived({
    level: numberAt(system, ["progression", "level"], 1),
    abilities: abilitySources,
    skills: skillSources,
    magic: {
      awakened: booleanAt(system, ["magic", "awakened"], false),
      ability: nullableAbilityAt(system, ["magic", "ability"]),
    },
    equipment: equipment.map((item) => ({
      weight: numberAt(item.system, ["weight"], 0),
      quantity: numberAt(item.system, ["quantity"], 1),
      carried: booleanAt(item.system, ["carried"], true),
    })),
    armour: armour.map((item) => ({
      name: item.name,
      category: armourCategoryAt(item.system, ["category"]),
      acBonus: numberAt(item.system, ["acBonus"], 0),
      equipped: booleanAt(item.system, ["equipped"], false),
    })),
    manualArmourBonus: numberAt(system, ["attributes", "ac", "bonus"], 0),
    initiativeBonus: numberAt(system, ["attributes", "initiative", "bonus"], 0),
    passivePerceptionMode: passiveModeAt(system, ["attributes", "passivePerception", "mode"]),
    poolBonus: numberAt(system, ["resources", "pool", "maxBonus"], 0),
  });

  const abilityMods = Object.fromEntries(
    abilities.map(({ key }) => [key, derived.abilities[key].mod]),
  ) as Record<AbilityKey, number>;

  return {
    actor,
    system,
    form: {
      languagesText: stringArrayAt(system, ["identity", "languages"]).join(", "),
      instrumentsText: stringArrayAt(system, ["proficiencies", "instruments"]).join(", "),
      academiaText: specializationNamesAt(system, ["skillSpecializations", "academia"]).join(", "),
      craftingText: specializationNamesAt(system, ["skillSpecializations", "crafting"]).join(", "),
    },
    disabledAttr,
    editable,
    config: {
      abilities,
      magicAbilities: abilities.filter(({ key }) => ["int", "wis", "cha"].includes(key)),
      skills: canonicalSkills,
      hitDice,
      hitDiceChoices: Object.fromEntries(hitDice.map((die) => [die, die])),
      weaponCategories,
      armourCategories,
      featureCategories,
    },
    derived: {
      ...derived,
      armourClass: calculateArmourClass({
        dexterityModifier: derived.abilities.dex.mod,
        armour: armour.map((item) => ({
          name: item.name,
          category: armourCategoryAt(item.system, ["category"]),
          acBonus: numberAt(item.system, ["acBonus"], 0),
          equipped: booleanAt(item.system, ["equipped"], false),
        })),
        manualBonus: numberAt(system, ["attributes", "ac", "bonus"], 0),
      }),
      totalWeight: calculateTotalWeight(
        equipment.map((item) => ({
          weight: numberAt(item.system, ["weight"], 0),
          quantity: numberAt(item.system, ["quantity"], 1),
          carried: booleanAt(item.system, ["carried"], true),
        })),
      ),
    },
    abilityRows: abilities.map(({ key, label, short }) => ({
      key,
      label,
      short,
      scorePath: `system.abilities.${key}.score`,
      primaryPath: `system.abilities.${key}.primary`,
      score: abilitySources[key].score,
      primary: abilitySources[key].primary,
      mod: derived.abilities[key].mod,
      save: derived.saves[key],
      disabledAttr,
    })),
    skillRows: canonicalSkills.map((skill) => {
      const source = skillSources[skill.id] ?? {
        ability: "int",
        proficient: false,
        deepening: 0,
        expertise: false,
        bonus: 0,
      };
      const total = derived.skills[skill.id]?.total ?? 0;
      return {
        id: skill.id,
        label: skill.label,
        ability: source.ability.toUpperCase(),
        abilityPath: `system.skills.${skill.id}.ability`,
        proficientPath: `system.skills.${skill.id}.proficient`,
        deepeningPath: `system.skills.${skill.id}.deepening`,
        expertisePath: `system.skills.${skill.id}.expertise`,
        bonusPath: `system.skills.${skill.id}.bonus`,
        proficient: source.proficient,
        deepening: source.deepening ?? 0,
        expertise: source.expertise ?? false,
        bonus: source.bonus ?? 0,
        total,
        disabledAttr,
      };
    }),
    items: {
      weapons: weapons.map((item) => ({
        ...item,
        id: itemDocumentId(item),
        disabledAttr,
        summary: calculateAttackSummary({
          proficiencyBonus: derived.proficiencyBonus,
          abilityModifiers: abilityMods,
          weaponProficiencies: objectAt(system, ["proficiencies", "weapons"]) as Record<
            string,
            boolean
          >,
          weapon: {
            category: stringAt(item.system, ["category"], "meleeLight"),
            attackAbility: abilityAt(item.system, ["attack", "ability"], "str"),
            damageAbility: nullableAbilityAt(item.system, ["damage", "ability"]),
            attackBonus: numberAt(item.system, ["attack", "bonus"], 0),
            damageBonus: numberAt(item.system, ["damage", "bonus"], 0),
            damageFormula: stringAt(item.system, ["damage", "formula"], "1d4"),
            range: {
              normal: numberAt(item.system, ["range", "normal"], 0),
              long: numberAt(item.system, ["range", "long"], 0),
            },
          },
        }),
      })),
      armour: withDisabledAttr(armour, disabledAttr),
      equipment: withDisabledAttr(
        itemList.filter((item) => item.type === "equipment"),
        disabledAttr,
      ),
      features: withDisabledAttr(features, disabledAttr),
      magicStreams: withDisabledAttr(magicStreams, disabledAttr),
      magicAbilities: withDisabledAttr(magicAbilities, disabledAttr),
    },
  };
}

export function resolveSheetRoll(
  target: { dataset: { rollKind?: string; key?: string; label?: string } },
  context: CharacterSheetContext,
): SheetRollRequest | null {
  const kind = target.dataset.rollKind;
  const key = target.dataset.key;
  const label = target.dataset.label ?? "Pivot Roll";

  if (kind === "ability" && isAbilityKey(key)) {
    return {
      kind: "d20",
      rollKind: "ability",
      label,
      modifier: context.derived.abilities[key].mod,
      applyAttackCrit: false,
    };
  }
  if (kind === "save" && isAbilityKey(key)) {
    return {
      kind: "d20",
      rollKind: "save",
      label,
      modifier: context.derived.saves[key],
      applyAttackCrit: false,
    };
  }
  if (kind === "skill" && key) {
    return {
      kind: "d20",
      rollKind: "skill",
      label,
      modifier: context.derived.skills[key]?.total ?? 0,
      applyAttackCrit: false,
    };
  }
  if (kind === "initiative") {
    return {
      kind: "d20",
      rollKind: "initiative",
      label,
      modifier: context.derived.initiative,
      applyAttackCrit: false,
    };
  }
  if (kind === "weaponAttack" && key) {
    const weapon = context.items.weapons.find((item) => item.id === key);
    return {
      kind: "d20",
      rollKind: "weaponAttack",
      label,
      modifier: weapon?.summary.bth ?? 0,
      applyAttackCrit: true,
    };
  }
  if (kind === "weaponDamage" && key) {
    const weapon = context.items.weapons.find((item) => item.id === key);
    if (!weapon) return null;
    const bonus = weapon.summary.btd;
    return {
      kind: "formula",
      rollKind: "weaponDamage",
      label,
      formula: `${weapon.summary.damageFormula}${bonus >= 0 ? "+" : ""}${bonus}`,
    };
  }
  if (kind === "magicAbility" && key) {
    const ability = context.items.magicAbilities.find((item) => item.id === key);
    const formula = stringAt(ability?.system ?? {}, ["roll"], "");
    if (!formula) return null;
    return {
      kind: "formula",
      rollKind: "magicAbility",
      label,
      formula,
    };
  }

  return null;
}

export function buildRollModeDialogContent(localize: (key: string) => string): string {
  const options = (["normal", "advantage", "disadvantage", "superAdvantage"] as const)
    .map((mode, index) => {
      const checked = index === 0 ? " checked" : "";
      return `<label><input type="radio" name="mode" value="${mode}"${checked}> ${escapeHtml(
        localize(ROLL_MODE_LABEL_KEYS[mode]),
      )}</label>`;
    })
    .join("");
  return `<fieldset class="pivot-roll-mode-dialog"><legend>${escapeHtml(
    localize("PIVOT.RollDialog.Title"),
  )}</legend>${options}</fieldset>`;
}

export function buildD20ChatFlavor(input: {
  label: string;
  mode: RollMode;
  kept: number;
  modifier: number;
  total: number;
  attackCrit: "hit" | "miss" | null;
  localize: (key: string) => string;
}): string {
  const parts = [
    `${escapeHtml(input.label)} (${escapeHtml(input.localize(ROLL_MODE_LABEL_KEYS[input.mode]))})`,
    `${escapeHtml(input.localize("PIVOT.Chat.KeptD20"))}: ${input.kept}`,
    `${escapeHtml(input.localize("PIVOT.Chat.Modifier"))}: ${formatSigned(input.modifier)}`,
    `${escapeHtml(input.localize("PIVOT.Chat.Total"))}: ${input.total}`,
  ];
  if (input.attackCrit === "hit") {
    parts.push(escapeHtml(input.localize("PIVOT.Chat.AutoHit")));
  }
  if (input.attackCrit === "miss") {
    parts.push(escapeHtml(input.localize("PIVOT.Chat.AutoMiss")));
  }
  return parts.join(" — ");
}

export function naturalResultsFromRoll(roll: {
  dice?: readonly { faces?: number; results?: readonly { result?: number }[] }[];
  terms?: readonly { faces?: number; results?: readonly { result?: number }[] }[];
}): number[] {
  const pools = roll.dice?.length ? roll.dice : (roll.terms ?? []);
  const results: number[] = [];
  for (const die of pools) {
    if (die.faces !== 20) continue;
    for (const entry of die.results ?? []) {
      if (typeof entry.result === "number") results.push(entry.result);
    }
  }
  return results;
}

export function nextResourceValue(
  path: string,
  current: number,
  delta: number,
  poolMax: number,
): number {
  if (path === POOL_VALUE_PATH) {
    if (delta < 0) return spendBoundedResource(current, Math.abs(delta));
    return recoverBoundedResource(current, poolMax, delta);
  }
  if (!Number.isFinite(delta)) return current;
  return Math.max(0, current + delta);
}

export async function applyInitiativeRollToCombat(options: {
  actorId: string | undefined;
  total: number;
  combat: CombatLike | null | undefined;
  notify: (level: "warn" | "error", message: string) => void;
  localize: (key: string) => string;
}): Promise<"updated" | "skipped"> {
  const { actorId, total, combat, notify, localize } = options;
  if (!combat) {
    notify("warn", localize("PIVOT.Combat.NoActiveCombat"));
    return "skipped";
  }
  if (!actorId) {
    notify("warn", localize("PIVOT.Combat.NoCombatant"));
    return "skipped";
  }

  const combatants = getCombatants(combat);
  const selection = selectInitiativeCombatant(
    actorId,
    combatants.map((combatant) => ({
      id: combatant.id ?? "",
      actorId: combatant.actorId ?? null,
    })),
  );

  if (selection.kind === "none") {
    notify("warn", localize("PIVOT.Combat.NoCombatant"));
    return "skipped";
  }
  if (selection.kind === "ambiguous") {
    notify("warn", localize("PIVOT.Combat.MultipleCombatants"));
    return "skipped";
  }

  const combatant = combatants.find((candidate) => candidate.id === selection.combatantId);
  try {
    if (!combatant?.update) {
      notify("error", localize("PIVOT.Combat.InitiativeUpdateFailed"));
      return "skipped";
    }
    await combatant.update({ initiative: total });
  } catch {
    notify("error", localize("PIVOT.Combat.InitiativeUpdateFailed"));
    return "skipped";
  }
  return "updated";
}

export function createEmbeddedItemData(type: string): Record<string, unknown> {
  const nameByType: Record<string, string> = {
    weapon: "New Weapon",
    armour: "New Armour",
    equipment: "New Equipment",
    feature: "New Feature",
    magicStream: "New Magic Stream",
    magicAbility: "New Magic Ability",
  };

  return {
    name: nameByType[type] ?? "New Item",
    type,
  };
}

function getSheetDocument(sheet: object): ActorLike {
  const candidate = sheet as { document?: ActorLike; actor?: ActorLike };
  const actor = candidate.document ?? candidate.actor;
  if (!actor) throw new Error("PivotCharacterSheet requires an Actor document.");
  return actor;
}

async function submitDocumentForm(
  this: { document?: { update?: (data: Record<string, unknown>) => Promise<unknown> } },
  _event: Event,
  _form: HTMLFormElement,
  formData: { object?: Record<string, unknown> },
): Promise<unknown> {
  const data = normalizeSheetSubmitData(formData.object ?? {});
  return this.document?.update?.(data);
}

export function normalizeSheetSubmitData(data: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...data };
  const languagesPath = ["system", "identity", "languagesText"];
  const instrumentsPath = ["system", "proficiencies", "instrumentsText"];
  const academiaPath = ["system", "skillSpecializations", "academiaText"];
  const craftingPath = ["system", "skillSpecializations", "craftingText"];
  const languages = readSubmitPath(normalized, languagesPath);
  const instruments = readSubmitPath(normalized, instrumentsPath);
  const academia = readSubmitPath(normalized, academiaPath);
  const crafting = readSubmitPath(normalized, craftingPath);

  if (typeof languages === "string") {
    setSubmitPath(
      normalized,
      languagesPath,
      ["system", "identity", "languages"],
      splitList(languages),
    );
    deleteSubmitPath(normalized, languagesPath);
  }

  if (typeof instruments === "string") {
    setSubmitPath(
      normalized,
      instrumentsPath,
      ["system", "proficiencies", "instruments"],
      splitList(instruments),
    );
    deleteSubmitPath(normalized, instrumentsPath);
  }

  if (typeof academia === "string") {
    setSubmitPath(
      normalized,
      academiaPath,
      ["system", "skillSpecializations", "academia"],
      specializationEntries(splitList(academia), "int"),
    );
    deleteSubmitPath(normalized, academiaPath);
  }

  if (typeof crafting === "string") {
    setSubmitPath(
      normalized,
      craftingPath,
      ["system", "skillSpecializations", "crafting"],
      specializationEntries(splitList(crafting), "int"),
    );
    deleteSubmitPath(normalized, craftingPath);
  }

  return normalized;
}

async function rollAction(
  this: { document?: ActorLike },
  event: PointerEvent,
  target: HTMLElement,
): Promise<void> {
  event.preventDefault();
  const actor = this.document ?? getSheetDocument(this);
  const context = prepareCharacterSheetContext(actor);
  const request = resolveSheetRoll(target, context);
  if (!request) return;
  const RollConstructor = getRollConstructor();
  if (!RollConstructor) return;

  if (request.kind === "formula") {
    const roll = new RollConstructor(request.formula);
    await roll.evaluate();
    await roll.toMessage({
      speaker: speakerForActor(context.actor),
      flavor: request.label,
    });
    return;
  }

  const mode = await promptRollMode();
  if (!mode) return;

  const resolution = dicePoolForRollMode(mode);
  const poolRoll = new RollConstructor(d20PoolFormula(resolution.dieCount));
  await poolRoll.evaluate();
  const kept = selectKeptD20(naturalResultsFromRoll(poolRoll), resolution);
  const total = kept + request.modifier;
  const attackCrit = request.applyAttackCrit ? applyAttackCrit(kept) : null;
  const flavor = buildD20ChatFlavor({
    label: request.label,
    mode,
    kept,
    modifier: request.modifier,
    total,
    attackCrit,
    localize: localizeText,
  });

  const resultRoll = new RollConstructor(`${kept}${formatSigned(request.modifier)}`);
  await resultRoll.evaluate();
  await resultRoll.toMessage({
    speaker: speakerForActor(context.actor),
    flavor,
  });

  if (request.rollKind === "initiative") {
    await applyInitiativeRollToCombat({
      actorId: actorDocumentId(actor),
      total,
      combat: getActiveCombat(),
      notify: notifyUser,
      localize: localizeText,
    });
  }
}

async function adjustResourceAction(
  this: { document?: ActorLike },
  event: PointerEvent,
  target: HTMLElement,
): Promise<void> {
  event.preventDefault();
  const actor = this.document ?? getSheetDocument(this);
  const path = target.dataset.path;
  const delta = Number(target.dataset.delta ?? 0);
  if (!path || !Number.isFinite(delta)) return;
  const current = numberAt(actor.system, path.split("."), 0);
  const poolMax = prepareCharacterSheetContext(actor).derived.pool.max;
  await actor.update?.({
    [`system.${path}`]: nextResourceValue(path, current, delta, poolMax),
  });
}

async function recoverPoolLongRestAction(
  this: { document?: ActorLike },
  event: PointerEvent,
): Promise<void> {
  event.preventDefault();
  const actor = this.document ?? getSheetDocument(this);
  const current = numberAt(actor.system, ["resources", "pool", "value"], 0);
  const poolMax = prepareCharacterSheetContext(actor).derived.pool.max;
  const next = recoverPoolOnLongRest(current, poolMax);
  if (next === current) {
    notifyUser("info", localizeText("PIVOT.Notifications.PoolAlreadyFull"));
    return;
  }
  await actor.update?.({ "system.resources.pool.value": next });
}

async function createItemAction(
  this: { document?: ActorLike },
  event: PointerEvent,
  target: HTMLElement,
): Promise<void> {
  event.preventDefault();
  const type = target.dataset.type;
  if (!type) return;
  const [item] =
    ((await (this.document ?? getSheetDocument(this)).createEmbeddedDocuments?.("Item", [
      createEmbeddedItemData(type),
    ])) as ItemLike[] | undefined) ?? [];
  item?.sheet?.render?.(true);
}

async function openItemAction(
  this: { document?: ActorLike },
  event: PointerEvent,
  target: HTMLElement,
): Promise<void> {
  event.preventDefault();
  const id = target.dataset.itemId;
  if (!id) return;
  const item = getActorItems(this.document ?? getSheetDocument(this)).find(
    (item) => item.id === id,
  );
  item?.sheet?.render?.(true);
}

async function deleteItemAction(
  this: { document?: ActorLike },
  event: PointerEvent,
  target: HTMLElement,
): Promise<void> {
  event.preventDefault();
  const id = target.dataset.itemId;
  if (!id) return;
  await (this.document ?? getSheetDocument(this)).deleteEmbeddedDocuments?.("Item", [id]);
}

function getActorItems(actor: ActorLike): ItemLike[] {
  const items = actor.items;
  if (!items) return [];
  if ("contents" in items) return items.contents;
  return Array.from(items);
}

function objectAt(source: RecordValue, path: string[]): RecordValue {
  let current: unknown = source;
  for (const part of path) {
    if (!isRecord(current)) return {};
    current = current[part];
  }
  return isRecord(current) ? current : {};
}

function numberAt(source: RecordValue, path: string[], fallback: number): number {
  let current: unknown = source;
  for (const part of path) {
    if (!isRecord(current)) return fallback;
    current = current[part];
  }
  return typeof current === "number" && Number.isFinite(current) ? current : fallback;
}

function stringAt(source: RecordValue, path: string[], fallback: string): string {
  let current: unknown = source;
  for (const part of path) {
    if (!isRecord(current)) return fallback;
    current = current[part];
  }
  return typeof current === "string" ? current : fallback;
}

function booleanAt(source: RecordValue, path: string[], fallback: boolean): boolean {
  let current: unknown = source;
  for (const part of path) {
    if (!isRecord(current)) return fallback;
    current = current[part];
  }
  return typeof current === "boolean" ? current : fallback;
}

function stringArrayAt(source: RecordValue, path: string[]): string[] {
  let current: unknown = source;
  for (const part of path) {
    if (!isRecord(current)) return [];
    current = current[part];
  }
  return Array.isArray(current)
    ? current.filter((value): value is string => typeof value === "string")
    : [];
}

function specializationNamesAt(source: RecordValue, path: string[]): string[] {
  let current: unknown = source;
  for (const part of path) {
    if (!isRecord(current)) return [];
    current = current[part];
  }
  if (!Array.isArray(current)) return [];
  return current.flatMap((value) => {
    if (typeof value === "string") return [value];
    if (isRecord(value) && typeof value.name === "string") return [value.name];
    return [];
  });
}

function specializationEntries(
  names: string[],
  ability: AbilityKey,
): Array<Record<string, unknown>> {
  return names.map((name) => ({
    name,
    ability,
    proficient: true,
    deepening: 0,
    expertise: false,
    bonus: 0,
  }));
}

function withDisabledAttr<T extends ItemLike>(
  items: T[],
  disabledAttr: "" | "disabled",
): Array<T & { disabledAttr: "" | "disabled" }> {
  return items.map((item) => ({ ...item, id: itemDocumentId(item), disabledAttr }));
}

function itemDocumentId(item: ItemLike): string | undefined {
  return item.id ?? item._id;
}

function abilityAt(source: RecordValue, path: string[], fallback: AbilityKey): AbilityKey {
  const value = stringAt(source, path, fallback);
  return isAbilityKey(value) ? value : fallback;
}

function nullableAbilityAt(source: RecordValue, path: string[]): AbilityKey | null {
  const value = stringAt(source, path, "");
  return isAbilityKey(value) ? value : null;
}

function magicAbility(system: RecordValue): AbilityKey {
  return nullableAbilityAt(system, ["magic", "ability"]) ?? "int";
}

function armourCategoryAt(
  source: RecordValue,
  path: string[],
): "light" | "medium" | "heavy" | "shield" | "helmet" | "other" {
  const value = stringAt(source, path, "other");
  return ["light", "medium", "heavy", "shield", "helmet", "other"].includes(value)
    ? (value as "light" | "medium" | "heavy" | "shield" | "helmet" | "other")
    : "other";
}

function passiveModeAt(source: RecordValue, path: string[]): PassivePerceptionMode {
  const value = stringAt(source, path, "normal");
  if (value === "advantage" || value === "disadvantage") return value;
  return "normal";
}

function isAbilityKey(value: unknown): value is AbilityKey {
  return typeof value === "string" && abilities.some((ability) => ability.key === value);
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null;
}

function actorDocumentId(actor: ActorLike): string | undefined {
  return actor.id ?? actor._id;
}

function getCombatants(combat: CombatLike): CombatantLike[] {
  const combatants = combat.combatants;
  if (!combatants) return [];
  if ("contents" in combatants) return combatants.contents;
  return Array.from(combatants);
}

function getActiveCombat(): CombatLike | null {
  const game = globalThis as typeof globalThis & { game?: { combat?: CombatLike | null } };
  return game.game?.combat ?? null;
}

function getRollConstructor():
  | (new (formula: string) => {
      evaluate(options?: Record<string, unknown>): Promise<unknown>;
      toMessage(message?: Record<string, unknown>): Promise<unknown>;
      dice?: readonly { faces?: number; results?: readonly { result?: number }[] }[];
      terms?: readonly { faces?: number; results?: readonly { result?: number }[] }[];
    })
  | undefined {
  const globals = globalThis as typeof globalThis & {
    Roll?: new (formula: string) => {
      evaluate(options?: Record<string, unknown>): Promise<unknown>;
      toMessage(message?: Record<string, unknown>): Promise<unknown>;
      dice?: readonly { faces?: number; results?: readonly { result?: number }[] }[];
      terms?: readonly { faces?: number; results?: readonly { result?: number }[] }[];
    };
  };
  return globals.Roll;
}

async function promptRollMode(): Promise<RollMode | null> {
  const foundry = globalThis as typeof globalThis & {
    foundry?: {
      applications?: {
        api?: {
          DialogV2?: {
            prompt: (config: Record<string, unknown>) => Promise<unknown>;
          };
        };
      };
    };
  };
  const DialogV2 = foundry.foundry?.applications?.api?.DialogV2;
  if (!DialogV2) return null;

  try {
    const result = await DialogV2.prompt({
      window: { title: localizeText("PIVOT.RollDialog.Title") },
      content: buildRollModeDialogContent(localizeText),
      ok: {
        label: localizeText("PIVOT.RollDialog.Roll"),
        callback: (_event: unknown, button: { form?: HTMLFormElement }) => {
          const selected = button.form?.querySelector("input[name='mode']:checked");
          const value = selected && "value" in selected ? String(selected.value) : "normal";
          return isRollMode(value) ? value : "normal";
        },
      },
      buttons: [
        {
          action: "cancel",
          label: localizeText("PIVOT.RollDialog.Cancel"),
          callback: () => null,
        },
      ],
      rejectClose: false,
    });
    return isRollMode(result) ? result : null;
  } catch {
    return null;
  }
}

function localizeText(key: string): string {
  const game = globalThis as typeof globalThis & {
    game?: { i18n?: { localize?: (path: string) => string } };
  };
  return game.game?.i18n?.localize?.(key) || key;
}

function notifyUser(level: "info" | "warn" | "error", message: string): void {
  const ui = globalThis as typeof globalThis & {
    ui?: {
      notifications?: {
        info?: (text: string) => void;
        warn?: (text: string) => void;
        error?: (text: string) => void;
      };
    };
  };
  ui.ui?.notifications?.[level]?.(message);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatSigned(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

function speakerForActor(actor: ActorLike): Record<string, unknown> {
  const globals = globalThis as typeof globalThis & {
    ChatMessage?: { getSpeaker?: (options: { actor: ActorLike }) => Record<string, unknown> };
  };
  const ChatMessage = globals.ChatMessage as
    { getSpeaker?: (options: { actor: ActorLike }) => Record<string, unknown> } | undefined;
  return ChatMessage?.getSpeaker?.({ actor }) ?? { alias: actor.name };
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function readPath(source: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = source;
  for (const part of path) {
    if (!isRecord(current)) return undefined;
    current = current[part];
  }
  return current;
}

function readSubmitPath(source: Record<string, unknown>, path: string[]): unknown {
  const flatPath = path.join(".");
  if (Object.hasOwn(source, flatPath)) return source[flatPath];
  return readPath(source, path);
}

function setSubmitPath(
  source: Record<string, unknown>,
  originalPath: string[],
  targetPath: string[],
  value: unknown,
): void {
  const flatOriginalPath = originalPath.join(".");
  if (Object.hasOwn(source, flatOriginalPath)) {
    source[targetPath.join(".")] = value;
    return;
  }

  setPath(source, targetPath, value);
}

function setPath(source: Record<string, unknown>, path: string[], value: unknown): void {
  let current = source;
  for (const part of path.slice(0, -1)) {
    const next = current[part];
    if (!isRecord(next)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  const final = path[path.length - 1];
  if (final) current[final] = value;
}

function deleteSubmitPath(source: Record<string, unknown>, path: string[]): void {
  const flatPath = path.join(".");
  if (Object.hasOwn(source, flatPath)) {
    Reflect.deleteProperty(source, flatPath);
    return;
  }

  deletePath(source, path);
}

function deletePath(source: Record<string, unknown>, path: string[]): void {
  let current: unknown = source;
  for (const part of path.slice(0, -1)) {
    if (!isRecord(current)) return;
    current = current[part];
  }
  const final = path[path.length - 1];
  if (final && isRecord(current)) Reflect.deleteProperty(current, final);
}

async function callOptionalSuper(
  instance: object,
  method: string,
  options: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const proto = Object.getPrototypeOf(Object.getPrototypeOf(instance)) as Record<
    string,
    unknown
  > | null;
  const fn = proto?.[method];
  if (typeof fn !== "function") return {};
  const result = (await Reflect.apply(fn, instance, [options])) as unknown;
  return isRecord(result) ? result : {};
}
