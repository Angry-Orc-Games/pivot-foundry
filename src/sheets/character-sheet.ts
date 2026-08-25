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
import {
  type AbilityKey,
  calculateArmourClass,
  calculateAttackSummary,
  calculateCharacterDerived,
  calculateTotalWeight,
  type PassivePerceptionMode,
  type SkillSourceMap,
} from "../rules/character-derived";

const CHARACTER_TEMPLATE = `systems/${SYSTEM_ID}/templates/actors/character-sheet.hbs`;

type RecordValue = Record<string, unknown>;

export interface ItemLike {
  id?: string;
  name: string;
  type: string;
  system: RecordValue;
}

export interface ActorLike {
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
        activateTab: activateTabAction,
        adjustResource: adjustResourceAction,
        createItem: createItemAction,
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

export function buildRollFormula(kind: string, value: number): string {
  if (kind === "damage") return value === 0 ? "0" : String(value);
  return `1d20${value >= 0 ? "+" : ""}${value}`;
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
  const languages = readPath(normalized, ["system", "identity", "languagesText"]);
  const instruments = readPath(normalized, ["system", "proficiencies", "instrumentsText"]);
  const academia = readPath(normalized, ["system", "skillSpecializations", "academiaText"]);
  const crafting = readPath(normalized, ["system", "skillSpecializations", "craftingText"]);

  if (typeof languages === "string") {
    setPath(normalized, ["system", "identity", "languages"], splitList(languages));
    deletePath(normalized, ["system", "identity", "languagesText"]);
  }

  if (typeof instruments === "string") {
    setPath(normalized, ["system", "proficiencies", "instruments"], splitList(instruments));
    deletePath(normalized, ["system", "proficiencies", "instrumentsText"]);
  }

  if (typeof academia === "string") {
    setPath(
      normalized,
      ["system", "skillSpecializations", "academia"],
      specializationEntries(splitList(academia), "int"),
    );
    deletePath(normalized, ["system", "skillSpecializations", "academiaText"]);
  }

  if (typeof crafting === "string") {
    setPath(
      normalized,
      ["system", "skillSpecializations", "crafting"],
      specializationEntries(splitList(crafting), "int"),
    );
    deletePath(normalized, ["system", "skillSpecializations", "craftingText"]);
  }

  return normalized;
}

function activateTabAction(_event: PointerEvent, target: HTMLElement): void {
  const tab = target.dataset.tab;
  const group = target.dataset.group ?? "primary";
  if (!tab) return;

  const sheet = target.closest(".pivot-character-sheet");
  if (!sheet) return;

  for (const link of sheet.querySelectorAll<HTMLElement>(`.pivot-tabs [data-group="${group}"]`)) {
    link.classList.toggle("active", link.dataset.tab === tab);
  }

  for (const panel of sheet.querySelectorAll<HTMLElement>(`.tab[data-group="${group}"]`)) {
    panel.classList.toggle("active", panel.dataset.tab === tab);
  }
}

async function rollAction(
  this: { document?: ActorLike },
  event: PointerEvent,
  target: HTMLElement,
): Promise<void> {
  event.preventDefault();
  const context = prepareCharacterSheetContext(this.document ?? getSheetDocument(this));
  const formula = rollFormulaFromTarget(target, context);
  if (!formula) return;
  const globals = globalThis as typeof globalThis & {
    Roll?: new (formula: string) => {
      evaluate(options?: Record<string, unknown>): Promise<unknown>;
      toMessage(message?: Record<string, unknown>): Promise<unknown>;
    };
  };
  const RollConstructor = globals.Roll as
    | (new (formula: string) => {
        evaluate(options?: Record<string, unknown>): Promise<unknown>;
        toMessage(message?: Record<string, unknown>): Promise<unknown>;
      })
    | undefined;
  if (!RollConstructor) return;
  const roll = new RollConstructor(formula);
  await roll.evaluate({ async: true });
  await roll.toMessage({
    speaker: speakerForActor(context.actor),
    flavor: target.dataset.label ?? "Pivot Roll",
  });
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
  await actor.update?.({ [`system.${path}`]: Math.max(0, current + delta) });
}

async function createItemAction(
  this: { document?: ActorLike },
  event: PointerEvent,
  target: HTMLElement,
): Promise<void> {
  event.preventDefault();
  const type = target.dataset.type;
  if (!type) return;
  await (this.document ?? getSheetDocument(this)).createEmbeddedDocuments?.("Item", [
    createEmbeddedItemData(type),
  ]);
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

function rollFormulaFromTarget(target: HTMLElement, context: CharacterSheetContext): string | null {
  const kind = target.dataset.rollKind;
  const key = target.dataset.key;

  if (kind === "ability" && isAbilityKey(key))
    return buildRollFormula(kind, context.derived.abilities[key].mod);
  if (kind === "save" && isAbilityKey(key))
    return buildRollFormula(kind, context.derived.saves[key]);
  if (kind === "skill" && key)
    return buildRollFormula(kind, context.derived.skills[key]?.total ?? 0);
  if (kind === "initiative") return buildRollFormula(kind, context.derived.initiative);
  if (kind === "weaponAttack" && key) {
    const weapon = context.items.weapons.find((item) => item.id === key);
    return buildRollFormula(kind, weapon?.summary.bth ?? 0);
  }
  if (kind === "weaponDamage" && key) {
    const weapon = context.items.weapons.find((item) => item.id === key);
    if (!weapon) return null;
    const bonus = weapon.summary.btd;
    return `${weapon.summary.damageFormula}${bonus >= 0 ? "+" : ""}${bonus}`;
  }
  if (kind === "magicAbility" && key) {
    const ability = context.items.magicAbilities.find((item) => item.id === key);
    return stringAt(ability?.system ?? {}, ["roll"], "");
  }

  return null;
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
  return items.map((item) => ({ ...item, disabledAttr }));
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
