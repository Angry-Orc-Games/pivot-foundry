# Local Foundry Host

This project can run against a local Foundry VTT v14 Node.js server so sheet and runtime changes can be checked in the real Foundry browser UI.

The host process is for local development only. It installs the official Foundry v14 Node.js zip into ignored `foundry-app/`, keeps user data in ignored `foundry-data/`, and symlinks this checkout's public system assets into `foundry-data/Data/systems/pivot-fantasy`.

Do not commit Foundry binaries, timed download URLs, or license keys. Do not bake `foundry-app/` into a Cloud Agent snapshot.

## One-Time Setup

1. Copy the local env template:

```sh
cp .env.foundry.local.example .env.foundry.local
```

2. Edit `.env.foundry.local`.

The Foundry host process needs **Node 24**. Repository checks such as `npm run verify` can stay on Node 20 or 22. If `node` is not already v24, install it with `nvm install 24` or set `FOUNDRY_NODE` to that binary. `npm run foundry:up` will use nvm's Node 24 when present.

For a first install into `foundry-app/`, set either `FOUNDRY_RELEASE_URL` or `FOUNDRY_RELEASE_ARCHIVE`. A temporary Version 14 Node.js download URL from the Foundry license page is preferred for agent-assisted local testing because it avoids storing a zip in the checkout. Later starts reuse the ignored install and do not need a fresh URL.

Make sure the timed URL or zip is for Foundry v14 and the `Node.js` operating system option (`FoundryVTT-Node-14.*`). A Linux, Windows, macOS, or incompatible version archive will not boot this sandbox. The verified pin for this repository is **14.361**.

Set `FOUNDRY_ADMIN_KEY` to a local-only admin password.

For unattended testing beyond the first activation screen, also set `FOUNDRY_LICENSE_KEY` and paste that key into the Foundry setup UI on first launch. A timed URL installs Foundry but does not activate the software license by itself.

Keep `.env.foundry.local` out of commits. It can contain a license key or a temporary signed download URL.

3. Build the system once:

```sh
npm run build
```

4. Validate the local Foundry env without printing secret values:

```sh
npm run foundry:check-env
```

5. Start Foundry:

```sh
npm run foundry:up
```

Foundry will be available at <http://127.0.0.1:30000>.

Stop the server when you are done:

```sh
npm run foundry:down
```

## Development Loop

Run the Vite watcher in one terminal:

```sh
npm run dev
```

Run Foundry in another terminal:

```sh
npm run foundry:up
```

Create or open a world that uses the `Pivot Fantasy` system. Foundry reads the system from:

```text
foundry-data/Data/systems/pivot-fantasy
```

That path is a directory of symlinks to `system.json`, `dist/`, `lang/`, `packs/`, `styles/`, and `templates/`. Source edits and Vite output are still written from the host checkout, then served by Foundry after refresh or hot reload.

Do not symlink the whole checkout into the Foundry data path. Ignored local files such as `.env.foundry.local` can contain credentials or signed download URLs and must never be served as system assets.

## Useful Commands

```sh
npm run foundry:up
npm run foundry:logs
npm run foundry:down
npm run foundry:check-env
```

The host launch is:

```sh
node main.js --dataPath=<repo>/foundry-data --port=30000 --adminPassword=<FOUNDRY_ADMIN_KEY> --hotReload --noupnp --noipdiscovery
```

If the process exits early, check `npm run foundry:logs` first. The most common causes are a missing or expired `FOUNDRY_RELEASE_URL`, a zip generated for the wrong Foundry version or operating system, or a host Node that is not version 24.

If Foundry reports that a data directory is locked after an interrupted run, stop the process with `npm run foundry:down` and check for a stale lock file under `foundry-data/Config/` before starting it again.

## Verification Expectations

Use this host for manual Foundry v14 smoke tests when code touches sheets, templates, styles, document schemas, hooks, or runtime behavior.

Recommended smoke test:

1. Run `npm run verify`.
2. Run `npm run build`.
3. Run `npm run foundry:up`.
4. Open <http://127.0.0.1:30000>.
5. Confirm `Pivot Fantasy` appears under Game Systems.
6. Create or launch a throwaway world that uses `Pivot Fantasy`.
7. Join as Gamemaster.
8. Create a `character` actor.
9. Open the character sheet and confirm the expected tabs render.
10. Click a sheet action such as Initiative and confirm the chat card appears.

Report manual Foundry testing separately from repository checks such as:

```sh
npm run verify
```
