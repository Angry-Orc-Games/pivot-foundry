# Deployment Runbook

Use this runbook when asked to deploy the Pivot Fantasy Foundry VTT system to Angry Orc Games Foundry servers on Hetzner. This file is not standing authorization to deploy.

## Project Context

- Local repository: `/Users/ken/Developer/aog/pivot-foundry`
- Canonical remote: `git@github.com:Angry-Orc-Games/pivot-foundry.git`
- Foundry system id: `pivot-fantasy`
- Package artifact: `system.zip`
- Required local checks: `npm run verify`, `npm run package:system`, `shasum -a 256 system.zip`, and `unzip -t system.zip`

The package must include `documentTypes.Actor.character`, and the runtime must register a matching `TypeDataModel`. Without that pairing, Foundry Actor creation can fail with schema validation errors.

## Safety Rules

- Start every deployment request with read-only local and remote inspection.
- Do not guess remote paths.
- Do not overwrite live state without a timestamped backup.
- Do not print secrets, admin passwords, cookies, license data, or Foundry credential material.
- Do not mutate worlds, users, actors, or settings as part of a system deployment unless explicitly requested.
- Never restart both Foundry services unless specifically asked.
- Preserve unrelated local git changes. If the repo is dirty, show what is dirty before deployment and do not include unrelated files unless they are part of the built package.

## Server Access

- Preferred SSH: `ssh root@foundry.angryorcgames.com`
- Host: `foundry.angryorcgames.com`
- Last known IP: `178.104.144.136`
- Previously observed hostname: `ubuntu-8gb-nbg1-2`
- Avoid the `hetzner-appflowy` alias for this workflow because it may bind local port 3000.

## Environments

### Dev / Build

- Service: `foundryvttdev.service`
- Data path: `/opt/foundryvtt-dev/data`
- System target: `/opt/foundryvtt-dev/data/Data/systems/pivot-fantasy`
- Backup root: `/opt/foundryvtt-dev/data/Backups/systems`
- Public URL: `https://build.angryorcgames.com`
- Public manifest: `https://build.angryorcgames.com/systems/pivot-fantasy/system.json`
- Nginx proxy: `127.0.0.1:30001`
- Known Pivot test world: `pivot-test`

### Production

- Service: `foundryvtt.service`
- Data path: `/opt/foundryvtt/data`
- System target: `/opt/foundryvtt/data/Data/systems/pivot-fantasy`
- Backup root: `/opt/foundryvtt/data/Backups/systems`
- Public URL: `https://foundry.angryorcgames.com`
- Public manifest: `https://foundry.angryorcgames.com/systems/pivot-fantasy/system.json`
- Nginx proxy: `127.0.0.1:30000`

## Required Read-Only Checks

Run local checks first:

```sh
git status --short --branch
git log -1 --oneline
git remote -v
```

Run remote checks before deployment:

```sh
ssh root@foundry.angryorcgames.com 'systemctl is-active foundryvtt.service foundryvttdev.service nginx.service'
ssh root@foundry.angryorcgames.com 'systemctl cat foundryvttdev.service'
ssh root@foundry.angryorcgames.com 'systemctl cat foundryvtt.service'
```

Inspect only the target service for the requested deployment after the broad service check.

## Required Local Package Checks

```sh
npm run verify
npm run package:system
shasum -a 256 system.zip
unzip -t system.zip
```

Record the branch, commit, package checksum, and whether the working tree was dirty.

## Dev Deployment Pattern

Restart only `foundryvttdev.service`.

```sh
target=/opt/foundryvtt-dev/data/Data/systems/pivot-fantasy
backup=/opt/foundryvtt-dev/data/Backups/systems/pivot-fantasy-$(date -u +%Y%m%dT%H%M%SZ)
service=foundryvttdev.service
public=https://build.angryorcgames.com/systems/pivot-fantasy/system.json
```

Deployment flow:

1. Copy `system.zip` to `/tmp` on the server.
2. Create the backup root if needed.
3. Move any existing target folder to the UTC timestamped backup path.
4. Create the target folder.
5. Unzip `system.zip` into the target folder.
6. Validate `system.json` in the target folder.
7. Restart only `foundryvttdev.service`.

If the restart drops the active dev world, report that `/join` is live and the world needs relaunch. Do not use or print the admin password.

## Production Deployment Pattern

Restart only `foundryvtt.service`.

```sh
target=/opt/foundryvtt/data/Data/systems/pivot-fantasy
backup=/opt/foundryvtt/data/Backups/systems/pivot-fantasy-$(date -u +%Y%m%dT%H%M%SZ)
service=foundryvtt.service
public=https://foundry.angryorcgames.com/systems/pivot-fantasy/system.json
```

Before production deployment, stop and confirm the exact commit, target path, backup path, and service with the user. Do not restart production from an ambiguous dirty tree or an unconfirmed target.

## Post-Deploy Verification

Run these checks for the target environment only:

```sh
ssh root@foundry.angryorcgames.com 'systemctl is-active <service>'
curl -fsS <public>
curl -fsS <public> | node -e 'let data=""; process.stdin.on("data", c => data += c); process.stdin.on("end", () => { const m = JSON.parse(data); if (!m.documentTypes?.Actor?.character) process.exit(1); })'
curl -fsS <public-dist-pivot-mjs-url>
ssh root@foundry.angryorcgames.com 'journalctl -u <service> --since "5 minutes ago" --no-pager'
```

Also compare the checksum of the public `dist/pivot.mjs` with the remote file in the deployed target. Check journal output for Pivot, system, schema, and TypeDataModel errors without printing secrets.

## Final Report

A deployment handoff must include:

- Branch and commit deployed.
- Target environment.
- Target path and backup path.
- Service restarted.
- Package checksum.
- Verification commands and results.
- Any compatibility caveats, especially Foundry v14 information versus this manifest's current Foundry v13 target.
