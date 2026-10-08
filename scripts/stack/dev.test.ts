import { planningLinks } from '@northmes/planning-contracts';
import { describe, expect, it, vi } from 'vitest';
import { completedBuild, devPlan, superviseDev, webRemotes } from './dev.mjs';
import type { run, start } from './processes.mjs';
import { seedScopes } from './seed.mjs';

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

  it('E02-S08 the printed board URL is planningLinks.board for the seeded plant', async () => {
    const plan = await devPlan(ports);

    // The seed plant's board on the shell's origin, which the browser opens.
    expect(plan.boardUrl).toBe(
      'http://127.0.0.1:41002/019a0000-0000-7000-8000-00000000a001/planning/board',
    );
    expect(new URL(plan.boardUrl).pathname).toBe(
      planningLinks.board({ plant: seedScopes.plant }).href,
    );
  });

  it('E02-S08 a changed migration file makes pnpm dev run northmes migrate on the built server', async () => {
    const plan = await devPlan(ports);

    // pnpm dev watches each module's migrations folder, and the stack's environment holds the
    // owner's password file that migrate reads.
    expect(plan.migrations).toEqual(['modules/core/migrations', 'modules/planning/migrations']);
    expect(plan.migrate).toEqual({
      name: 'migrate',
      command: 'node',
      args: ['apps/server/dist/main.js', 'migrate'],
      env: {},
    });
  });

  it('E02-S08 pnpm dev builds the workspace packages that the shell and the remotes import before their dev servers start', async () => {
    const plan = await devPlan(ports);

    // A remote resolves workspace packages to their dist/, and @module-federation/vite reads the
    // named exports of @northmes/web-sdk from its dist/. Turbo builds what each one depends on.
    expect(plan.build).toEqual({
      name: 'build',
      command: 'pnpm',
      args: [
        'exec',
        'turbo',
        'run',
        'build',
        '--filter=@northmes/web^...',
        '--filter=@northmes/planning-web^...',
        '--output-logs=errors-only',
      ],
      env: {},
    });
  });
});

describe('completedBuild', () => {
  it('E02-S08 pnpm dev restarts the server after each build that tsc -b --watch completes without errors', () => {
    // The lines tsc -b --watch --preserveWatchOutput prints, with the time in the locale's format.
    expect(completedBuild('6:29:00 PM - Found 0 errors. Watching for file changes.')).toBe(true);
    expect(completedBuild('18:29:00 - Found 0 errors. Watching for file changes.')).toBe(true);
    // A build with errors leaves the server that runs as it is.
    expect(completedBuild('6:29:00 PM - Found 1 error. Watching for file changes.')).toBe(false);
    expect(completedBuild('6:29:00 PM - Found 12 errors. Watching for file changes.')).toBe(false);
    expect(
      completedBuild('6:29:00 PM - File change detected. Starting incremental compilation...'),
    ).toBe(false);
  });
});

// The line tsc -b --watch prints after a build without errors.
const completed = '6:29:00 PM - Found 0 errors. Watching for file changes.';

/** Lets every promise that the fakes resolved run its callbacks. */
function settle() {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * The stack, the processes and the file watcher of pnpm dev as fakes. events lists what pnpm dev
 * did, in order: "start <name>" and "stop <name>" for a process, "run <name>" for a process it ran
 * to its end, and "stop stack". A process counts as stopped once its stop resolved.
 */
function fakeDev() {
  const events: string[] = [];
  const env = new Map<string, Readonly<Record<string, string>> | undefined>();
  const printers = new Map<string, (line: string) => void>();
  const watchers = new Map<string, () => void>();
  const stack = {
    env: { DATABASE_URL: 'postgres://127.0.0.1:41000/northmes', PORT: '41001' },
    stop: async () => {
      events.push('stop stack');
    },
  };
  const startFake: typeof start = (planned, options = {}) => {
    events.push(`start ${planned.name}`);
    env.set(planned.name, options.env);
    printers.set(planned.name, options.onLine ?? (() => {}));
    let exit: (code: number | null) => void = () => {};
    const exited = new Promise<{ code: number | null; signal: string | null }>((resolve) => {
      exit = (code) => resolve({ code, signal: code === null ? 'SIGTERM' : null });
    });
    return {
      name: planned.name,
      exited,
      stop: async () => {
        await Promise.resolve();
        events.push(`stop ${planned.name}`);
        exit(null);
      },
    };
  };
  const runFake: typeof run = async (planned, options = {}) => {
    events.push(`run ${planned.name}`);
    env.set(planned.name, options.env);
  };
  return {
    events,
    stack,
    /** The environment that pnpm dev gave the process with this name on top of its own. */
    envOf: (name: string) => env.get(name),
    /** Prints line as the process with this name. */
    print: (name: string, line: string) => printers.get(name)?.(line),
    /** The folders that pnpm dev watches. */
    watched: () => [...watchers.keys()],
    /** Changes a file in dir, a folder that pnpm dev watches. */
    change: (dir: string) => watchers.get(dir)?.(),
    options: {
      stack,
      start: startFake,
      run: runFake,
      watch: (dir: string, changed: () => void) => {
        watchers.set(dir, changed);
      },
    },
  };
}

describe('superviseDev', () => {
  it('E02-S08 each build that tsc -b --watch completes stops the old server and starts one new server', async () => {
    const dev = fakeDev();
    superviseDev({ plan: await devPlan(ports), ...dev.options });
    await settle();

    dev.print('tsc', completed);
    await settle();
    dev.print('tsc', completed);
    await settle();

    expect(dev.events.filter((event) => event.endsWith(' server'))).toEqual([
      'start server',
      'stop server',
      'start server',
    ]);
    // The server connects to the stack's database and listens on the stack's PORT.
    expect(dev.envOf('server')).toEqual(dev.stack.env);
  });

  it('E02-S08 a changed migration file makes pnpm dev run northmes migrate once and then restart the server', async () => {
    const dev = fakeDev();
    superviseDev({ plan: await devPlan(ports), ...dev.options });
    await settle();
    dev.print('tsc', completed);
    await settle();
    dev.events.length = 0;

    // An editor writes a file in several steps, and each step is a change.
    dev.change('modules/planning/migrations');
    dev.change('modules/planning/migrations');
    dev.change('modules/planning/migrations');
    await vi.waitFor(() => expect(dev.events).toContain('run migrate'));
    await settle();

    expect(dev.watched()).toEqual(['modules/core/migrations', 'modules/planning/migrations']);
    expect(dev.events).toEqual(['run migrate', 'stop server', 'start server']);
    // migrate reads the owner's password file that the stack's environment names.
    expect(dev.envOf('migrate')).toEqual(dev.stack.env);
  });
});
