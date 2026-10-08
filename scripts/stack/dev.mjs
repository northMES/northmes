// pnpm dev (ADR 0058): the stack script's shared steps, then the server rebuilt by tsc -b --watch
// and the web's Vite dev server, each on a port of its own.

import { existsSync, globSync, readFileSync, realpathSync, watch } from 'node:fs';
import { join, relative } from 'node:path';
import { boardUrl } from './board.mjs';
import { freePorts } from './ports.mjs';
import { messageOf, onStopSignal, repositoryRoot, run, say, start } from './processes.mjs';
import { startStack } from './stack.mjs';

/** @typedef {import('./processes.mjs').PlannedProcess} PlannedProcess */

/**
 * @typedef {object} DevPorts
 * @property {number} server The stack's PORT, which the server listens on.
 * @property {number} web The port of the web's dev server, which the browser opens.
 */

/**
 * What pnpm dev starts on ports: tsc -b --watch over the server's projects, the built server, which
 * pnpm dev starts after each completed build, and the web's Vite dev server, which forwards the API
 * paths to the server; northmes migrate, which it runs when a file in one of the migrations folders
 * changes; and the URL of the seed plant's board on the web's origin, which it prints.
 * @param {DevPorts} ports
 */
export async function devPlan({ server, web }) {
  const serverOrigin = loopbackOrigin(server);
  return {
    /** @type {PlannedProcess} */
    watch: {
      name: 'tsc',
      command: 'pnpm',
      args: [
        'exec',
        'tsc',
        '-b',
        '--watch',
        '--preserveWatchOutput',
        ...inServerPackages('tsconfig.build.json'),
      ],
      env: {},
    },
    /** @type {PlannedProcess} */
    server: {
      name: 'server',
      command: 'node',
      args: ['apps/backend/dist/main.js'],
      env: {
        NORTHMES_ROLE: 'all',
        PORT: String(server),
        NORTHMES_PUBLIC_ORIGIN: loopbackOrigin(web),
      },
    },
    /** @type {PlannedProcess} */
    web: viteDevServer('web', 'apps/web', web, { NORTHMES_API_ORIGIN: serverOrigin }),
    // The built server runs migrate. pnpm northmes would build the server through turbo first,
    // over the files that tsc -b --watch writes.
    /** @type {PlannedProcess} */
    migrate: {
      name: 'migrate',
      command: 'node',
      args: ['apps/backend/dist/main.js', 'migrate'],
      env: {},
    },
    // Each in-repo module keeps its migrations in apps/backend/src/modules/<id>/migrations.
    migrations: globSync('apps/backend/src/modules/*/migrations', { cwd: repositoryRoot }).sort(),
    boardUrl: await boardUrl(loopbackOrigin(web)),
  };
}

/**
 * Whether a line of tsc -b --watch ends a build without errors. pnpm dev restarts the server after
 * such a build, and keeps the server that runs after a build with errors.
 * @param {string} line
 */
export function completedBuild(line) {
  return / - Found 0 errors\. Watching for file changes\.$/.test(line);
}

/** @typedef {Awaited<ReturnType<typeof devPlan>>} DevPlan */
/** @typedef {import('./processes.mjs').StartedProcess} StartedProcess */

/**
 * @typedef {object} DevSupervisor
 * @property {Promise<void>} failed Resolves once pnpm dev cannot go on: the web's dev server or
 *   tsc -b --watch exited on its own.
 * @property {() => Promise<void>} stop Stops every process that pnpm dev started, then the stack.
 */

/**
 * Runs the processes of plan on a started stack: starts the web's dev server and tsc -b --watch, restarts the server after each completed build, runs northmes
 * migrate and then restarts the server when a migration file changes, and prints the board URL
 * once the server listens. A migrate that fails leaves the server running.
 * @param {{
 *   plan: DevPlan,
 *   stack: { env: Readonly<Record<string, string>>, stop: () => Promise<void> },
 *   start: typeof import('./processes.mjs').start,
 *   run: typeof import('./processes.mjs').run,
 *   watch: (dir: string, changed: () => void) => void,
 *   log: (line: string) => void,
 * }} options start and run start a process and run one to its end, as processes.mjs does. watch
 *   calls changed after each change below dir, a folder relative to the repository root. log
 *   prints a line of pnpm dev itself.
 * @returns {DevSupervisor}
 */
