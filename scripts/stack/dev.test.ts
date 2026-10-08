import { describe, expect, it } from 'vitest';
import { devPlan, webRemotes } from './dev.mjs';

// The ports the stack hands pnpm dev: the server's PORT and one port each for the shell and the
// planning remote, which freePorts takes apart from the server's.
const ports = { server: 41_001, shell: 41_002, remotes: { planning: 41_003 } };

describe('devPlan', () => {
  it("E02-S08 pnpm dev starts tsc -b --watch, the shell dev server and one dev server per remote on the stack's ports", async () => {
    const plan = await devPlan(ports);
    const [shell, ...remotes] = plan.web;

    // tsc -b rebuilds the server and the workspace packages it runs from their dist/.
    expect(plan.watch.command).toBe('pnpm');
    expect(plan.watch.args.slice(0, 5)).toEqual([
      'exec',
      'tsc',
      '-b',
      '--watch',
      '--preserveWatchOutput',
    ]);
    expect(plan.watch.args.slice(5).sort()).toEqual([
      'apps/server/tsconfig.build.json',
      'modules/core/tsconfig.build.json',
      'modules/planning/contracts/tsconfig.build.json',
      'modules/planning/tsconfig.build.json',
      'packages/contracts/tsconfig.build.json',
      'packages/sdk/tsconfig.build.json',
    ]);
    // The server is the built all process on the stack's PORT. A browser opens the shell, so the
    // shell's origin is the public one.
    expect(plan.server).toEqual({
      name: 'server',
      command: 'node',
      args: ['apps/server/dist/main.js'],
      env: {
        NORTHMES_ROLE: 'all',
        PORT: '41001',
        NORTHMES_PUBLIC_ORIGIN: 'http://127.0.0.1:41002',
      },
    });
    expect(webRemotes()).toEqual(['planning']);
    expect(shell).toMatchObject({
      name: 'shell',
      command: 'pnpm',
      args: [
        '-C',
        'apps/web',
        'exec',
        'vite',
        '--host',
        '127.0.0.1',
        '--port',
        '41002',
        '--strictPort',
      ],
    });
    expect(remotes).toEqual([
      {
        name: 'planning',
        command: 'pnpm',
        args: [
          '-C',
          'modules/planning/web',
          'exec',
          'vite',
          '--host',
          '127.0.0.1',
          '--port',
          '41003',
          '--strictPort',
        ],
        env: {},
      },
    ]);
    // The shell's dev server sends each remote's files to the remote's dev server and every other
    // server path to the server, in this order, so the browser sees one origin.
    expect(Object.entries(JSON.parse(shell?.env.NORTHMES_DEV_PROXY ?? '{}'))).toEqual([
      ['/modules/planning/', 'http://127.0.0.1:41003'],
      ['/api', 'http://127.0.0.1:41001'],
      ['/graphql', 'http://127.0.0.1:41001'],
      ['/health', 'http://127.0.0.1:41001'],
      ['/modules', 'http://127.0.0.1:41001'],
    ]);
  });
});
