# Character Sheet Feature Specification

## 1. Summary

Build a native Foundry VTT v13 character sheet for the `pivot-fantasy` system. The sheet should preserve the PDF's workflow: identity and table-play state first, then skills/proficiencies, attacks, equipment, magic, feats, flaws, and notes. It must not embed or display the PDF as a static asset.

The implementation should start with a data-backed character Actor model and v13-compatible Actor sheet, then introduce minimal Item document types for repeatable gameplay objects. Derived values should be calculated from source fields and embedded Items instead of duplicated in actor data.

## 2. Current System Architecture Relevant To The Change

- `system.json` declares Foundry compatibility minimum/verified `13`, package id `pivot-fantasy`, one Actor document type `character`, no Item document types, no styles, no packs, and no template assets.
- `src/pivot.ts` defines `PivotCharacterData extends foundry.abstract.TypeDataModel` with an empty schema and registers it at `CONFIG.Actor.dataModels.character` during `Hooks.once("init")`.
- No existing character sheet, NPC sheet, item sheet, Handlebars templates, CSS, compendium packs, migrations, or Foundry-facing roll UI exist.
- Existing pure rules modules:
  - `src/rules/modifiers.ts`: `abilityModifier(score)` and `proficiencyBonusForLevel(level)`.
  - `src/rules/d20-roll.ts`: advantage/disadvantage dice pool resolution and natural 20/1 attack result classification.
- Tests currently cover manifest Actor subtype registration and the two rules modules.
- Project guidance requires deterministic game math in `src/rules/`, thin Foundry lifecycle/sheet wiring, local Foundry v13 API verification, localization in `lang/en.json`, and clear separation between repo verification and manual Foundry acceptance.

Foundry v13 compatibility note: official v13 API docs expose `foundry.applications.sheets.ActorSheetV2` and `foundry.applications.api.DocumentSheetV2`; legacy `foundry.appv1.sheets.ActorSheet` exists but is deprecated since v13. The character sheet should therefore use the v13 V2 sheet stack unless a direct local Foundry v13 smoke test reveals a blocker.

## 3. PDF Field Inventory

The PDF is a 2-page US Letter AcroForm with generic form field names, so the semantic inventory below is based on the visible layout and Pivot rules text, not on PDF field identifiers.

### Page 1: Identity And Progression

| PDF label      | Purpose                                   | Proposed data path                                                                                                            | Type                       | Editable                     | Existing/new       | Validation                                          | Related rules/calculations                                                                                       | Document type | UI control                                                      |
| -------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ---------------------------- | ------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------- | --------------------------------------------------------------- |
| Character Name | Actor display name                        | `Actor.name`                                                                                                                  | string                     | Editable                     | Existing Foundry   | Required by Foundry conventions; trim whitespace    | None                                                                                                             | Actor         | Text input in sheet header                                      |
| Level          | Advancement level                         | `system.progression.level`                                                                                                    | integer                    | Editable                     | New Actor data     | Integer >= 1; practical cap 20 unless rules expand  | `proficiencyBonusForLevel`; Pool max; MP formula                                                                 | Actor         | Number input/stepper                                            |
| XP             | Advancement tracking                      | `system.progression.xp`                                                                                                       | integer                    | Editable                     | New Actor data     | Integer >= 0                                        | Advancement mode may be campaign-specific                                                                        | Actor         | Number input                                                    |
| Player         | Owning/player name display                | `system.identity.player`                                                                                                      | string                     | Editable                     | New Actor data     | Optional trimmed string                             | None                                                                                                             | Actor         | Text input                                                      |
| Background     | Character background                      | Prefer embedded `background`/`feature` Item; fallback display `system.identity.backgroundText` only until content item exists | item reference or string   | Editable via item management | New Item preferred | At most one active background item in v1            | Background grants skills/proficiencies/languages/features, but exact automation should wait for content modeling | Item/Actor    | Drop zone + item link, with manual text fallback only if needed |
| Species        | Species/ancestry                          | Prefer embedded `species`/`feature` Item; fallback `system.identity.speciesText`                                              | item reference or string   | Editable via item management | New Item preferred | At most one active species item in v1               | Species can affect ability scores, speed, traits                                                                 | Item/Actor    | Drop zone + item link                                           |
| Languages      | Known languages                           | `system.identity.languages`                                                                                                   | string array               | Editable                     | New Actor data     | Trim non-empty entries; allow custom                | Language count may derive from feats/Intelligence later, but selected languages are source data                  | Actor         | Tag/chip list with add/remove                                   |
| Loyalty        | Allegiance/relationship hook              | `system.identity.loyalty`                                                                                                     | string                     | Editable                     | New Actor data     | Optional trimmed string                             | Meaning not defined in inspected code/rules snippets                                                             | Actor         | Text input                                                      |
| Weight         | Physical description and carrying context | `system.identity.weight`                                                                                                      | number or string with unit | Editable                     | New Actor data     | Prefer `{ value: number, unit: "kg" }`; allow blank | Carrying capacity may use weight only for mounts/edge cases, not current sheet math                              | Actor         | Number input + unit label                                       |
| Height         | Physical description                      | `system.identity.height`                                                                                                      | string                     | Editable                     | New Actor data     | Optional trimmed string                             | None                                                                                                             | Actor         | Text input                                                      |
| Age            | Physical description                      | `system.identity.age`                                                                                                         | string or integer          | Editable                     | New Actor data     | Optional; integer if numeric                        | None                                                                                                             | Actor         | Text input or number                                            |
| Eyes           | Physical description                      | `system.identity.eyes`                                                                                                        | string                     | Editable                     | New Actor data     | Optional trimmed string                             | None                                                                                                             | Actor         | Text input                                                      |
| Hair           | Physical description                      | `system.identity.hair`                                                                                                        | string                     | Editable                     | New Actor data     | Optional trimmed string                             | None                                                                                                             | Actor         | Text input                                                      |
| Flaw           | Short flaw display                        | Prefer embedded `flaw` Item(s); header may show first active flaw name derived from items                                     | derived string             | Calculated/display           | New Item preferred | None on derived value                               | Flaws grant build points and restrictions; do not automate until content model exists                            | Item/Actor    | Item link/drop zone; read-only summary in header                |

