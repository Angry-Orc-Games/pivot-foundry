# Pivot Fantasy Foundry System

Pivot Fantasy is a Foundry VTT v13 game system for the free Pivot Fantasy core rules engine. This repository currently contains the first working system shell: a strict TypeScript/Vite build, Foundry manifest, language file, CI, and release packaging.

The goal is to keep the Foundry runtime thin while game rules, dice logic, and character math grow as testable TypeScript modules.

## Current Status

This is an early scaffold, not a playable character-sheet implementation yet.

Implemented:

- Foundry v13 `system.json` manifest for `pivot-fantasy`
- TypeScript source entry point at `src/pivot.ts`
- Vite build output to `dist/pivot.mjs`
- Vitest test runner configured for future rule tests
- GitHub Actions CI for typecheck, tests, and build
- Release workflow that publishes `system.json` and `system.zip` for version tags

Not implemented yet:

- Actor, item, or sheet models
- Character sheets and item sheets
- Dice roller, Pool mechanics, or other rules modules
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
|-- lang/en.json             English localization file
|-- dist/                    Built Foundry runtime output
|-- vite.config.ts           Build configuration
|-- vitest.config.ts         Test configuration
|-- tsconfig.json            Strict TypeScript configuration
`-- docs/                    Development and release notes
```

Future gameplay implementation should keep deterministic rules code in `src/rules/` with Vitest coverage, and keep Foundry-specific integration code close to Foundry lifecycle, document, and sheet boundaries.

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
