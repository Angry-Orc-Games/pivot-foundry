# Release Checklist

The repository publishes Foundry install artifacts from GitHub Actions when a tag matching `v*` is pushed.

## Before Tagging

Verify the package locally:

```sh
npm ci
npm run verify
npm run package:system
```

Check that `system.json` contains the intended metadata:

- `id`: `pivot-fantasy`
- `title`: `Pivot Fantasy`
- `compatibility.minimum`: `13`
- `compatibility.verified`: `13`
- `esmodules`: `dist/pivot.mjs`
- `manifest`: latest release `system.json` URL
- `download`: latest release `system.zip` URL

## Tagging

Create and push a version tag:

```sh
git tag v0.1.0
git push origin v0.1.0
```

Use the actual version number for the release being published.

## Workflow Output

The release workflow uploads:

- `system.json`
- `system.zip`

During the workflow, the release copy of `system.json` is updated so:

- `version` matches the tag without the leading `v`
- `download` points at the tag-specific `system.zip`

The tag must be a semantic version prefixed with `v`, such as `v0.1.0`.

## Foundry Install Test

After the GitHub release finishes:

1. Copy the release manifest URL from `system.json`.
2. In Foundry v13, open the system installation screen.
3. Install from the manifest URL.
4. Create a test world using `Pivot Fantasy`.
5. Confirm the browser console logs `Pivot Fantasy | Initializing system`.

If future releases add `packs/`, `templates/`, or styles, verify those assets are present in `system.zip` and load correctly in Foundry before announcing the release.

For direct deployment to the Angry Orc Games Foundry servers, use [deployment.md](deployment.md). Releasing GitHub artifacts and deploying to a live Foundry server are separate operations.
