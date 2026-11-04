# Foundry System Development Best Practices (v14)

Researched 2026-11-01 for Foundry VTT v14 (build 14.367; API reference pages report 14.368 Stable). Primary sources only: official Foundry articles, release notes, the v14 API reference, and the official `foundryvtt-cli` repo. Every claim carries its source URL; all were accessed 2026-11-01.

## Summary

- Use `TypeDataModel` subclasses for all document subtypes, `ApplicationV2` + `HandlebarsApplicationMixin` for all UI, and `async` `Roll#evaluate`. ApplicationV1 is still shipped but flagged for removal in v16.
- Hooks are never awaited, and an `async` handler cannot cancel an operation by returning `false`. Use document `_preUpdate` / `_preUpdateOperation` for cancelable logic.
- Active Effects were reworked in v14 ("Active Effects V2"); they are a primary document and can live in compendiums.
- Packs: declare in `system.json`, author as source files, compile with the official `@foundryvtt/foundryvtt-cli` (LevelDB).
- Several things could not be verified from primary sources (see Gaps). The Foundry community wiki returned HTTP 403, so none of its content is used.

## 1. Manifest (`system.json`)

- Required: `id` (lowercase, no special chars, must match the parent folder name), `title`, `description`, `version`. Source: https://foundryvtt.com/article/system-development/
- `compatibility` has `minimum`, `verified`, `maximum`. `maximum` means the package "will not function for newer versions than this", so avoid setting it casually. Sources: https://foundryvtt.com/article/system-development/, https://foundryvtt.com/article/module-development/
- `esmodules` is preferred over `scripts`; `styles`, `languages` (`lang`, `name`, `path`) are the other asset arrays. Source: system-development article.
- `documentTypes` (Actor/Item subtypes) "must match your DataModel definitions in code". Source: system-development article.
- `relationships`: entries have `id`, `type` (defaults to `module`; set explicitly for systems/worlds), `manifest`, `compatibility`. Without a `manifest`, the dependency must be on the Foundry website. Missing required dependencies prevent enabling. Source: system-development and module-development articles.
- `manifest` must be a stable URL to the latest manifest, or updates are not detected. `download` is a public zip matching the manifest's version; git tags/releases are recommended. Source: https://foundryvtt.com/article/module-development/
- `packs[]`: `name` (unique lowercase), `label`, `system`, `type` (Actor, Item, JournalEntry, RollTable, Cards, Macro, Playlist, Scene). Source: system-development article.
- `socket: true` makes the server relay events under the name `module.{name}`; the module article documents the module form only. Source: module-development article.
- System-only fields: `initiative`, `grid`, `primaryTokenAttribute`, `secondaryTokenAttribute`. Source: system-development article.
- Sensitive client-only data-model fields must be registered in the manifest (`ServerSanitizationFields`), because system data models are not constructed on the server. Sources: TypeDataModel and Document API pages below.
- The `flags` manifest property is not covered by either article.

## 2. DataModels

Source: https://foundryvtt.com/api/v14/classes/foundry.abstract.TypeDataModel.html unless noted.

- `defineSchema()` is static, built on first access and cached.
- `prepareBaseData()` runs before effects and before `ClientDocument#prepareBaseData`; use it for values effects will modify. `prepareDerivedData()` computes non-stored values from source data and can reach embedded collections via `this.parent`.
- `static migrateData(source, options)` migrates candidate source data before cleaning; `migrateDataSafe` wraps it in try/catch; `shimData` adds backward-compatible accessors to current-schema data.
- `static LOCALIZATION_PREFIXES` lets Foundry pull field labels/hints from lang JSON. Document subtypes are localized automatically; other uses need `Localization.localizeDataModel`. Source: same page and https://foundryvtt.com/api/v14/classes/foundry.helpers.Localization.html
- `_preUpdate(changes, options, user)` on the data model; returning `false` cancels.
- v14 changes (prototype notes): data cleaning consolidated in `DataModel.cleanData`; `updateSource` accepts a DataModel and always clones; new `_updateDiff` / `_updateCommit`; `SchemaField#extendFields` / `#removeFields`; `-=` / `==` update keys deprecated in favour of `DataFieldOperator`; embedded-document updates now validate the resulting collection jointly. Source: https://foundryvtt.com/releases/14.349
- 14.359: `SchemaField#getInitialValue` no longer includes non-persisted field data. Source: https://foundryvtt.com/releases/14.359