### Page 1: Abilities

| PDF label                    | Purpose                          | Proposed data path             | Type                            | Editable                             | Existing/new   | Validation                                                                     | Related rules/calculations                                                                  | Document type       | UI control                        |
| ---------------------------- | -------------------------------- | ------------------------------ | ------------------------------- | ------------------------------------ | -------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------- | --------------------------------- |
| Strength score               | Physical power                   | `system.abilities.str.score`   | integer                         | Editable                             | New Actor data | Integer 1-30; initial 10                                                       | Modifier from `abilityModifier`; melee attack/damage; Athletics; carrying; saves if primary | Actor               | Number input                      |
| Strength prime               | Primary Ability/save proficiency | `system.abilities.str.primary` | boolean                         | Editable                             | New Actor data | Up to two primary abilities by default; allow GM override only if later needed | Adds proficiency to Strength saving throws                                                  | Actor               | Checkbox/toggle                   |
| Strength modifier bubble     | Ability bonus                    | `system.abilities.str.mod`     | integer                         | Calculated                           | Derived        | Derived only                                                                   | `abilityModifier(score)`                                                                    | Actor prepared data | Read-only roll button/score badge |
| Dexterity score/prime/mod    | Agility                          | `system.abilities.dex.*`       | integer/boolean/derived integer | Score/prime editable, mod calculated | New/derived    | Same as Strength                                                               | Initiative, AC, ranged attacks, Dex skills, saves if primary                                | Actor               | Number, checkbox, roll button     |
| Constitution score/prime/mod | Health and endurance             | `system.abilities.con.*`       | integer/boolean/derived integer | Score/prime editable, mod calculated | New/derived    | Same as Strength                                                               | HP by level, short rest healing, saves if primary                                           | Actor               | Number, checkbox, roll button     |
| Intelligence score/prime/mod | Learning and reason              | `system.abilities.int.*`       | integer/boolean/derived integer | Score/prime editable, mod calculated | New/derived    | Same as Strength                                                               | Free skills, Int skills, possible magic ability                                             | Actor               | Number, checkbox, roll button     |
| Wisdom score/prime/mod       | Awareness/instinct               | `system.abilities.wis.*`       | integer/boolean/derived integer | Score/prime editable, mod calculated | New/derived    | Same as Strength                                                               | Passive Perception, Wis skills, possible magic ability                                      | Actor               | Number, checkbox, roll button     |
| Charisma score/prime/mod     | Presence                         | `system.abilities.cha.*`       | integer/boolean/derived integer | Score/prime editable, mod calculated | New/derived    | Same as Strength                                                               | Social skills, possible magic ability                                                       | Actor               | Number, checkbox, roll button     |

### Page 1: Combat Summary And Resources

| PDF label           | Purpose                                       | Proposed data path                          | Type        | Editable                                         | Existing/new           | Validation                                                        | Related rules/calculations                                                                                        | Document type                | UI control                                   |
| ------------------- | --------------------------------------------- | ------------------------------------------- | ----------- | ------------------------------------------------ | ---------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------- |
| Prof. Bonus         | Level-derived proficiency bonus               | `system.attributes.proficiency`             | integer     | Calculated                                       | Derived                | Derived only                                                      | `proficiencyBonusForLevel(level)`                                                                                 | Actor prepared data          | Read-only badge                              |
| Armour Class        | Defense target number                         | `system.attributes.ac.value`                | integer     | Calculated with manual bonus source              | Derived/new sources    | Derived value read-only; manual bonus integer allowed             | 10 + Dex mod + armour/shield/helmet/species/feat modifiers; exact full automation can start with manual modifiers | Actor + armour/feature Items | Read-only roll target with tooltip breakdown |
| Initiative          | Combat order bonus                            | `system.attributes.initiative.value`        | integer     | Calculated with manual bonus source              | Derived/new sources    | Derived only plus `system.attributes.initiative.bonus` integer    | Usually Dex mod; feats may add bonuses/proficiency                                                                | Actor + feature Items        | Roll button + read-only bonus                |
| Speed               | Movement metres/squares                       | `system.attributes.speed.value`             | integer     | Editable until species/content automation exists | New Actor data         | Integer >= 0                                                      | Species sets base speed; armour/flaws/features can modify                                                         | Actor + feature Items        | Number input                                 |
| Pass. Percep.       | Passive Perception                            | `system.attributes.passivePerception.value` | integer     | Calculated                                       | Derived                | Derived only                                                      | 10 + Perception check bonus; +/-5 for advantage/disadvantage; feats may add flat bonuses                          | Actor prepared data          | Read-only badge                              |
| Armour Worn         | Quick equipped armour summary                 | Derived from equipped armour Items          | string      | Calculated                                       | Derived from new Items | None                                                              | Equipped armour contributes AC and penalties                                                                      | Item                         | Read-only item link/summary                  |
| Hit Die             | Die size used for HP recovery and Pool        | `system.attributes.hitDie`                  | enum string | Editable                                         | New Actor data         | One of `d4`, `d6`, `d8`, `d10`, `d12`                             | Build point cost; short rest healing die                                                                          | Actor                        | Select                                       |
| Hit Points          | Maximum HP                                    | `system.attributes.hp.max`                  | integer     | Editable initially                               | New Actor data         | Integer >= 0                                                      | Character creation/level HP use hit die + Con mod, but history of rolls is not currently modeled                  | Actor                        | Number input                                 |
| Current HP          | Current HP                                    | `system.attributes.hp.value`                | integer     | Editable                                         | New Actor data         | Integer 0..max unless temp/negative rules later require otherwise | Death saves when 0 HP                                                                                             | Actor                        | Resource bar + number input                  |
| Pool                | Current available Hit Dice                    | `system.resources.pool.value`               | integer     | Editable with spend/recover buttons              | New Actor data         | Integer 0..max                                                    | Pool max usually level, modified by flaws/features; long rest recovers half rounded down minimum 1                | Actor                        | Resource boxes/stepper                       |
| Pool max            | Not explicitly labeled, implied by level/Pool | `system.resources.pool.max`                 | integer     | Calculated with override source                  | Derived/new sources    | Derived from level plus modifiers; never below 1                  | Pool equals level/Hit Dice; flaw may reduce                                                                       | Actor prepared data          | Read-only max in resource control            |
| Death Saves success | Dying progress                                | `system.attributes.deathSaves.successes`    | integer     | Editable/resettable                              | New Actor data         | Integer 0-3                                                       | Death save rules when at 0 HP                                                                                     | Actor                        | Three checkboxes + reset button              |
| Death Saves failure | Dying progress                                | `system.attributes.deathSaves.failures`     | integer     | Editable/resettable                              | New Actor data         | Integer 0-3                                                       | Death save rules when at 0 HP                                                                                     | Actor                        | Three checkboxes + reset button              |

