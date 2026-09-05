# Pivot Foundry — Entity Model Delta

Status: **Draft for stakeholder review**

This file is a domain vocabulary and planned delta map, not a database schema. Existing repository names are preserved.

## Existing domain entities

### Character

Foundry Actor of type `character`. Its `system` source contains identity, progression, ability scores and primary flags, current/max HP, manual bonuses, Pool current/max bonus, skills, proficiencies, currency, magic source state, and plain-text notes.

Derived values remain calculated: ability modifiers, proficiency bonus, saves, skill totals, passive Perception, Pool max, MP max, AC, initiative, total carried weight, weapon BTH, and weapon BTD.

### Weapon, Armour, Equipment, Feature, Magic Stream, Magic Ability

Foundry embedded Items using the six existing item types. They remain the source of inventory/features/magic content. No Actor-side duplicate item arrays are introduced.

### Roll Mode

Ephemeral choice for a d20 roll:

- `normal`
- `advantage`
- `disadvantage`
- `superAdvantage`

It is not persisted on Character.

### Roll Outcome

Ephemeral result consisting of dice-pool resolution, kept natural d20 result, modifier, total, and—only for attacks—natural-result override (`hit`, `miss`, or none). It is chat/runtime data, not Character source.

### Pool Transaction

Ephemeral operation with an amount and a result. The persisted source remains only `Character.resources.pool.value`.

### Combatant Initiative

Foundry combat state associated with a scene token/combatant. Pivot must not duplicate initiative on Character because initiative is derived and combat-specific.

## Planned entity additions

### Temporary Hit Points — UC-005

Proposed additive Character source field:

`attributes.hp.temp: number >= 0, default 0`

Temporary HP is current mutable game state, not a derived total. This field is introduced only with UC-005.

### Effect Rule — UC-008

Source data owned by an embedded Item, not by Character. Proposed Item field:

`effects: EffectRule[]` with default `[]`.

EffectRule is a discriminated union of whitelisted Pivot domain operations. Version 1 permits only constant, typed operations; no arbitrary document paths and no formulas.

Initial v1 operations:

- `abilityScoreBonus { ability, amount }`
- `skillBonus { skill, amount }`
- `armourProficiency { category }`
- `weaponProficiency { category }`
- `acBonus { amount }`
- `initiativeBonus { amount }`
- `speedBonus { amount }`
- `poolMaxBonus { amount }`
- `mpMaxBonus { amount }`

A content entry may use only operations supported by verified source material. The schema does **not** imply that every operation exists in published Pivot content.

Effect contributions are inputs to derived calculations. They do not rewrite the Character's manual source fields.

### Content Record — UC-008/UC-009

Canonical authored content is recommended as version-controlled JSON under `src/content/`, validated against TypeScript schemas, then compiled/generated into Foundry packs under `packs/`.

Each content record has:

- stable `contentId`
- Foundry Item `type`
- player-facing `name`
- minimal approved descriptive/source metadata
- `system` payload compatible with the corresponding Item DataModel
- optional `effects`
- `contentSchemaVersion`

Generated pack database files are distribution artifacts. JSON is the reviewable source of truth.

### Document Schema Version — UC-008

Migration metadata, not player data. Proposed shared source field on Pivot Actor/Item DataModels:

`schemaVersion: integer >= 1`

The first migration-capable release establishes the current version and a named migration registry. Additive defaults before that point do not require historical transformation.

## Relationships

- Character **contains** embedded Weapons, Armour, Equipment, Features, Magic Streams, and Magic Abilities.
- Embedded Item Effect Rules **contribute to** Character derived calculations.
- Character/token **maps to** a Foundry Combatant for initiative integration.
- Canonical Content Records **generate** Foundry compendium Items; dropping/importing creates ordinary embedded Items.
- Character generation and advancement **change Character source choices/state** but do not create parallel copies of embedded content.

## Explicit non-entities

The following are not introduced as persisted entities in the current plan:

- derived stat snapshots
- roll-mode preference
- attack totals
- armour-worn totals
- per-Actor copies of compendium catalogs
- NPC/BBEG data until UC-013
