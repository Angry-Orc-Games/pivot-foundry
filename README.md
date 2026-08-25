# Pivot Fantasy Foundry System

[![CI](https://github.com/Angry-Orc-Games/pivot-foundry/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Angry-Orc-Games/pivot-foundry/actions/workflows/ci.yml?query=branch%3Amain)
[![Release](https://github.com/Angry-Orc-Games/pivot-foundry/actions/workflows/release.yml/badge.svg)](https://github.com/Angry-Orc-Games/pivot-foundry/actions/workflows/release.yml)
![Foundry VTT](https://img.shields.io/badge/Foundry%20VTT-v13-blue)
![Node](https://img.shields.io/badge/Node-%3E%3D20.19.0-339933)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)
![Lint](https://img.shields.io/badge/lint-ESLint-4b32c3)
![Format](https://img.shields.io/badge/format-Prettier-f7b93e)
![Security](https://img.shields.io/badge/audit-npm%20audit-2ea44f)
![Status](https://img.shields.io/badge/status-scaffold-orange)

Pivot Fantasy is a Foundry VTT v13 game system for the free Pivot Fantasy core rules engine. This repository currently contains the first working system shell: a strict TypeScript/Vite build, Foundry manifest, language file, CI, release packaging, and the first tested rules modules.

The goal is to keep the Foundry runtime thin while game rules, dice logic, and character math grow as testable TypeScript modules.

## Current Status

This is an early scaffold, not a playable character-sheet implementation yet.

Implemented:

- Foundry v13 `system.json` manifest for `pivot-fantasy`
- TypeScript source entry point at `src/pivot.ts`
- Character Actor document type declaration and data model registration
- Vite build output to `dist/pivot.mjs`
- Vitest coverage for manifest validation and initial rules modules
- Initial deterministic d20 roll and modifier helpers under `src/rules/`
- GitHub Actions CI for typecheck, tests, and build
- Release workflow that publishes `system.json` and `system.zip` for version tags

Not implemented yet:

- Playable Actor, item, or sheet models
- Character sheets and item sheets
- Foundry-facing dice roller, Pool mechanics UI, or complete rules engine
- Compendium packs, templates, or styles
- Foundry data migrations

## Requirements

- Node.js 20 or newer
- npm
- Foundry Virtual Tabletop v13

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

## Local Foundry Install

For local testing, Foundry needs to see this repository as a system directory named `pivot-fantasy`.

On macOS, a typical symlink looks like this:

```sh
ln -s "$PWD" "$HOME/Library/Application Support/FoundryVTT/Data/systems/pivot-fantasy"
```

Then run:

```sh
npm run build
```

Start Foundry v13 and enable the `Pivot Fantasy` system when creating a world.

## Project Layout

```text
.
|-- system.json              Foundry system manifest
|-- src/pivot.ts             Foundry runtime entry point
|-- src/rules/               Pure TypeScript rules helpers
|-- lang/en.json             English localization file
|-- dist/                    Built Foundry runtime output
|-- vite.config.ts           Build configuration
|-- vitest.config.ts         Test configuration
|-- tsconfig.json            Strict TypeScript configuration
`-- docs/                    Development and release notes
```

Future gameplay implementation should keep deterministic rules code in `src/rules/` with Vitest coverage, and keep Foundry-specific integration code close to Foundry lifecycle, document, and sheet boundaries. See [docs/architecture.md](docs/architecture.md) for the current architecture map.

## Scripts

- `npm run build`: builds `src/pivot.ts` into `dist/pivot.mjs`
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

## CI/CD

GitHub Actions run on pull requests and pushes to `main`.

The CI workflow:

1. Installs dependencies with `npm ci`
2. Runs linting, formatting checks, typecheck, Vitest, Vite build, and dependency audit on Node 20 and Node 22
3. Builds and validates the Foundry release zip
4. Uploads `system.json` and `system.zip` as a workflow artifact

Dependabot is configured to open weekly update PRs for npm dependencies and GitHub Actions.

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