## 3. ApplicationV2 / sheets

- `HandlebarsApplicationMixin(ApplicationV2 subclass)` adds Handlebars rendering. Sources: https://foundryvtt.com/api/v14/functions/foundry.applications.api.HandlebarsApplicationMixin.html, https://foundryvtt.com/api/v14/modules/foundry.applications.api.html. (PARTS / part-context details were not retrievable; see Gaps.)
- `DEFAULT_OPTIONS` merge up the class chain: arrays concatenate, objects merge, scalars replace. Handlers in `DEFAULT_OPTIONS.actions` run first; `_onClickAction` is the fallback for `[data-action]` without a handler. Source: https://foundryvtt.com/api/v14/classes/foundry.applications.api.ApplicationV2.html
- Render lifecycle order: `_configureRenderOptions`, `_prepareContext`, `_preFirstRender`/`_preRender`, `_renderHTML`, `_replaceHTML`, `_postRender`. `_onFirstRender` runs once; `_onRender` every render. Source: ApplicationV2 page.
- v14.361 added `_getFrameButtons` for header buttons. Source: https://foundryvtt.com/releases/14.361
- `DocumentSheetV2`: form options `submitOnChange`, `closeOnSubmit`; `_processFormData` is where to validate (throw to block); `_processSubmitData` does the document update; `isEditable` uses `editPermission` (default 3); `_prepareContext` supplies `document`, `source`, `fields`, `editable`, etc. Built-in actions include `configureSheet`, `configureOwnership`, `editImage`. Source: https://foundryvtt.com/api/v14/classes/foundry.applications.api.DocumentSheetV2.html
- V1 `Application` removal: web search summary of the core API docs says the extended deprecation expires in v16 (https://foundryvtt.com/api/ landing; the appv1 module page itself only says "legacy ApplicationV1 classes", https://foundryvtt.com/api/modules/foundry.appv1.html). Treat the v16 date as reported but not directly confirmed on the fetched page.
- TinyMCE is being removed in v14 (prototype notes). Source: https://foundryvtt.com/releases/14.349

## 4. Hooks and lifecycle

- Startup order: `init`, `i18nInit`, `setup`, `initializeDynamicTokenRingConfig`, `initializeCombatConfiguration`, `canvasConfig` (if canvas enabled), `ready`; once per client connection. Source: https://foundryvtt.com/api/v14/modules/hookEvents.html
- Hooks are never awaited. An async handler returns a Promise, so `return false` will not cancel. `preCreate*` can be cancelled by an explicit `false`. Source: hookEvents page.
- `Hooks.call` stops on a `false` return; `Hooks.callAll` ignores it. Listeners run in registration order. `Hooks.on` returns an id, `off` accepts id or function. Source: https://foundryvtt.com/api/v14/classes/foundry.helpers.Hooks.html
- Document methods: `_preUpdate(changes, options, user)` runs only on the requesting client (false cancels); `_onUpdate` runs on all clients; `_preUpdateOperation` / `_onUpdateOperation` are batch-level. `update()` returns `undefined` when nothing changed. Source: https://foundryvtt.com/api/v14/classes/foundry.abstract.Document.html
- Flags: `getFlag` / `setFlag` / `unsetFlag`; scope is the package id for systems/modules, `core` for core, `world` for worlds; setting `null` deletes the flag. Source: Document page.
- Private (underscore) API members may change without notice, even in Stable. Source: https://foundryvtt.com/api/ (via search result summary).
- v14.349 removed `CONFIG.ActiveEffect.legacyTransferral` and ended support for many V12-deprecated APIs. 14.349 states other deprecation periods ended with v14 without listing them. Source: https://foundryvtt.com/releases/14.349

## 5. Active Effects and status effects

- v14 "Active Effects V2": finer expiration control, token-appearance changes, stored in compendiums. Source: https://foundryvtt.com/releases/14.359
- `ActiveEffect` is now a primary document; core no longer assigns `origin` (systems own it); expanded Set operations. Source: https://foundryvtt.com/releases/14.349
- Schema includes `system` (TypeDataField, so effect subtypes are possible), `duration`, `start`, `statuses` (Set), `transfer`, `disabled`, `origin`, `showIcon`, `tint`, `img`. Systems/modules can override `shouldApplyChange` to add conditions; `ActiveEffect.fromStatusEffect` builds an effect from a `CONFIG.statusEffects` entry. Source: https://foundryvtt.com/api/v14/classes/foundry.documents.ActiveEffect.html (only first 100k of 130k chars read).
- `duration.remaining` now returns total remaining time in the stored unit (14.359). 14.361 added a label for total effect duration.

## 6. Rolls and chat

Source: https://foundryvtt.com/api/v14/classes/foundry.dice.Roll.html unless noted.

- `evaluate()` is async-only (options `allowInteractive`, `allowStrings`, `maximize`, `minimize`); `evaluateSync()` exists with a `strict` option and is not marked deprecated. No `async` option exists.
- `toMessage(..., { create })` and the option name `messageMode`; `_mapLegacyRollMode` is deprecated since v14, so use `messageMode` rather than legacy `rollMode`.
- Serialization via `toJSON` / `fromData` / `fromJSON`; default templates `templates/dice/roll.hbs` and `tooltip.hbs`.
- Booleans in rolls evaluate to 0/1 (prototype notes, https://foundryvtt.com/releases/14.349).
- `ChatMessage.applyMode(chatData, mode)` supports `public`, `self`, `gm`, `blind`. `ChatMessage.system` is a TypeDataField, so message subtypes are possible. Source: https://foundryvtt.com/api/v14/classes/foundry.documents.ChatMessage.html
- Known issue in 14.359: GM-visible rolls can show "???" to players under private GM mode or `/gmroll`. Source: https://foundryvtt.com/releases/14.359

## 7. Compendium packs

- Official CLI: `@foundryvtt/foundryvtt-cli` (MIT). Its `extractPack` / `compilePack` default to LevelDB, support YAML via `yaml`, and `transformEntry` (return `false` to drop). `omitVolatile` helps change detection. Source: https://github.com/foundryvtt/foundryvtt-cli
- v14: ActiveEffects can be stored in compendiums. Each compendium holds one document type (Adventure excepted). Source: https://foundryvtt.com/article/compendium/ and 14.349 notes.
- Compendium packs must be unlocked to edit in the UI. Source: compendium article.
- The on-disk LevelDB format is not described in the articles retrieved; the CLI README states the default only.

## 8. Settings, flags, sockets

- `game.settings.register(namespace, key, data)`: scopes `world`, `user`, `client`; `type` may be a field instance (e.g. `foundry.fields.NumberField`); `requiresReload`; `onChange`; `registerMenu` takes an ApplicationV2 subclass. Source: https://foundryvtt.com/api/v14/classes/foundry.helpers.ClientSettings.html
- Use the system id as the namespace for settings and flags. Socket event names are `module.{name}` per the module article; the system equivalent is not documented there (Gap).
- Check permissions before updates in socket-mediated code (repo convention; not a Foundry-documented rule).

## 9. Localization

- `Localization#localize(id, data)` returns the id when missing; `has(id, fallback)`; `localizeDataModel`. Lang files are declared in `languages`. Source: https://foundryvtt.com/api/v14/classes/foundry.helpers.Localization.html
- Use `LOCALIZATION_PREFIXES` on data models so field labels/hints resolve from JSON (section 2).

## 10. Performance and v14 platform changes

- 14.359 reports 3% to 25% gains for common operations; v14 requires a clean install (not an in-place update). Source: https://foundryvtt.com/releases/14.359
- Measured Templates were removed; Regions replace them. Source: 14.359.
- 14.361 (May 5, 2026, Stable 3): HTML files are now served as plain text, so static HTML opened directly no longer renders (template rendering is unaffected); `canvasTearDown` and related teardown hooks now receive next Scene and Level. Source: https://foundryvtt.com/releases/14.361
- Batch document writes across collections are supported in v14 (prototype notes).

## 11. Testing and release

- Package validation rules available from primary sources are those in section 1 (id matches folder, stable `manifest`, `download` zip matching version). No official Foundry validator was found.
- The Foundry admin "Install System" flow consumes `manifest` URL; verify it from a clean install of v14.
- 14.361 shows the verified package version in install dialogs (14.361 notes), so keep `compatibility.verified` accurate.

## Gaps / unverified

- `foundryvtt.wiki` (community wiki) returned 403; nothing from it is used.
- HandlebarsApplicationMixin PARTS/`_preparePartContext`/`_attachPartListeners` details and single-root rule: API page was only a stub when fetched. Not verified.
- v14 deprecation list: no consolidated v14 migration guide was found; 14.349 and 14.359 notes are partial. `foundryvtt.com/releases/14.0.0`, `/article/package-best-practices/`, `/article/content-packaging/` returned 404.
- ApplicationV1 "removal in v16": only via search-result summary, not on a fetched page.
- ActiveEffect page: last ~30k chars unread; v14 duration/expiry data-model specifics not captured.
- ChatMessage `messageMode` vs `rollMode` beyond `Roll#toMessage` and the deprecated `_mapLegacyRollMode`: not directly confirmed.
- System socket event name format (`system.{id}`) is not documented in what was retrieved.
- Whether manifest `flags` has any rules for systems: not covered.
- LevelDB details, CLI pack naming/ID rules beyond README.

## Relevance to this repo

Observed from `system.json` and `src/` (no files edited):

- Manifest: `compatibility.minimum` "14", `verified` "14.368" (above the pinned build 14.367; fine as long as it was actually tested, per 14.361 install dialog). There is no `relationships`, `socket`, or `flags`, which matches the minimal-surface approach. `packs` is empty; if content packs ship, add entries with `name/label/system/type` and compile with `@foundryvtt/foundryvtt-cli` (the repo uses `scripts/build-content-packs.mjs`; confirm it uses CLI or equivalent LevelDB output).
- Data layer: `src/data/*-data.ts` and `src/migrations/` follow the TypeDataModel + migration approach. Consider `static migrateData` / `LOCALIZATION_PREFIXES` for field labels where not already done, and confirm `-=` / `==` keys in `updateSource` calls (`src/pivot.ts`, `src/migrations/m002.ts`) are not used, since they are deprecated in v14.
- Rolls: `src/runtime/combat-document.ts` handles both `messageMode` and legacy `rollMode` (via `messageModeFromRollMode`); aligned with the v14 deprecation of `_mapLegacyRollMode`. Keep prefer `messageMode`.
- Survival writes use a transaction pattern; Foundry hooks are not awaited and cannot cancel from async handlers, so enforce guards in `_preUpdate`/`_preUpdateOperation` rather than async hooks (matches `src/runtime/actor-guards.ts` direction).
- Status effects (`src/runtime/status-effects.ts`): review against ActiveEffect V2 (`origin` no longer set by core, new duration model, `fromStatusEffect`).
- Release/packaging: `manifest` and `download` use `releases/latest/download/...`, a stable URL as required; ensure the zip's `system.json` version matches. Foundry 14.361 serves HTML as plain text; avoid shipping static `.html` that must render directly.
- Next verification step: fetch the HandlebarsApplicationMixin class doc (`HandlebarsApplication`) and the v14 ActiveEffect duration docs when extending sheets or effects.
