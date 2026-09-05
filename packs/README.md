# Packs

`packs/src/` holds generated Foundry **document JSON** produced from `src/content/`.

This is not a Foundry v13 LevelDB/NeDB compendium database. `system.json` therefore keeps `"packs": []` until a later slice generates a real pack with the Foundry CLI.

Regenerate with:

```sh
npm run build:content
```