### Page 1: Skills

Use canonical skill rows for: Acrobatics, Alchemy, Animal Handling, Athletics, Control Magic, Deception, Insight, Intimidation, Investigation, Medicine, Medicine: Holistic, Nature, Navigation, Perception, Performance, Persuasion, Religion, Sleight of Hand, Stealth, Survival, Thievery. The PDF also has repeatable rows for Academia and Crafting specializations.

| PDF label                  | Purpose                                                                   | Proposed data path                                                                                                       | Type                 | Editable                                          | Existing/new          | Validation                                                                                             | Related rules/calculations                                                     | Document type       | UI control                                       |
| -------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------- | ------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | ------------------- | ------------------------------------------------ |
| Skill proficiency checkbox | Whether trained/proficient                                                | `system.skills.<id>.proficient`                                                                                          | boolean              | Editable                                          | New Actor data        | Boolean                                                                                                | Add proficiency bonus when true                                                | Actor               | Checkbox/toggle                                  |
| Skill name                 | Skill identity/specialization                                             | Canonical from config for fixed skills; `system.skills.academia.entries[].name`; `system.skills.crafting.entries[].name` | string               | Fixed for canonical, editable for specializations | New Actor data        | Specialization names non-empty, unique per group if possible                                           | Academia/Crafting are taken separately by specialization                       | Actor               | Label or text input                              |
| Ability label              | Default ability                                                           | `system.skills.<id>.ability`                                                                                             | ability enum         | Editable only for Varies/custom rows              | New Actor data/config | One of `str,dex,con,int,wis,cha`; Control Magic can be selected only when Awakened/magic ability known | Default skill ability from rules; GM may vary                                  | Actor               | Select for variable/custom rows, label otherwise |
| Bonus line                 | Total skill bonus                                                         | `system.skills.<id>.total`                                                                                               | integer              | Calculated                                        | Derived               | Derived only                                                                                           | ability mod + proficiency if proficient + deepening/expertise/manual modifiers | Actor prepared data | Roll button/read-only number                     |
| Skill deepening            | Extra trained-skill bonus not shown directly on PDF but required by rules | `system.skills.<id>.deepening`                                                                                           | integer              | Editable                                          | New Actor data        | Integer >= 0; <= proficiency bonus; not allowed for Control Magic                                      | Advancement rule                                                               | Actor               | Number input in expanded row                     |
| Expertise                  | Double proficiency, referenced in rules but not directly displayed        | `system.skills.<id>.expertise`                                                                                           | boolean/integer rank | Editable                                          | New Actor data        | Boolean for first implementation; future rank for quadruple proficiency if modeled                     | Expertise feats/backgrounds                                                    | Actor/feature Items | Toggle in expanded row                           |
| Manual modifier            | Temporary/permanent bonus not itemized                                    | `system.skills.<id>.bonus`                                                                                               | integer              | Editable                                          | New Actor data        | Integer                                                                                                | Feats/items may later replace this                                             | Actor               | Number input in expanded row                     |

### Page 1: Proficiencies And Currency

