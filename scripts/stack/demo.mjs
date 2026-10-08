// pnpm demo, which handoff-demo in .claude/launch.json runs (ADR 0058): the stack script's shared
// steps, then the production build of role all on PORT with the fictional seed, so a demo has one
// origin and one port.

import { boardUrl } from './board.mjs';

/** @typedef {import('./dev.mjs').DevProcess} DevProcess */

/**
 * What pnpm demo runs: pnpm build, which builds the server, the shell and every remote, then the
 * built server in role all, which serves the shell and the remotes itself; and the URL of the seed
 * plant's board, which it prints. The server listens on the PORT of env, which handoff and the
 * desktop preview set.
 * @param {Readonly<Record<string, string | undefined>>} stackEnv The stack's environment.
 * @param {Readonly<Record<string, string | undefined>>} env pnpm demo's own environment.
 */
export async function demoPlan(stackEnv, env) {
  const port = env.PORT ?? '';
  const origin = `http://127.0.0.1:${port}`;
  return {
    /** @type {DevProcess} */
    build: { name: 'build', command: 'pnpm', args: ['build'], env: {} },
    /** @type {DevProcess} */
    server: {
      name: 'server',
      command: 'node',
      args: ['apps/server/dist/main.js'],
      env: { NORTHMES_ROLE: 'all', PORT: port, NORTHMES_PUBLIC_ORIGIN: origin },
    },
    boardUrl: await boardUrl(origin),
  };
}
