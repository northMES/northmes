import { realpathSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));

export const stages = Object.freeze([]);

export async function run(stages, options, io) {
  const names = stages.map((stage) => stage.name).join(', ');
  io.log(`stages: ${names || 'none'}`);
  for (const stage of stages) {
    await stage.generate(io.root);
  }
  return 0;
}

function isEntryPoint() {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  try {
    return import.meta.url === pathToFileURL(realpathSync(entry)).href;
  } catch {
    // Under --eval, argv[1] is a positional argument, not a script path.
    return false;
  }
}

async function main() {
  process.exitCode = await run(stages, {}, { log: console.log, root: repositoryRoot });
}

if (isEntryPoint()) {
  await main();
}