| PDF label       | Purpose                        | Proposed data path                                 | Type         | Editable | Existing/new   | Validation                | Related rules/calculations                                    | Document type | UI control                        |
| --------------- | ------------------------------ | -------------------------------------------------- | ------------ | -------- | -------------- | ------------------------- | ------------------------------------------------------------- | ------------- | --------------------------------- |
| Armour: Light   | Armour training                | `system.proficiencies.armour.light`                | boolean      | Editable | New Actor data | Boolean                   | Avoid armour penalties; activates armour systems              | Actor         | Checkbox                          |
| Armour: Medium  | Armour training                | `system.proficiencies.armour.medium`               | boolean      | Editable | New Actor data | Boolean                   | Avoid armour penalties; Dex cap rules                         | Actor         | Checkbox                          |
| Armour: Heavy   | Armour training                | `system.proficiencies.armour.heavy`                | boolean      | Editable | New Actor data | Boolean                   | Avoid armour penalties; no Dex AC                             | Actor         | Checkbox                          |
| Shields         | Shield training                | `system.proficiencies.shields`                     | boolean      | Editable | New Actor data | Boolean                   | Active protect-someone shield option                          | Actor         | Checkbox                          |
| Instrument      | Performance/tool family        | `system.proficiencies.instruments[]`               | string array | Editable | New Actor data | Non-empty trimmed entries | Performance proficiencies are families                        | Actor         | Checkbox + text input or tag list |
| Bows            | Weapon category training       | `system.proficiencies.weapons.bows`                | boolean      | Editable | New Actor data | Boolean                   | Adds proficiency to bow attack rolls                          | Actor         | Checkbox                          |
| Crossbows       | Weapon category training       | `system.proficiencies.weapons.crossbows`           | boolean      | Editable | New Actor data | Boolean                   | Adds proficiency to crossbow attack rolls; point-blank nuance | Actor         | Checkbox                          |
| Thrown Weapons  | Weapon category training       | `system.proficiencies.weapons.thrown`              | boolean      | Editable | New Actor data | Boolean                   | Adds proficiency to thrown attack rolls                       | Actor         | Checkbox                          |
| Melee: Light    | Weapon category training       | `system.proficiencies.weapons.meleeLight`          | boolean      | Editable | New Actor data | Boolean                   | Adds proficiency to light melee attacks                       | Actor         | Checkbox                          |
| Melee: Medium   | Weapon category training       | `system.proficiencies.weapons.meleeMedium`         | boolean      | Editable | New Actor data | Boolean                   | Adds proficiency to medium melee attacks                      | Actor         | Checkbox                          |
| Melee: Heavy    | Weapon category training       | `system.proficiencies.weapons.meleeHeavy`          | boolean      | Editable | New Actor data | Boolean                   | Adds proficiency to heavy melee attacks                       | Actor         | Checkbox                          |
| Melee: 2-Handed | Weapon category training       | `system.proficiencies.weapons.meleeTwoHandedHeavy` | boolean      | Editable | New Actor data | Boolean                   | Adds proficiency to two-handed heavy melee attacks            | Actor         | Checkbox                          |
| Improvised      | Improvised weapon training     | `system.proficiencies.weapons.improvised`          | boolean      | Editable | New Actor data | Boolean                   | Improvised damage die and attack proficiency                  | Actor         | Checkbox                          |
| GP              | Gold pieces                    | `system.currency.gp`                               | integer      | Editable | New Actor data | Integer >= 0              | Inventory economy only                                        | Actor         | Number input                      |
| SP              | Silver pieces                  | `system.currency.sp`                               | integer      | Editable | New Actor data | Integer >= 0              | Inventory economy only                                        | Actor         | Number input                      |
| CP              | Copper pieces                  | `system.currency.cp`                               | integer      | Editable | New Actor data | Integer >= 0              | Inventory economy only                                        | Actor         | Number input                      |
| Other           | Nonstandard currency/valuables | `system.currency.other`                            | string       | Editable | New Actor data | Optional trimmed text     | None                                                          | Actor         | Text input                        |

### Page 1: Arms And Bearings - Weapons And Attacks

Represent each weapon/attack row as an embedded `weapon` Item. Do not store attack rows as actor-only arrays except for temporary custom attacks if the project explicitly defers Items.

| PDF label | Purpose               | Proposed data path                                          | Type        | Editable                      | Existing/new            | Validation                                                                | Related rules/calculations                                                                                                 | Document type      | UI control                               |
| --------- | --------------------- | ----------------------------------------------------------- | ----------- | ----------------------------- | ----------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------ | ---------------------------------------- |
| Weapon    | Attack item name      | `Item.name`                                                 | string      | Editable                      | New Item data           | Required non-empty                                                        | Weapon category determines base dice and proficiency                                                                       | Item.weapon        | Item row link/text input                 |
| BTH       | Bonus to hit          | `weapon.system.attack.total`                                | integer     | Calculated with manual source | Derived from Item+Actor | Derived only; allow `weapon.system.attack.bonus` integer                  | Ability mod + proficiency if category trained + item/quality/feat bonuses; acronym meaning not expanded in inspected text  | Item prepared data | Roll button/read-only bonus with tooltip |
| BTD       | Bonus to damage       | `weapon.system.damage.bonusTotal`                           | integer     | Calculated with manual source | Derived from Item+Actor | Derived only; allow `weapon.system.damage.bonus` integer                  | Strength or other rule-specific damage modifier, item/quality/feat bonuses; acronym meaning not expanded in inspected text | Item prepared data | Read-only number                         |
| DMG       | Damage dice/type      | `weapon.system.damage.formula`, `weapon.system.damage.type` | string/enum | Editable                      | New Item data           | Formula constrained to dice notation subset; damage type from enum/custom | Damage dice explode                                                                                                        | Item.weapon        | Text/select; damage roll button          |
| R: Norm   | Normal range          | `weapon.system.range.normal`                                | integer     | Editable                      | New Item data           | Integer >= 0, metres                                                      | Long-range attacks at disadvantage after normal range                                                                      | Item.weapon        | Number input                             |
| R: Long   | Long range            | `weapon.system.range.long`                                  | integer     | Editable                      | New Item data           | Integer >= normal                                                         | Attacks beyond long impossible                                                                                             | Item.weapon        | Number input                             |
| Notes     | Weapon traits/context | `weapon.system.description` or `weapon.system.notes`        | HTML/string | Editable                      | New Item data           | Sanitize if HTML; plain string safest for v1                              | Reach, reload, point blank, two-handed, concealment                                                                        | Item.weapon        | Textarea/details toggle                  |

