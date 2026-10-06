import { realpathSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));

export const stages = Object.freeze([]);

export async function run(stages, options, io) {
  const names = stages.map((stage) => stage.name).join(', ');
  io.log(`stages: ${names || 'none'}`);
  const outDir = options.check ? await mkdtemp(join(tmpdir(), 'gen-')) : io.root;
  try {
    for (const stage of stages) {
      await stage.generate(outDir);
    }
  } finally {
    if (options.check) {
      await rm(outDir, { recursive: true, force: true });
    }
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
