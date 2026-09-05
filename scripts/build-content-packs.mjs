import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const contentRoot = join(root, "src/content");
const outputPath = join(root, "packs/src/items.json");

const jsonFiles = await collectJsonFiles(contentRoot);
const records = [];

for (const file of jsonFiles) {
  records.push(JSON.parse(await readFile(file, "utf8")));
}

const server = await createServer({
  root,
  configFile: false,
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  logLevel: "error",
});

try {
  const content = await server.ssrLoadModule(join(root, "src/rules/content.ts"));
  const catalog = content.validateContentCatalog(records);
  const documents = content.generateContentPackDocuments(catalog);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(documents, null, 2)}\n`);
  console.log(`Pivot Fantasy | wrote ${documents.length} content pack source document(s)`);
} finally {
  await server.close();
}

async function collectJsonFiles(dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectJsonFiles(path)));
    } else if (entry.name.endsWith(".json")) {
      files.push(path);
    }
  }

  return files.sort();
}
