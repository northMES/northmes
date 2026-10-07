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
  if (options.check && stages.length > 0) {
    // Fails closed until the comparison with the repository root is built with the first stage.
    io.error(
      'gen --check: the comparison with the repository root is not built yet, so check mode fails when a stage runs',
    );
    return 1;
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

export async function main(argv, io, stageList = stages) {
  return run(stageList, { check: argv.includes('--check') }, io);
}

if (isEntryPoint()) {
  process.exitCode = await main(process.argv.slice(2), {
    log: console.log,
    error: console.error,
    root: repositoryRoot,
  });
}
