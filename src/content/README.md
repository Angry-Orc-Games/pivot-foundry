# Content source

Canonical Pivot Foundry content lives here as version-controlled JSON.

This slice (UC-008) establishes the pipeline only. Records under this tree are **fixtures for validation and pack generation**, not published Pivot Fantasy catalog content.

Rules:

- One JSON object per file.
- `contentId` is stable kebab-case and unique across the catalog.
- Unknown keys, effect types, HTML, URLs, and formulas are rejected.
- Regenerated Foundry pack source is written to `packs/src/` by `npm run build:content`.
- `system.json` `packs` stays empty until a real Foundry v14 LevelDB pack exists.
