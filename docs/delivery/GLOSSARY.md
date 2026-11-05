# Delivery

Language for how a Pivot Foundry system package moves from a commit to the Angry Orc Games hosts.

## Package

**System package**:
The Foundry installable zip (`system.zip`) together with the sibling `system.json`.
_Avoid_: npm package, artifact, build

**Artifact identity**:
The sidecar that records a system package’s commit, package version, zip SHA-256, and Foundry pin.
_Avoid_: checksum file, manifest

**GitHub artifact**:
A named Actions upload that carries a system package and, when required, its artifact identity.
_Avoid_: package, zip (those are the files inside it)

**Staging-accepted package**:
The exact system package staging deployed and smoked, which production is allowed to promote.
_Avoid_: CI zip, E2E zip (those are earlier or separately built bytes)

## Trust

**Trusted-gate**:
The runner tree checked out from the workflow’s own commit, holding scripts, the E2E harness, and local composite actions. The system under test is not this tree.
_Avoid_: trusted checkout, sparse checkout

**E2E overlay**:
The copy of the untrusted system-under-test onto the trusted-gate runner, excluding harness and tooling paths.
_Avoid_: overlay (NPC overlay and token overlay are different)

**Verify**:
The required GitHub check named `Verify` on a pull request or `main` push: repository checks plus packaging and artifact identity, with no Foundry secrets.
_Avoid_: `npm run verify` (local, and a different command)

## Pipeline

**Nightly**:
The Foundry E2E check posted as `Foundry E2E (nightly)` for `main` (and same-repo PRs labeled `e2e-nightly`) inside the license window.
_Avoid_: E2E (bare), on-demand

**On-demand E2E**:
A dispatched Foundry E2E run for a PR or SHA. It is not a nightly check.
_Avoid_: nightly

**Staging**:
The deploy of the CI system package to the build server at https://build.angryorcgames.com.
_Avoid_: build (the compile step), `build` (the GitHub Environment name)

**Build environment**:
The GitHub Environment named `build` that holds SSH credentials for the staging host.
_Avoid_: staging environment (no GitHub Environment is named staging)

**Promote**:
The human-approved production deploy of the staging-accepted package, after a green nightly on that packaged commit.
_Avoid_: release, deploy

**Production**:
The player-facing host at https://foundry.angryorcgames.com.
_Avoid_: Foundry (the VTT), foundry (the product name)

**Release**:
Publishing the tagged system package as a GitHub Release. It does not deploy Angry Orc Games hosts.
_Avoid_: promote, production deploy