export function superviseDev({ plan, stack, start, run, watch, log }) {
  /** @type {StartedProcess[]} */
  const needed = [];
  /** @type {StartedProcess | undefined} */
  let server;
  let stopping = false;
  /** @type {() => void} */
  let fail = () => {};
  /** @type {Promise<void>} */
  const failed = new Promise((resolve) => {
    fail = resolve;
  });
  /** @param {string} reason */
  const failWith = (reason) => {
    if (stopping) return;
    log(reason);
    fail();
  };
  /**
   * Starts a process that pnpm dev cannot go on without.
   * @param {PlannedProcess} planned
   * @param {Parameters<typeof start>[1]} [options]
   */
  const startNeeded = (planned, options) => {
    const started = start(planned, options);
    needed.push(started);
    started.exited.then(({ code }) =>
      failWith(`${planned.name} exited with ${code}, so pnpm dev stops`),
    );
  };

  let listened = false;
  // Restarts and migrate runs go one after the other, in the order they were asked for.
  let queue = Promise.resolve();
  // The servers pnpm dev stopped on purpose, whose exit it does not report.
  const retired = new WeakSet();
  const restartServer = () => {
    queue = queue.then(async () => {
      if (server) {
        retired.add(server);
        await server.stop();
      }
      if (stopping) return;
      const started = start(plan.server, {
        env: stack.env,
        onLine: (line) => {
          if (listened || !line.includes('Listening on')) return;
          listened = true;
          log(`The board of the seeded plant: ${plan.boardUrl}`);
          log('Ctrl+C stops pnpm dev and its Postgres container.');
        },
      });
      server = started;
      // A server that exits on its own, such as after a crash, leaves the web without its API.
      // The next completed build starts it again, so pnpm dev says so and runs on.
      started.exited.then(({ code, signal }) => {
        if (stopping || retired.has(started)) return;
        log(
          `The server exited with ${code ?? signal}; the next build that tsc -b --watch completes starts it again`,
        );
      });
    });
  };
  const migrate = () => {
    queue = queue.then(async () => {
      if (stopping) return;
      log('A migration file changed: northmes migrate');
      try {
        await run(plan.migrate, { env: stack.env });
      } catch (error) {
        log(`${messageOf(error)}; the server runs on`);
        return;
      }
      restartServer();
    });
  };
  /** @type {NodeJS.Timeout | undefined} */
  let pending;

  const begin = async () => {
    startNeeded(plan.web);
    log('Building the server with tsc -b --watch; the server starts after each completed build');
    startNeeded(plan.watch, {
      onLine: (line) => {
        if (completedBuild(line)) restartServer();
      },
    });
    for (const dir of plan.migrations) {
      // An editor writes a file in several steps, so one change runs migrate once.
      watch(dir, () => {
        clearTimeout(pending);
        pending = setTimeout(migrate, 300);
      });
    }
  };
  begin().catch((error) => failWith(messageOf(error)));

  return {
    failed,
    stop: async () => {
      stopping = true;
      clearTimeout(pending);
      await Promise.all([...needed, server].map((started) => started?.stop()));
      await stack.stop();
    },
  };
}

/**
 * The Vite dev server of the package in dir on port.
 * @param {string} name
 * @param {string} dir
 * @param {number} port
 * @param {Record<string, string>} [env]
 * @returns {PlannedProcess}
 */
function viteDevServer(name, dir, port, env = {}) {
  return {
    name,
    command: 'pnpm',
    args: [
      '-C',
      dir,
      'exec',
      'vite',
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ],
    env,
  };
}

/** @param {number} port */
function loopbackOrigin(port) {
  return `http://127.0.0.1:${port}`;
}

/**
 * The folder of apps/backend and of every workspace package it depends on, which the built server
 * loads from their dist/, relative to the repository root and each package before the packages
 * that depend on it.
 * @returns {string[]}
 */
function serverPackages() {
  /** @type {string[]} */
  const dirs = [];
  const visited = new Set();
  /** @param {string} dir */
  const visit = (dir) => {
    if (visited.has(dir)) return;
    visited.add(dir);
    const { dependencies = {} } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    for (const [name, range] of Object.entries(dependencies)) {
      if (String(range).startsWith('workspace:')) {
        visit(realpathSync(join(dir, 'node_modules', name)));
      }
    }
    dirs.push(relative(repositoryRoot, dir));
  };
  visit(join(repositoryRoot, 'apps/backend'));
  return dirs;
}

/**
 * The paths below the server's packages that exist, such as each package's tsconfig.build.json.
 * @param {string} path
 */
function inServerPackages(path) {
  return serverPackages()
    .map((dir) => join(dir, path))
    .filter((file) => existsSync(join(repositoryRoot, file)));
}

/**
 * Runs pnpm dev until SIGINT, SIGTERM or SIGHUP: starts the stack, takes a port for the web's
 * dev server, and runs the processes of devPlan with superviseDev.
 * Stopping ends every process and the stack's container.
 */
async function dev() {
  /** @param {string} line */
  const log = (line) => say('dev', line);
  const stack = await startStack({ log });
  /** @type {DevSupervisor | undefined} */
  let supervisor;
  let stopping = false;
  /** @param {number} code */
  const stop = async (code) => {
    if (stopping) return;
    stopping = true;
    log('Stopping the processes and the stack');
    await (supervisor ?? stack).stop();
    process.exit(code);
  };
  onStopSignal(() => stop(0));

  try {
    const serverPort = Number(stack.env.PORT);
    const [web = 0] = await freePorts(1, { except: [serverPort] });
    const plan = await devPlan({ server: serverPort, web });
    if (stopping) return;
    supervisor = superviseDev({
      plan,
      stack,
      start,
      run,
      watch: (dir, changed) => {
        watch(join(repositoryRoot, dir), { recursive: true }, changed);
      },
      log,
    });
    supervisor.failed.then(() => stop(1));
  } catch (error) {
    log(messageOf(error));
    await stop(1);
  }
}

if (import.meta.main) await dev();
