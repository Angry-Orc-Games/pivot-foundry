import {
  createFoundryPaths,
  isFoundryInstalled,
  loadFoundryEnv,
  repoRoot,
  validateFoundryEnv,
} from "./foundry-env.mjs";

const paths = createFoundryPaths(repoRoot);

let env;
try {
  env = loadFoundryEnv(paths.envFile);
} catch (error) {
  if (error?.code === "ENOENT") {
    console.error(error.message);
    process.exit(1);
  }

  throw error;
}

const result = validateFoundryEnv(env, {
  foundryInstalled: isFoundryInstalled(paths.foundryApp),
});

if (!result.ok) {
  for (const message of result.errors) {
    console.error(message);
  }
  process.exit(1);
}

if (isFoundryInstalled(paths.foundryApp)) {
  console.log("Foundry env check passed: v14 Node.js install is present.");
} else if (result.releaseUrl) {
  console.log("Foundry env check passed: v14 Node.js timed URL configured.");
} else {
  console.log("Foundry env check passed: v14 Node.js archive configured.");
}
