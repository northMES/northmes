import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryNodeVersion = fileURLToPath(new URL('../.node-version', import.meta.url));

function major(version) {
  return Number.parseInt(version.trim().replace(/^v/, ''), 10);
}

export function compare(running, pinned) {
  if (major(running) === major(pinned)) {
    return { ok: true, message: '' };
  }
  return {
    ok: false,
    message: `Node ${running} is running, but .node-version pins ${pinned}. Switch to Node ${pinned}.`,
  };
}

function isEntryPoint() {
  return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
}

function main(path = repositoryNodeVersion) {
  const { ok, message } = compare(process.version, readFileSync(path, 'utf8').trim());
  if (!ok) {
    console.error(message);
    process.exitCode = 1;
  }
}

if (isEntryPoint()) {
  main(process.argv[2]);
}
