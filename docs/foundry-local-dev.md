# Local Foundry v14

This repository runs Foundry VTT v14 through Docker Compose and the [Felddy](https://github.com/felddy/foundryvtt-docker) wrapper. The official licensed **Node.js** distribution is installed from a private checksummed cache. Foundry itself still requires Node 24; that runtime lives inside the pinned container.

Repository checks (`npm run verify`) stay on Node 20 or 22.

## Version policy

Pins live in [`foundry/versions.json`](../foundry/versions.json):

| Item              | Pin                                                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| Foundry           | **14.368**                                                                                                 |
| Foundry host Node | **24** (inside the container)                                                                              |
| Container image   | `ghcr.io/felddy/foundryvtt:14.367@sha256:5004a67fbbef8e3f5f82afb01c8dbe06626c57519cad541a59b1bdce3c2a97ac` |
| Playwright        | `@playwright/test` **1.63.0** / Chromium                                                                   |

Felddy had no `14.368` image tag when this pin was recorded. `:14` and `:14.367` both resolved to the digest above. The wrapper installs Foundry **14.368** from `CONTAINER_CACHE` as `foundryvtt-14.368.zip`. Confirm the digest again before moving the pin.

Do not upgrade an existing v13 campaign world as part of this workflow. Keep v13 user data out of `foundry-data-v14/`.

## First-time setup

Run these from the repository root.

1. Install repository dependencies:

```sh
npm ci
```

2. Copy the env template:

```sh
cp .env.foundry.local.example .env.foundry.local
```

3. Edit `.env.foundry.local` (gitignored):

- `FOUNDRY_ADMIN_KEY` — local admin password, not `change-me-local-only`
- `FOUNDRY_LICENSE_KEY` — required for unattended setup and E2E
- One install source (in order of preference):
  1. Place the official `FoundryVTT-Node-14.368.zip` in `foundry-dist/` as `foundryvtt-14.368.zip`
  2. `FOUNDRY_RELEASE_ARCHIVE` — absolute path to that zip
  3. `FOUNDRY_RELEASE_CACHE_URL` plus `FOUNDRY_RELEASE_SHA256` — private durable URL, not a Foundry timed URL
  4. `FOUNDRY_RELEASE_URL` — first bootstrap only; expires in about five minutes

Generate a timed URL from [Purchased Licenses](https://foundryvtt.com/me/licenses) with **Version 14** and the **Node.js** OS option. Linux, Windows, and macOS archives will not boot this container.

4. Build the system, then start the persistent development world:

```sh
npm run build
npm run foundry:check-env
npm run foundry:up
```

Foundry is at <http://127.0.0.1:30000>. The port is published on loopback only. UPnP and IP discovery are disabled. Use Cursor port forwarding for Cloud Agent previews; do not expose the unauthenticated setup page on a public interface.

```sh
npm run foundry:status
npm run foundry:logs
npm run foundry:down
```

## Development / watch loop

Terminal 1:

```sh
npm run dev
```

Terminal 2:

```sh
npm run foundry:up
```

`foundry/compose.dev.yml` bind-mounts `system.json`, `dist/`, `lang/`, `packs/`, `styles/`, and `templates/` into the container. Acceptance tests do **not** use this loop; they install `system.zip`.

## Data locations

| Path                       | Role                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `foundry-data-v14/`        | Persistent local development data for this Compose workflow                                                |
| `foundry-dist/`            | Private licensed archive cache (`foundryvtt-14.368.zip`)                                                   |
| `.foundry/instances/<id>/` | Per-worktree runtime files and disposable E2E data                                                         |
| `foundry-app/`             | **Retired.** Left over from the host-Node launcher. Not used. Do not delete if you still need the install. |
| `foundry-data/`            | **Retired.** Previous host-Node user data. Not mounted. Do not delete campaign backups stored there.       |

The launcher never deletes retired directories, licenses, or volumes it does not own.

## Isolation

Each worktree, Cloud Agent, and CI run gets its own Compose project, container name, hostname, and writable data directory. Ports default to `30000` and move through `30000-30032` when that port is busy. Commands refuse to attach to a container whose ownership labels do not match this checkout and instance id.

## Wrapper vs Foundry options

`CONTAINER_*` variables are Felddy wrapper settings (`CONTAINER_CACHE`, `CONTAINER_PRESERVE_CONFIG`). `FOUNDRY_*` values are mapped by the wrapper into Foundry `options.json` / admin / license files. Do not pass Foundry website account passwords; this workflow uses a scoped archive plus `FOUNDRY_LICENSE_KEY`.

## Troubleshooting

| Symptom                       | Recovery                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `Missing .env.foundry.local`  | Copy the example file or export the `FOUNDRY_*` secrets.                                                                                    |
| `FOUNDRY_ADMIN_KEY` rejected  | Replace `change-me-local-only`.                                                                                                             |
| Archive checksum mismatch     | Re-download the Node 14.368 zip and update `FOUNDRY_RELEASE_SHA256`.                                                                        |
| Timed URL expired             | Generate a new Node.js timed URL, or use `foundry-dist/` from a previous successful download.                                               |
| Docker not available          | Install Docker Compose v2 and start the daemon. Cloud Agents use `scripts/cloud-agent-start.sh`.                                            |
| Port already in use           | The CLI picks the next free loopback port. Check `npm run foundry:status`.                                                                  |
| License screen on every start | Set a stable hostname (the Compose file does this) and `FOUNDRY_LICENSE_KEY`. Activation needs outbound access to Foundry’s license server. |
| Attached to the wrong server  | `foundry:down` / `foundry:e2e` exit if ownership labels do not match.                                                                       |
| Stale lock after a crash      | `npm run foundry:down`, then start again. Do not delete `foundry-data-v14/` unless you intend to wipe the dev world.                        |

`npm run foundry:doctor` prints instance, cache, Docker, and retired-directory diagnostics without printing secret values.
