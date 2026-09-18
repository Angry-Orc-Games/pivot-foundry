# Cursor Cloud Agents

Committed configuration:

- [`.cursor/environment.json`](../.cursor/environment.json)
- [`.cursor/Dockerfile`](../.cursor/Dockerfile)
- [`scripts/cloud-agent-install.sh`](../scripts/cloud-agent-install.sh) — `npm ci`, Playwright Chromium, `npm run build`
- [`scripts/cloud-agent-start.sh`](../scripts/cloud-agent-start.sh) — start Docker, write `.env.foundry.local` from Runtime Secrets if missing

`install` does not start Foundry. `start` does not start Foundry. After a snapshot, the agent must use the **current checkout** (`npm ci` / `npm run build` / bind-mounted source) before claiming a sheet change works.

## Secrets

Configure **Cursor Dashboard → Cloud Agents → Secrets** as **Runtime Secrets**. Never commit them or bake them into a snapshot.

| Secret                      | Persist? | Purpose                            |
| --------------------------- | -------- | ---------------------------------- |
| `FOUNDRY_ADMIN_KEY`         | Yes      | Local admin password               |
| `FOUNDRY_LICENSE_KEY`       | Yes      | First-run activation               |
| `FOUNDRY_RELEASE_CACHE_URL` | Optional | Durable private zip URL            |
| `FOUNDRY_RELEASE_SHA256`    | Optional | Checksum for that zip              |
| `FOUNDRY_RELEASE_ARCHIVE`   | Optional | Path if the zip is already on disk |

Do **not** persist `FOUNDRY_RELEASE_URL`. Timed links expire in about five minutes. Paste a fresh Node.js URL into the agent chat only for a one-shot bootstrap.

Do **not** give Cloud Agents production deploy secrets (`FOUNDRY_DEPLOY_*` for the production environment).

## Isolated instance

Each agent computes an instance id from the checkout path and conversation id. `npm run foundry:up` publishes <http://127.0.0.1:30000> when that port is free. Preview the port through Cursor forwarding. Confirm WebSocket traffic as well as the first HTML page.

```sh
npm run build
npm run foundry:up
npm run foundry:status
npm run foundry:e2e
npm run foundry:down
```

Evidence required before claiming a Foundry change works:

1. `npm run verify` from this checkout
2. `npm run package:system` when packaging changed
3. `npm run foundry:e2e` when credentials and Docker are available, or an explicit note that browser E2E was not run
4. Manual join at the forwarded port when the agent actually started Foundry

## Licensing

Cloud, local, staging, and production hosts that are reachable by players each count toward Foundry’s “one hosted instance accessible to users other than the license owner” rule. See [Licensing](deployment.md#licensing).
