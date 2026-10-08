// pnpm demo, which handoff-demo in .claude/launch.json runs (ADR 0058): the stack script's shared
// steps, then the production build of role all on PORT with the fictional seed, so a demo has one
// origin and one port.

import { boardUrl } from './board.mjs';
import { messageOf, onStopSignal, run, say, start } from './processes.mjs';
import { startStack } from './stack.mjs';

/** @typedef {import('./processes.mjs').PlannedProcess} PlannedProcess */

/**
 * What pnpm demo runs: pnpm build, which builds the server, the shell and every remote, then the
 * built server in role all, which serves the shell and the remotes itself; and the URL of the seed
 * plant's board, which it prints. The server listens on the PORT of env, which handoff and the
 * desktop preview set, and else on the PORT that the stack took.
 * @param {Readonly<Record<string, string | undefined>>} stackEnv The stack's environment.
 * @param {Readonly<Record<string, string | undefined>>} env pnpm demo's own environment.
 */
export async function demoPlan(stackEnv, env) {
  const port = env.PORT || stackEnv.PORT || '';
  const origin = `http://127.0.0.1:${port}`;
  return {
    /** @type {PlannedProcess} */
    build: { name: 'build', command: 'pnpm', args: ['build'], env: {} },
    /** @type {PlannedProcess} */
    server: {
      name: 'server',
      command: 'node',
      args: ['apps/backend/dist/main.js'],
      env: { NORTHMES_ROLE: 'all', PORT: port, NORTHMES_PUBLIC_ORIGIN: origin },
    },
    boardUrl: await boardUrl(origin),
  };
}

/**
 * Runs pnpm demo until SIGINT, SIGTERM, SIGHUP or the server's exit: starts the stack, builds
 * every package with pnpm build, starts the built server and prints the board URL once it listens.
 * Stopping ends the server and the stack's container.
 */
async function demo() {
  /** @param {string} line */
  const log = (line) => say('demo', line);
  const stack = await startStack({ log });
  /** @type {import('./processes.mjs').StartedProcess | undefined} */
  let server;
  let stopping = false;
  /** @param {number} code */
  const stop = async (code) => {
    if (stopping) return;
    stopping = true;
    log('Stopping the server and the stack');
    await server?.stop();
    await stack.stop();
    process.exit(code);
  };
  onStopSignal(() => stop(0));

  try {
    const plan = await demoPlan(stack.env, process.env);
    // The build runs without the stack's environment: its NODE_ENV=development would make Vite
    // build React for development.
    log('Building the server, the shell and every remote: pnpm build');
    await run(plan.build);
    log(`Starting the built server in role all on PORT ${plan.server.env.PORT}`);
    server = start(plan.server, {
      env: stack.env,
      onLine: (line) => {
        if (line.includes('Listening on')) log(`The board of the seeded plant: ${plan.boardUrl}`);
      },
    });
    const { code } = await server.exited;
    if (!stopping) {
      log(`The server exited with ${code}`);
      await stop(code === 0 ? 0 : 1);
    }
  } catch (error) {
    log(messageOf(error));
    await stop(1);
  }
}

if (import.meta.main) await demo();
