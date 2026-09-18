import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { fileSha256 } from "./artifact-identity.mjs";
import { EXIT, repoRoot } from "./foundry-env.mjs";

const stage = process.argv[2];
if (stage !== "e2e" && stage !== "staging" && stage !== "production") {
  console.error("Usage: node scripts/record-acceptance.mjs <e2e|staging|production>");
  process.exit(EXIT.usage);
}

const identityPath = join(repoRoot, "artifact-identity.json");
const zipPath = join(repoRoot, "system.zip");
const identity = JSON.parse(readFileSync(identityPath, "utf8"));
const sha256 = fileSha256(zipPath);

if (identity.artifact?.sha256 !== sha256) {
  console.error("Refusing to record acceptance for a different system.zip.");
  process.exit(EXIT.identity);
}

identity[stage] = {
  result: "passed",
  sha256,
  at: new Date().toISOString(),
  runId: process.env.GITHUB_RUN_ID || "",
  url:
    process.env.PIVOT_FOUNDRY_BASE_URL ||
    (stage === "production"
      ? "https://foundry.angryorcgames.com"
      : stage === "staging"
        ? "https://build.angryorcgames.com"
        : "local"),
};

writeFileSync(identityPath, `${JSON.stringify(identity, null, 2)}\n`);
console.log(`Recorded ${stage} acceptance for ${sha256}.`);
