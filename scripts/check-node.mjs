import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2] ?? fileURLToPath(new URL('../.node-version', import.meta.url));
  const pinned = readFileSync(path, 'utf8').trim();
  const { ok, message } = compare(process.version, pinned);
  if (!ok) {
    console.error(message);
    process.exitCode = 1;
  }
}
