import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryNodeVersion = fileURLToPath(new URL('../.node-version', import.meta.url));

function major(version) {
  return Number.parseInt(version.trim().replace(/^v/, ''), 10);
}

export function compare(running, pinned) {
  if (Number.isNaN(major(pinned))) {
    return {
      ok: false,
      message: `.node-version holds ${JSON.stringify(pinned)}, which does not start with a Node major such as 26.`,
    };
  }
  if (major(running) === major(pinned)) {
    return { ok: true, message: '' };
  }
  return {
    ok: false,
    message: `Node ${running} is running, but .node-version pins ${pinned}. Switch to Node ${pinned}.`,
  };
}

function isEntryPoint() {
  const entry = process.argv[1];
  return Boolean(entry) && import.meta.url === pathToFileURL(realpathSync(entry)).href;
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function main(path = repositoryNodeVersion) {
  let pinned;
  try {
    pinned = readFileSync(path, 'utf8').trim();
  } catch (error) {
    fail(`Cannot read .node-version at ${path}: ${error.code ?? error.message}`);
    return;
  }
  const { ok, message } = compare(process.version, pinned);
  if (!ok) {
    fail(message);
  }
}

if (isEntryPoint()) {
  main(process.argv[2]);
}