### Page 2: Armour

Represent each armour/shield/helmet row as embedded `armour` Items with an equipped flag. The PDF pre-labels Armour, Shield, and Helmet rows but leaves additional blank rows.

| PDF label        | Purpose                       | Proposed data path       | Type        | Editable | Existing/new  | Validation                                              | Related rules/calculations                             | Document type | UI control      |
| ---------------- | ----------------------------- | ------------------------ | ----------- | -------- | ------------- | ------------------------------------------------------- | ------------------------------------------------------ | ------------- | --------------- |
| Item             | Armour piece name             | `Item.name`              | string      | Editable | New Item data | Required non-empty                                      | Equipped item contributes AC/penalties                 | Item.armour   | Item row        |
| Armour           | Armour category/grade         | `armour.system.category` | enum        | Editable | New Item data | `light`, `medium`, `heavy`, `shield`, `helmet`, `other` | AC bonus, Strength requirement, Dex cap, proficiencies | Item.armour   | Select          |
| Bonus            | AC or special numeric bonus   | `armour.system.acBonus`  | integer     | Editable | New Item data | Integer; may be negative if cursed                      | AC formula                                             | Item.armour   | Number input    |
| Special          | Traits/notes                  | `armour.system.notes`    | string/HTML | Editable | New Item data | Sanitize if HTML; plain text safest                     | Rest penalties, magic features, perception penalty     | Item.armour   | Textarea        |
| Equipped/readied | Not labeled, needed digitally | `armour.system.equipped` | boolean     | Editable | New Item data | Boolean                                                 | Only equipped/readied items affect AC                  | Item.armour   | Checkbox/toggle |

### Page 2: Equipment

| PDF label           | Purpose                                       | Proposed data path              | Type       | Editable   | Existing/new  | Validation                                     | Related rules/calculations                                                 | Document type       | UI control                              |
| ------------------- | --------------------------------------------- | ------------------------------- | ---------- | ---------- | ------------- | ---------------------------------------------- | -------------------------------------------------------------------------- | ------------------- | --------------------------------------- |
| Equipment           | General carried gear list                     | Embedded `equipment` Items      | collection | Editable   | New Item data | Item name required; quantity >= 0; weight >= 0 | Weight tracking and gear usage                                             | Item.equipment      | Inventory table with create/edit/delete |
| WT                  | Total carried weight                          | `system.inventory.weight.total` | number     | Calculated | Derived       | Derived only                                   | Sum equipped/carried Item weight * quantity plus currency if later modeled | Actor prepared data | Read-only badge                         |
| Equipment line item | Gear name                                     | `Item.name`                     | string     | Editable   | New Item data | Required non-empty                             | None by default                                                            | Item.equipment      | Text input/item sheet                   |
| Quantity            | Not shown but expected digitally              | `equipment.system.quantity`     | number     | Editable   | New Item data | >= 0                                           | Weight/cost totals                                                         | Item.equipment      | Number input                            |
| Weight              | Not per-line on PDF, required for WT          | `equipment.system.weight`       | number     | Editable   | New Item data | >= 0 kg                                        | Total weight                                                               | Item.equipment      | Number input                            |
| Notes               | Not shown per-line, useful digital affordance | `equipment.system.notes`        | string     | Editable   | New Item data | Optional                                       | Gear details                                                               | Item.equipment      | Textarea/details                        |

### Page 2: Magic

Magic rows should be data-backed. Use Actor source fields for global magical identity/resources and embedded Items for streams/abilities.

| PDF label             | Purpose                                 | Proposed data path                                                                  | Type                 | Editable                             | Existing/new       | Validation                                                                    | Related rules/calculations                                           | Document type       | UI control                 |
| --------------------- | --------------------------------------- | ----------------------------------------------------------------------------------- | -------------------- | ------------------------------------ | ------------------ | ----------------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------- | -------------------------- |
| Magic Stream          | Known stream name                       | Embedded `magicStream` Item or `feature` Item subtype                               | collection item name | Editable                             | New Item data      | Stream name from known list or custom                                         | Streams have related ability and echelons                            | Item.magicStream    | Item row/dropdown          |
| Echelon               | Unlocked stream tier                    | `magicStream.system.echelon`                                                        | enum/integer         | Editable                             | New Item data      | Core/1 through 5; must respect level gate if automation enabled               | Echelon unlock levels and MGP costs                                  | Item.magicStream    | Select                     |
| Spell/ability lines   | Known/usable magic abilities            | Embedded `magicAbility` Items, optionally grouped under stream                      | collection           | Editable                             | New Item data      | Name required; cost >= 0; echelon within stream                               | MP cost by echelon; boost cost                                       | Item.magicAbility   | List with roll/use button  |
| Mana Pool             | Maximum MP                              | `system.magic.mp.max`                                                               | integer              | Calculated with override source      | New/derived        | >= 0; derived only unless manual override exists                              | MP = floor(magic ability score / 2) + magic ability modifier * level | Actor prepared data | Read-only max/resource bar |
| MP Remaining          | Current MP                              | `system.magic.mp.value`                                                             | integer              | Editable with spend/recover controls | New Actor data     | 0..max                                                                        | Spend on abilities; rest recovery                                    | Actor               | Resource bar/stepper       |
| Magic-related ability | Required but not visible as a PDF label | `system.magic.ability`                                                              | ability enum/null    | Editable                             | New Actor data     | Null or one of `int,wis,cha`; should be one of primary abilities for Awakened | Drives Control Magic and MP formula                                  | Actor               | Select in magic panel      |
| Awakened state        | Required but not visible as a PDF label | Derived from Awakened feat Item or `system.magic.awakened` until feats are itemized | boolean              | Editable/derived                     | New Item preferred | Boolean                                                                       | Enables magic UI and MP calculation                                  | Actor/feature Item  | Toggle or derived badge    |

