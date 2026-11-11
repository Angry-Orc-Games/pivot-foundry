# Copilot instructions

Foundry VTT v14 game system for Pivot Fantasy (TypeScript, Vite, Vitest). Full conventions: `AGENTS.md` and `CODING_STANDARDS.md`.

## Review focus
- Deterministic game rules belong in `src/rules/` with tests in `tests/rules/`. Flag rules logic added to sheets, hooks or `src/pivot.ts`.
- HP, Temporary HP and death-save changes must go through the Survival transaction helpers (`src/runtime/health.ts`, `src/runtime/actor-guards.ts`). Flag direct writes.
- Persisted data changes need a migration. Flag schema changes without one.
- User-facing text and HTML: flag unescaped interpolation and hardcoded strings that belong in `lang/`.
- New behavior needs a test. Flag untested rule changes.

## Do not comment on
- `dist/`, `system.zip`, `package-lock.json`, `packs/` build output.
- Formatting and lint issues. CI runs `npm run verify` (lint, Prettier, typecheck, tests).
- Style nitpicks that ESLint or Prettier already enforce.

## Commands
`npm ci`, `npm run verify`, `npm run test`, `npm run typecheck`, `npm run lint`.
