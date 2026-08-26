# Foundry Docker Development

This project can run against a local Foundry VTT v13 Docker sandbox so sheet and runtime changes can be checked in the real Foundry browser UI.

The Compose stack is for local development only. It bind-mounts the public system assets into Foundry as the `pivot-fantasy` system and keeps Foundry user data in the ignored `foundry-data/` directory.

## One-Time Setup

1. Copy the local env template:

```sh
cp .env.foundry.local.example .env.foundry.local
```

2. Edit `.env.foundry.local`.

Use either `FOUNDRY_RELEASE_URL` or `FOUNDRY_USERNAME` plus `FOUNDRY_PASSWORD`. A temporary Version 13 Node.js download URL from the Foundry license page is preferred for agent-assisted local testing because it avoids storing account credentials in the checkout.

Make sure the timed URL is for Foundry v13 and the `Node.js` operating system option. A Linux, Windows, macOS, or latest v14 URL will not boot in this v13 sandbox.

Set `FOUNDRY_ADMIN_KEY` to a local-only admin password.

For unattended agent testing beyond the first activation screen, also set `FOUNDRY_LICENSE_KEY` or use `FOUNDRY_USERNAME` plus `FOUNDRY_PASSWORD`. A timed URL installs Foundry but does not activate the software license by itself.

Keep `.env.foundry.local` out of commits. It can contain account credentials, a license key, or a temporary signed download URL.

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

Foundry will be available at <http://localhost:30000>.

Stop the sandbox when you are done:

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

That path is assembled from read-only bind mounts of `system.json`, `dist/`, `lang/`, `packs/`, `styles/`, and `templates/`. Source edits and Vite output are still written from the host checkout, then served by Foundry after refresh or hot reload.

Do not mount the whole checkout into the Foundry system path. Ignored local files such as `.env.foundry.local` can contain credentials or signed download URLs and must never be served as system assets.

## Useful Commands

```sh
npm run foundry:up
npm run foundry:logs
npm run foundry:down
npm run foundry:check-env
```

If the container exits early, check the logs first. The most common causes are a missing or expired `FOUNDRY_RELEASE_URL`, or a timed URL generated for the wrong Foundry version or operating system.

If Foundry reports that a data directory is locked after an interrupted run, stop the container and check for a stale lock file under `foundry-data/Config/` before starting it again.

## Verification Expectations

Use this sandbox for manual Foundry v13 smoke tests when code touches sheets, templates, styles, document schemas, hooks, or runtime behavior.

Recommended smoke test:

1. Run `npm run verify`.
2. Run `npm run build`.
3. Run `npm run foundry:up`.
4. Open <http://localhost:30000>.
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