### Page 2: Runes / Thaumaturgy

| PDF label           | Purpose                                      | Proposed data path              | Type           | Editable | Existing/new   | Validation                                                       | Related rules/calculations                                                                            | Document type | UI control                 |
| ------------------- | -------------------------------------------- | ------------------------------- | -------------- | -------- | -------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------- | -------------------------- |
| Runes / Thaumaturgy | Freeform rune notes and thaumaturgy tracking | `system.notes.runesThaumaturgy` | string or HTML | Editable | New Actor data | Prefer plain textarea for v1; if rich text, declare `htmlFields` | Rune Point and thaumaturgy rules exist but exact sheet mechanics are not derivable from the PDF alone | Actor         | Textarea/rich editor later |

### Page 2: Feats, Special Notes, Flaws

| PDF label        | Purpose                  | Proposed data path                                               | Type           | Editable | Existing/new   | Validation                                                      | Related rules/calculations                                                             | Document type | UI control                                      |
| ---------------- | ------------------------ | ---------------------------------------------------------------- | -------------- | -------- | -------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------- | ----------------------------------------------- |
| Feats            | Character capabilities   | Embedded `feature` Items with `feature.system.category = "feat"` | collection     | Editable | New Item data  | Name required; optional uses/cost fields non-negative           | Many feats spend Pool, grant bonuses, change skills/attacks/resources                  | Item.feature  | Item list with use/spend controls where modeled |
| Second Feats box | More feat space on paper | Same as above                                                    | collection     | Editable | New Item data  | Same                                                            | Same                                                                                   | Item.feature  | Same list; no separate data collection          |
| Special Notes    | Longform notes           | `system.notes.special`                                           | string or HTML | Editable | New Actor data | Prefer plain textarea for v1; if HTML then declare `htmlFields` | May include campaign notes with no mechanics                                           | Actor         | Textarea/rich editor                            |
| Flaws            | Character flaws          | Embedded `feature` Items with `category = "flaw"`                | collection     | Editable | New Item data  | Name required; optional BP value integer                        | Flaws can grant build points and restrictions; exact automation should be opt-in later | Item.feature  | Item list/drop zone                             |

## 4. PDF To Foundry Data Mapping

### Existing Actor Data

- `Actor.name` maps to Character Name.
- `Actor.type = "character"` already exists through `system.json` document type declaration.

### New Actor Source Data

- `system.identity`: player, descriptive physical fields, loyalty, languages, optional fallback text for background/species during pre-content phases.
- `system.progression`: level, XP, optional progression points/build points later.
- `system.abilities`: six scores and primary flags.
- `system.attributes`: HP, hit die, speed, death saves, manual calculation modifiers, optional initiative/AC source adjustments.
- `system.resources.pool.value`: current available Pool.
- `system.skills`: canonical skill proficiency/training state, deepening, expertise, manual bonuses, specialization entries for Academia/Crafting.
- `system.proficiencies`: armour, shields, instruments, weapon groups.
- `system.currency`: GP/SP/CP/Other.
- `system.magic`: magic-related ability, current MP, optional awakened fallback/override.
- `system.notes`: runes/thaumaturgy and special notes.

### Derived/Calculated Data

- Ability modifiers.
- Proficiency bonus.
- Saving throw bonuses.
- Skill totals.
- Passive Perception.
- Pool max.
- MP max.
- AC and AC breakdown.
- Initiative bonus.
- Attack BTH/BTD totals.
- Inventory weight total.
- Armour worn summary.

### Embedded Items

- Weapons and attacks: `Item.weapon`.
- Armour, shields, helmets: `Item.armour`.
- General equipment: `Item.equipment`.
- Feats, flaws, species traits, background traits: `Item.feature`, with category.
- Magic streams: `Item.magicStream`.
- Magic abilities/spells: `Item.magicAbility`.

### Actor Relationships/References

No visible PDF field requires an Actor relationship in the first character sheet. Loyalty may eventually refer to a faction Actor/Journal entry, but the PDF does not prove that.

### UI-Only Information

- Section dividers and decorative PDF lines.
- Repeated blank paper rows.
- The second Feats box is paper layout only; digitally it should be one feats collection with responsive layout.

### Should Not Be Implemented As Persisted Data

- Modifier bubbles, BTH, BTD, passive perception, proficiency bonus, total weight, and armour worn should not be persisted as independent source values.
- Generic AcroForm field names should not be used.
- The PDF background art/watermark should not be used as a static sheet dependency unless AOG explicitly wants it as visual branding and owns the asset pipeline.

## 5. Required Data-Model Changes

### Actor Data Model

Expand `PivotCharacterData.defineSchema()` using Foundry data fields:

- `identity`
- `progression`
- `abilities`
- `attributes`
- `resources`
- `skills`
- `proficiencies`
- `currency`
- `magic`
- `notes`

Use `prepareDerivedData()` or TypeDataModel getters for derived values where v13 supports them cleanly. Keep source fields minimal and validation explicit.

### Item Data Models

Add `documentTypes.Item` entries in `system.json` and register Item data models:

- `weapon`
- `armour`
- `equipment`
- `feature`
- `magicStream`
- `magicAbility`

For the smallest maintainable slice, `feature` can cover feats, flaws, background traits, species traits, and body modifications through a category enum. Later content packs can specialize if needed.

