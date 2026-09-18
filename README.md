# Pivot Fantasy Foundry System

[![CI](https://github.com/Angry-Orc-Games/pivot-foundry/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Angry-Orc-Games/pivot-foundry/actions/workflows/ci.yml?query=branch%3Amain)
[![Release](https://github.com/Angry-Orc-Games/pivot-foundry/actions/workflows/release.yml/badge.svg)](https://github.com/Angry-Orc-Games/pivot-foundry/actions/workflows/release.yml)
![Foundry VTT](https://img.shields.io/badge/Foundry%20VTT-v14.368-blue)
![Node](https://img.shields.io/badge/Node-20%2F22%20verify%20%7C%2024%20Foundry%20container-339933)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
![Lint](https://img.shields.io/badge/lint-ESLint-4b32c3)
![Format](https://img.shields.io/badge/format-Prettier-f7b93e)
![Security](https://img.shields.io/badge/audit-npm%20audit-2ea44f)
![Status](https://img.shields.io/badge/status-initial%20sheet-orange)

Pivot Fantasy is a Foundry VTT v14 game system for the free Pivot Fantasy core rules engine. This repository contains a strict TypeScript/Vite build, Foundry manifest, language file, CI, release packaging, the first tested rules modules, and an initial native character sheet.

The goal is to keep the Foundry runtime thin while game rules, dice logic, and character math grow as testable TypeScript modules.

## Current Status

This is an early playable sheet implementation. It supports native Actor and embedded Item editing for the current character-sheet workflow. Item effect rules can contribute to derived values, and a JSON content pipeline exists, but published Pivot catalog packs are not shipped yet.

Implemented:

- Foundry v14 `system.json` manifest for `pivot-fantasy`
- TypeScript source entry point at `src/pivot.ts`
- Character Actor document type declaration and data model registration
- Native Pivot Fantasy character Actor sheet registration
- Item document type declarations and data models for weapons, armour, equipment, features, magic streams, and magic abilities
- Item sheet registration for those Pivot item types
- Data-backed identity, progression, abilities, HP, Pool, skills, proficiencies, currency, magic, notes, attacks, armour, and inventory fields
- Derived character math for ability modifiers, proficiency, saves, skills, passive perception, Pool max, MP max, AC, initiative, carried weight, and weapon BTH/BTD
- Pivot d20 roll modes (Normal, Advantage, Disadvantage, Super-Advantage) with kept-die chat results
- Weapon attack chat that reports automatic hit on a kept natural 20 and automatic miss on a kept natural 1
- Bounded Pool spend/recovery against derived Pool max, plus Recover Pool (Long Rest)
- Initiative rolls that update a unique existing Foundry combatant in the active combat
- Exploding damage/healing, explicit critical/enhanced rolls, HP/temp-HP application and death saves; see [Survival controls](docs/survival.md) for the manual boundaries
- Character survival migration M002 with explicit confirmation for legacy zero-HP state
- Named document migration M001 (`schemaVersion` 0/missing → 1) on the Foundry v14 `ready` hook
- Whitelisted Item `effects` that contribute to derived character totals without rewriting source scores
- JSON content source under `src/content/` with generated pack document JSON under `packs/src/`
- Vite build output to `dist/pivot.mjs`
- Vitest coverage for manifest validation and initial rules modules
- Initial deterministic d20 roll and modifier helpers under `src/rules/`
- GitHub Actions CI for typecheck, tests, and build
- Release workflow that publishes `system.json` and `system.zip` for version tags

Not implemented yet:

- Full content packs for species, backgrounds, feats, flaws, equipment, spells, or magic streams
- Full published-content automation for species/background/feat/flaw catalogs
- Automatic combat or combatant creation for initiative
- Foundry LevelDB/NeDB compendium packs declared in `system.json`

## Requirements

- Node.js 20 or 22 for repository checks (`npm run verify`)
- Docker Engine + Compose v2 for the Foundry v14 runtime
- npm
- A licensed Foundry Virtual Tabletop **14.368** Node.js zip (cached privately; never committed)
- Playwright Chromium for browser acceptance tests (`npx playwright install chromium`)

Version pins live in [`foundry/versions.json`](foundry/versions.json). The Foundry process uses Node 24 inside the pinned Felddy container.

## Setup

Install dependencies:

```sh
npm ci
```

Run the local verification suite:

```sh
npm run verify
```

Watch and rebuild during development:

```sh
npm run dev
```

The build writes the Foundry module entry file to `dist/pivot.mjs`.

## Local Foundry

One command starts the persistent development world after first-time setup:

```sh
npm run foundry:up
```

First-time setup (repository root):

```sh
cp .env.foundry.local.example .env.foundry.local
# set FOUNDRY_ADMIN_KEY, FOUNDRY_LICENSE_KEY, and a 14.368 Node.js zip source
npm run build
npm run foundry:check-env
npm run foundry:up
```

Foundry is at <http://127.0.0.1:30000> on loopback only. Put the licensed zip in `foundry-dist/` as `foundryvtt-14.368.zip` (preferred) or use `FOUNDRY_RELEASE_ARCHIVE` / a private cache URL. A Foundry timed URL works once and expires in about five minutes.

```sh
npm run foundry:status
npm run foundry:logs
npm run foundry:down
npm run foundry:e2e
```

See:

- [Local Foundry](docs/foundry-local-dev.md)
- [Testing](docs/foundry-testing.md)
- [Cursor Cloud Agents](docs/foundry-cloud.md)
- [Deployment](docs/deployment.md) — https://build.angryorcgames.com and https://foundry.angryorcgames.com

## Project Layout

```text
.
|-- system.json              Foundry system manifest
|-- src/pivot.ts             Foundry runtime entry point
|-- src/data/                Foundry TypeDataModel schema factories
|-- src/rules/               Pure TypeScript rules helpers
|-- src/migrations/          Named document migrations
|-- src/content/             Canonical JSON content source
|-- src/sheets/              Actor and Item sheet classes/context helpers
|-- templates/               Handlebars sheet templates
|-- styles/                  Pivot Fantasy sheet stylesheet
|-- lang/en.json             English localization file
|-- packs/src/               Generated Foundry document JSON (not LevelDB packs)
|-- dist/                    Built Foundry runtime output
|-- vite.config.ts           Build configuration
|-- vitest.config.ts         Test configuration
|-- tsconfig.json            Strict TypeScript configuration
`-- docs/                    Development and release notes
```

Future gameplay implementation should keep deterministic rules code in `src/rules/` with Vitest coverage, and keep Foundry-specific integration code close to Foundry lifecycle, document, and sheet boundaries. See [docs/architecture.md](docs/architecture.md) for the current architecture map.

## Scripts

- `npm run build`: builds `src/pivot.ts` into `dist/pivot.mjs` and regenerates content pack source JSON
- `npm run build:content`: validates `src/content/` and writes `packs/src/items.json`
- `npm run dev`: runs Vite in watch mode
- `npm run lint`: runs ESLint with zero warnings allowed
- `npm run format`: formats supported project files with Prettier
- `npm run format:check`: checks formatting without writing files
- `npm run audit`: runs `npm audit` at moderate severity or higher
- `npm run package:system`: builds and validates `system.zip`
- `npm run verify`: runs lint, formatting, typecheck, tests, build, and audit
- `npm run test`: runs Vitest once
- `npm run test:watch`: runs Vitest in watch mode
- `npm run typecheck`: runs TypeScript without emitting files
- `npm run foundry:check-env`: validates Foundry credentials and version pins without printing secrets
- `npm run foundry:doctor`: prints instance, Docker, cache, and retired-data diagnostics
- `npm run foundry:provision`: verifies the licensed archive checksum and pulls the pinned image
- `npm run foundry:up`: starts the owned persistent Compose development world
- `npm run foundry:status`: shows owned-instance status
- `npm run foundry:logs`: follows owned-instance logs
- `npm run foundry:down`: stops the owned development instance
- `npm run foundry:reset`: resets disposable E2E data only
- `npm run foundry:e2e`: packages `system.zip`, starts a disposable Foundry, runs Playwright, and cleans up

## CI/CD

```text
PR CI (no Foundry secrets) → trusted Foundry E2E → merge to main
  → build-server deploy + smoke (https://build.angryorcgames.com)
  → approved production promotion (https://foundry.angryorcgames.com)
```

- Every PR: lint, format, types, unit tests, build, package validation
- Same-repository PRs: isolated Foundry E2E with narrowly scoped secrets
- External forks: CI only; review the exact commit, then `workflow_dispatch` Foundry E2E
- Release tags: prepare the versioned manifest, test that exact zip, publish only after E2E

See [docs/deployment.md](docs/deployment.md) for Environments, required checks, and remaining GitHub settings. Dependabot still opens weekly npm and Actions update PRs.

## Release Model

Releases are produced by pushing a version tag that matches `v*`, for example `v0.1.0`. The release workflow:

1. Installs dependencies with `npm ci`
2. Runs `npm run verify`
3. Validates the tag as a semantic version prefixed with `v`
4. Updates the release copy of `system.json` to the tag version
5. Builds and validates `system.zip`
6. Uploads `system.json` and `system.zip` to the GitHub release

Foundry installs use the manifest URL in `system.json`:

```text
https://github.com/angry-orc-games/pivot-foundry/releases/latest/download/system.json
```

See [docs/release.md](docs/release.md) for the release checklist.

## Development Notes

See [docs/development.md](docs/development.md) for architecture boundaries, testing expectations, and contribution guardrails for the next implementation slices.
