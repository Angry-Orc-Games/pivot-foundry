# Foundry secrets

How this repository consumes Foundry install and license material. `npm run foundry:up` reads **`.env.foundry.local`**, not `process.env`.

Do **not** put a real download URL, verify token, license key, or admin password in git, snapshots, issue text, or these docs.

Sources: `.env.foundry.local.example`, `scripts/foundry-env.mjs`, [foundry-local-dev.md](foundry-local-dev.md), Cursor [Cloud environment setup](https://cursor.com/docs/cloud-agent/setup) and [Secrets & Network](https://cursor.com/docs/cloud-agent/security-network).

## Daily: zip on odin

Daily Foundry is on **odin**. Set `FOUNDRY_RELEASE_ARCHIVE` in `.env.foundry.local` to the absolute path of a local `FoundryVTT-Node-14.*.zip` (verified pin **14.368**). Keep the zip out of git. Later starts reuse ignored `foundry-app/`.

```sh
cp .env.foundry.local.example .env.foundry.local
# edit keys, then:
npm run build
npm run foundry:check-env
npm run foundry:up
```

http://127.0.0.1:30000

`FOUNDRY_ADMIN_KEY` is required every start. `FOUNDRY_LICENSE_KEY` is for first-run UI activation.

## Cloud Agents without Foundry

Default Cloud work does **not** boot Foundry. On `main`, run `npm ci`, `npm run verify`, and `npm run package:system`. No timed URL, no `.env.foundry.local`, no Node 24 host, no port forward.

## Persist Cursor Secrets

Save only these two as **Runtime Secrets** (Dashboard → Cloud Agents → Secrets, or the Secrets tab on the saved environment):

| Name | Why it persists |
| --- | --- |
| `FOUNDRY_ADMIN_KEY` | Every `foundry:up` (`--adminPassword`). Local-only password; not `change-me-local-only`. |
| `FOUNDRY_LICENSE_KEY` | First-run activation in the Foundry setup UI. A timed URL **installs** Foundry; it does **not** activate the license. |

Cursor injects Runtime Secrets as environment variables and redacts them from tool output, transcripts, and commits (`[REDACTED]`). They are still real values in the VM shell.

Do **not** persist `FOUNDRY_RELEASE_URL`. Timed Foundry download links expire in about **five minutes**.

Optional, not persisted on the environment:

| Name | When |
| --- | --- |
| `FOUNDRY_RELEASE_ARCHIVE` | odin daily zip, or a zip that already exists **on that VM** |
| `FOUNDRY_NODE` | Non-sensitive path to Node 24. An Environment Variable is fine. |

`FOUNDRY_USERNAME` / `FOUNDRY_PASSWORD` are **not** an install method on this host.

## Cloud Foundry only when needed

Use this path only when someone asks to host Foundry on a Cloud Agent. A prior session on `main` brought Foundry **14.368** up this way and created world **Pivot Fantasy Test**.

1. Confirm persisted Runtime Secrets are `FOUNDRY_ADMIN_KEY` and `FOUNDRY_LICENSE_KEY` only.
2. Generate a Version 14 **Node.js** timed URL at https://foundryvtt.com/me/licenses (`FoundryVTT-Node-14.*`, pin **14.368**). Linux, Windows, macOS, or non-Node archives will not boot.
3. Paste that URL into **this agent chat** immediately (~5 minute TTL). Do not save it on the environment.
4. Write gitignored `.env.foundry.local` (`umask 077`, mode `600`) with:
   - `FOUNDRY_ADMIN_KEY` and `FOUNDRY_LICENSE_KEY` from the persisted Runtime Secrets
   - `FOUNDRY_RELEASE_URL` from the chat paste (not from a saved secret)
5. Do not `cat`, `echo`, or commit the file. `foundry:up` reads the file only.
6. Install **Node 24** for the host (`nvm install 24` is fine). `npm ci` / `npm run verify` stay on Node 20/22.
7. `npm ci`, `npm run build`, `npm run foundry:check-env`, `npm run foundry:up`.
8. First launch: apply the license key and admin password in Foundry setup, then create world **Pivot Fantasy Test** (Pivot Fantasy system).
9. In the **Agents Window for that agent**, forward port **30000** to http://127.0.0.1:30000/join.

Restricted egress must allow Foundry’s license/download hosts (`foundryvtt.com`) or first-run activation fails. A `HEAD` on a timed URL can return 403 while the launcher’s `GET` still works; do not treat `HEAD` 403 as proof the paste expired.

After a successful install **on that same VM**, ignored `foundry-app/` is enough for later `foundry:up`. A new Cloud VM has an empty disk and needs a fresh paste. Do not bake `foundry-app/` into a snapshot.

```sh
umask 077
# Write FOUNDRY_ADMIN_KEY and FOUNDRY_LICENSE_KEY from injected Runtime Secrets.
# Write FOUNDRY_RELEASE_URL from the URL pasted in this chat, not from a saved secret.
# Do not cat, echo, or commit the file.
```

The file must exist before `npm run foundry:up`. Keys match `.env.foundry.local.example`.

## Never commit or bake into a snapshot

- `.env.foundry.local` and any other file that contains these values
- `FOUNDRY_RELEASE_URL`, `FOUNDRY_LICENSE_KEY`, `FOUNDRY_ADMIN_KEY`
- Foundry binaries: `foundry-app/`, `FoundryVTT*.zip`
- `foundry-data/` after a licensed run (contains `Config/license.json` / admin material)

Cursor can persist `.env.local`-style files inside an environment snapshot; **do not** do that for Foundry. The EULA forbids distributing copies. Builds stay `npm ci` / verify / package only.