### Trackable Token Attributes

Configure `CONFIG.Actor.trackableAttributes.character` for:

- Bar attributes: `attributes.hp`, `resources.pool`, `magic.mp`.
- Value attributes: possibly `progression.xp`, `attributes.ac.value`, `attributes.speed.value`.

Only bar attributes with `{ value, max }` should be token bars.

### Sanitization

If rich text is used for notes/item descriptions, update `system.json` `htmlFields` for those system fields. For first implementation, plain textarea fields reduce migration and sanitization risk.

## 6. Proposed Character-Sheet Architecture

- Add a `PivotCharacterSheet` extending Foundry v13 `foundry.applications.sheets.ActorSheetV2`.
- Register it during `init` through `foundry.documents.collections.Actors.registerSheet("pivot-fantasy", PivotCharacterSheet, { types: ["character"], makeDefault: true })`.
- Keep model registration and sheet registration thin in runtime entrypoints; split only enough to avoid a monolithic `pivot.ts`:
  - `src/data/character-data.ts`
  - `src/data/item-data.ts`
  - `src/sheets/character-sheet.ts`
  - `src/sheets/item-sheet.ts` if Item editing lands in the same phase
  - `src/rules/character-derived.ts`
  - `src/config.ts`
- Use Handlebars templates under `templates/actors/character-sheet.hbs` and partials under `templates/parts/`.
- Add CSS under `styles/pivot-fantasy.css` and declare it in `system.json`.
- Localize labels/actions in `lang/en.json`.

## 7. UX/Layout Specification

Use the PDF organization without a pixel-perfect clone.

Recommended tabs:

- **Core**: identity, level/XP, abilities, combat summary, HP/Pool, death saves.
- **Skills**: skills, specializations, proficiencies, currency.
- **Combat**: weapons/attacks, armour, attack roll controls, AC breakdown.
- **Equipment**: full inventory, carried/equipped toggles, total weight.
- **Magic**: awakened state, magic ability, MP, streams/echelons, abilities, runes/thaumaturgy.
- **Features & Notes**: feats, flaws, background/species feature Items, special notes.

Useful controls:

- Roll buttons on ability modifiers, saving throws, skills, initiative, attacks, damage, and magic ability checks.
- Resource steppers/buttons for HP, Pool, and MP.
- Three-checkbox death save controls for successes/failures plus reset.
- Drag/drop Items onto inventory/feature/magic sections.
- Inline create/edit/delete for embedded Items.
- Read-only badges with tooltips for calculated values and breakdowns.
- Collapsible details on dense item rows.

Responsive behavior:

- Default desktop width should show two-column sections similar to the PDF where helpful.
- Narrow windows should collapse to one column with tabs remaining usable.
- Resource controls should maintain fixed dimensions to avoid layout shifts.
- Calculated and editable fields should look distinct: editable inputs vs read-only badges/buttons.

GM/player usability:

- Player sheet should expose common play controls quickly: HP, Pool, MP, attacks, skills, death saves.
- GM users should be able to edit all source fields and item rows.
- Permission checks should gate document updates through Foundry sheet editability.

## 8. Calculations And Automation

Implement deterministic calculations in pure rules modules first:

- Ability modifier: already implemented.
- Proficiency bonus by level: already implemented.
- Skill total = ability modifier + proficiency bonus if proficient + deepening + expertise adjustment + manual/item bonuses.
- Saving throw total = ability modifier + proficiency bonus when ability is primary + bonuses.
- Passive Perception = 10 + Perception total, plus advantage/disadvantage adjustment when modeled.
- Pool max = level + Pool max modifiers, minimum 1.
- MP max = floor(magic-related ability score / 2) + magic-related ability modifier * level, 0 if not Awakened/no magic ability.
- AC = 10 + applicable Dexterity modifier + equipped armour/shield/helmet bonuses + species/feat/item/manual bonuses.
- Initiative = Dexterity modifier + feature/manual bonuses; some feats may add proficiency.
- Total weight = sum carried Item weights * quantities.

Automation should be incremental. The first complete sheet can calculate current math and allow manual modifiers. Full content-driven feat/species/background automation should wait until those Items have reliable machine-readable effect schemas.

## 9. Roll Interactions

Initial roll interactions:

- Ability check roll: d20 + ability modifier, with advantage/disadvantage option.
- Saving throw roll: d20 + ability modifier + proficiency if primary.
- Skill roll: d20 + skill total.
- Initiative roll: d20 + initiative total; integrate with Foundry combat only after verifying v13 combat API locally.
- Weapon attack roll: d20 + BTH total; natural 20/1 attack handling can reuse existing `applyAttackCrit`.
- Weapon damage roll: damage formula + BTD total with exploding damage behavior once an exploding dice helper exists.
- Death save roll: d20 death save workflow. Exact thresholds and effects should be verified against the full rules before automation.
- Magic ability roll/use: spend MP and roll Control Magic only when the ability calls for it; do not invent per-spell rules.

Roll dialogs should support advantage/disadvantage/super-advantage source counts because the rule module already models that resolution.

## 10. Item/Inventory Interactions

- Embedded Item rows should be draggable/reorderable where Foundry V2 sheet patterns allow it.
- Dropping an Item onto a character should create an embedded Item copy.
- Weapons should have attack and damage buttons in-row.
- Armour should have equipped/readied toggles and feed AC breakdown.
- Equipment should support quantity, weight, carried/equipped state, notes, and delete/edit.
- Feature Items should support category, description, optional Pool/MP costs, optional uses, and future mechanical modifiers.
- Magic stream Items should group magic ability Items by stream/echelon where possible.
- Do not duplicate Item names/stats into Actor arrays; derive sheet lists from embedded Items.

