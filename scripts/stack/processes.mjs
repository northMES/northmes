// The child processes of pnpm dev and pnpm demo: each starts from the repository root in a process
// group of its own, prints its output under its name and stops with its group.

import { spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = realpathSync(fileURLToPath(new URL('../..', import.meta.url)));

/**
 * @typedef {object} PlannedProcess A process that pnpm dev or pnpm demo starts from the
 *   repository root.
 * @property {string} name The name its output lines carry.
 * @property {string} command
 * @property {string[]} args
 * @property {Record<string, string>} env What the process gets on top of the environment it
 *   starts with.
 */

/**
 * @typedef {object} StartedProcess
 * @property {string} name
 * @property {Promise<{ code: number | null, signal: string | null }>} exited Resolves once the
 *   process exits, or with code null when it could not start.
 * @property {() => Promise<void>} stop Ends the process group with SIGTERM, then SIGKILL after 5
 *   seconds, and resolves once the process exited.
 */

/** @type {Set<import('node:child_process').ChildProcess>} */
const running = new Set();

// A process group outlives pnpm dev unless pnpm dev ends it. Exit handlers run synchronously, and
// process.kill is synchronous.
process.on('exit', () => {
  for (const child of running) signalGroup(child, 'SIGTERM');
});

/**
 * The message of an error that a step threw, for a line of output.
 * @param {unknown} error
 */
export function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Prints a line of pnpm dev or pnpm demo itself under name.
 * @param {string} name
 * @param {string} line
 */
export function say(name, line) {
  console.log(`[${name}] ${line}`);
}

/**
 * Starts planned with env and then its own env over this process's environment, in a process group
 * of its own, and prints each line of its output under its name. onLine gets each line too.
 * @param {PlannedProcess} planned
 * @param {{ env?: Readonly<Record<string, string>>, onLine?: (line: string) => void }} [options]
 * @returns {StartedProcess}
 */
export function start(planned, { env = {}, onLine = () => {} } = {}) {
  const child = spawn(planned.command, planned.args, {
    cwd: repositoryRoot,
    env: { ...process.env, ...env, ...planned.env },
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  running.add(child);
  for (const output of [child.stdout, child.stderr]) {
    createInterface({ input: output, crlfDelay: Number.POSITIVE_INFINITY }).on('line', (line) => {
      say(planned.name, line);
      onLine(line);
    });
  }
  /** @type {StartedProcess['exited']} */
  const exited = new Promise((resolve) => {
    child.once('exit', (code, signal) => resolve({ code, signal }));
    child.once('error', (error) => {
      say(planned.name, `${planned.command} did not start: ${error.message}`);
      resolve({ code: null, signal: null });
    });
  }).then((result) => {
    running.delete(child);
    return result;
  });
  return {
    name: planned.name,
    exited,
    stop: async () => {
      if (!running.has(child)) return;
      signalGroup(child, 'SIGTERM');
      const kill = setTimeout(() => signalGroup(child, 'SIGKILL'), 5_000);
      await exited;
      clearTimeout(kill);
    },
  };
}

/**
 * Runs planned to its end, as start does, and throws when it exits with a code other than 0.
 * @param {PlannedProcess} planned
 * @param {{ env?: Readonly<Record<string, string>> }} [options]
 */
export async function run(planned, options) {
  const { code, signal } = await start(planned, options).exited;
  if (code !== 0) {
    const command = [planned.command, ...planned.args].join(' ');
    throw new Error(`${command} exited with ${code ?? signal ?? 'no code'}`);
  }
}

/**
 * Sends signal to the process group that child leads. The group is gone when its processes exited.
 * @param {import('node:child_process').ChildProcess} child
 * @param {NodeJS.Signals} signal
 */
function signalGroup(child, signal) {
  if (child.pid === undefined) return;
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code !== 'ESRCH') throw error;
  }
}
