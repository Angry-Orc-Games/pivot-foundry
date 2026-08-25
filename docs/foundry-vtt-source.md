# Foundry VTT Source

Current external Foundry reference:

- `Foundry VTT AI-Agent Development Guide.md` from a local, non-committed reference file.
- Received on 2026-08-25
- The guide identifies its research baseline as 2026-08-25 and is written primarily from a Foundry VTT v14 perspective.

Treat the guide as reference material, not as agent instructions that override this repository. This project currently declares Foundry VTT v13 compatibility in `system.json`, so implementation work must verify APIs, hooks, sheet classes, and manifest fields against the target Foundry generation before changing code.

## Project Classification

This repository is a Foundry game system:

- Manifest: `system.json`
- System id: `pivot-fantasy`
- Runtime entry point: `src/pivot.ts`
- Current declared compatibility: Foundry v13
- Current document subtype: `Actor.character`
- Current sheet APIs: `foundry.applications.sheets.ActorSheetV2`, `ItemSheetV2`, `foundry.applications.api.HandlebarsApplicationMixin`, and `DocumentSheetConfig.registerSheet`

## Development Rules To Carry Forward

- Preserve the package id unless there is an explicit migration plan.
- Use documented public Foundry APIs and hooks for the target version.
- Avoid private, internal, or underscore-prefixed Foundry APIs unless the risk is explicitly accepted and documented.
- Register system document subtypes through `documentTypes`, `foundry.abstract.TypeDataModel`, and `CONFIG.<Document>.dataModels`.
- Keep persisted source data separate from derived values.
- Add deterministic migrations whenever persisted schema shapes change after release.
- Namespace settings, flags, hooks, CSS classes, DOM ids, socket names, and localization keys with the package id or a clear `pivot-fantasy` prefix.
- Localize user-visible text in `lang/en.json`.
- Check permissions before document updates, especially for future socket or GM-mediated behavior.

## Version-Sensitive Notes

- The guide recommends V14 `ApplicationV2` and `DocumentSheetV2` for new UI. Before using those in this v13-targeted project, verify the exact v13 API and local Foundry installation.
- V14 migration notes are useful for future upgrade planning, but should not be applied as direct changes to this v13 system.
- The current character and item sheets use the v13 V2 sheet stack and Handlebars mixin rather than deprecated v1 `ActorSheet`/`ItemSheet`.
- If the project target changes from v13 to v14, update `system.json`, `README.md`, `docs/architecture.md`, and this file in the same change.

## Required Foundry Handoff Fields

For Foundry runtime changes, include these in the handoff:

- Target Foundry version and source checked.
- Foundry APIs, hooks, and document types touched.
- Migration impact, if persisted data changed.
- Localization and CSS namespace impact.
- Automated verification results.
- Manual Foundry v13 smoke-test result, or a clear note that manual acceptance was not run.