## 11. Migration/Backward Compatibility Considerations

- Current released character Actor system data is empty, so migration can initialize missing fields with defaults.
- Add a model version field such as `system.schemaVersion` only if the project expects future data migrations soon; otherwise use TypeDataModel defaults and add migration when a released schema changes.
- Adding Item document types affects manifest validation and package install behavior; update tests accordingly.
- Existing worlds with `character` Actors should load with defaults and no invalid documents.
- If notes become HTML fields later, that is a schema/sanitization change and should include migration notes.

## 12. Accessibility Considerations

- Every icon-only roll/edit/delete button needs an accessible label/title.
- Checkbox groups need labels and fieldsets where practical.
- Resource controls should be keyboard reachable and screen-reader understandable.
- Use sufficient contrast; avoid relying on color alone to distinguish editable/calculated state.
- Tabs should use Foundry/application tab controls with clear active state.
- Numeric inputs should include labels, min/max where known, and visible validation feedback.
- Long item lists should remain navigable without drag/drop; provide buttons for add/edit/delete.

## 13. Test Plan

Automated tests:

- Character data defaults initialize without invalid data.
- Ability modifier and proficiency tests continue passing.
- New character-derived rules tests for ability mods, saves, skill totals, passive perception, Pool max, MP max, AC breakdown, initiative, and inventory weight.
- Item data model default/validation tests for weapon, armour, equipment, feature, magicStream, and magicAbility.
- Manifest test confirms Actor and Item document types, styles, and expected template/package paths.
- Roll-preparation tests for attack totals and damage formula inputs, without requiring Foundry globals where avoidable.

Manual Foundry v13 smoke tests:

- System loads without console errors.
- New character Actor opens default Pivot character sheet.
- Editing source fields persists after close/reopen.
- Calculated fields update after source changes.
- Embedded Items can be created, edited, dropped, equipped, and deleted.
- Roll buttons produce chat messages and do not mutate source fields unexpectedly.
- Token resource bars can track HP/Pool/MP.
- Player-owned actor respects edit permissions.

Verification commands:

- `npm run test`
- `npm run typecheck`
- `npm run build`
- `npm run verify`
- `npm run package:system` when manifest/styles/templates/package contents change.

## 14. Acceptance Criteria

- The sheet is a native Foundry character sheet for `Actor.character`, not a PDF/image viewer.
- All PDF-visible gameplay fields have data-backed controls or documented derived displays.
- Existing values are reused where they exist (`Actor.name`, registered Actor subtype, existing rules helpers).
- Repeated weapons, armour, equipment, feats, flaws, magic streams, and magic abilities are represented as embedded Items.
- Calculated fields are not duplicated as editable source data.
- The sheet uses Foundry v13-compatible sheet/data model APIs and avoids deprecated `ActorSheet` unless a blocker is documented.
- The system loads in Foundry v13 and a character can be created, edited, closed, reopened, and rolled from.
- Repository verification passes, and manual Foundry acceptance status is reported separately.

## 15. Files Likely To Change

- `system.json`: Item document types, styles, htmlFields if rich text, trackable resources if manifest-level fields are needed.
- `src/pivot.ts`: thin registration imports/calls.
- `src/data/character-data.ts`: character TypeDataModel schema.
- `src/data/item-data.ts`: Item TypeDataModel schemas.
- `src/config.ts`: ability, skill, proficiency, weapon, armour, currency, magic constants.
- `src/rules/character-derived.ts`: derived character math.
- `src/rules/inventory.ts`: weight and equipment calculations.
- `src/rules/magic.ts`: MP/echelon cost calculations.
- `src/sheets/character-sheet.ts`: ActorSheetV2 class and interactions.
- `src/sheets/item-sheet.ts`: Item sheet if required for embedded item editing.
- `templates/actors/character-sheet.hbs`
- `templates/items/*.hbs`
- `templates/parts/*.hbs`
- `styles/pivot-fantasy.css`
- `lang/en.json`
- `tests/rules/*.test.ts`
- `tests/system-manifest.test.ts`
- Potential new `tests/data/*.test.ts` or `tests/sheets/*.test.ts` depending on test harness.
- `README.md`, `docs/architecture.md`, `docs/development.md`, and `docs/character-sheet-source.md` after implementation claims become true.

## 16. Risks / Unresolved Questions

- The PDF does not define the expanded meanings of BTH and BTD. They appear to be attack and damage bonuses; confirm terminology before localizing labels/tooltips.
- Loyalty is visible on the PDF but its mechanical/social meaning is not clear from inspected source snippets.
- Death save thresholds and consequences should be verified in the full rules before automating beyond counters and rolls.
- Background, species, feats, flaws, and body modifications have mechanical effects in the rules, but no content schema exists yet. The first sheet should support them as Items/manual modifiers without pretending full automation exists.
- Armour automation depends on equipped/readied state, proficiency, Strength requirements, Dexterity caps, helmets, and rest penalties. Implement AC first; defer exhaustion/rest automation.
- Control Magic uses a selected magic-related ability for Awakened characters. The sheet must avoid assuming all characters are Awakened.
- Academia and Crafting are repeatable specializations. They need custom rows rather than a single boolean each.
- Rich text notes/descriptions require `htmlFields` and sanitization decisions. Plain text is lower risk for the first playable sheet.
- Foundry v13 V2 sheet APIs should be smoke-tested in the local Foundry installation before implementation begins.
- No NPC sheet exists. This spec covers character sheets only; NPC/BBEG parity is future work.
