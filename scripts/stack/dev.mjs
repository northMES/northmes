// pnpm dev (ADR 0058): the stack script's shared steps, then the server rebuilt by tsc -b --watch,
// the shell's Vite dev server and one Vite dev server per remote, each on a port of its own.

import { existsSync, globSync, readFileSync, realpathSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardUrl } from './board.mjs';

const repositoryRoot = realpathSync(fileURLToPath(new URL('../..', import.meta.url)));

/**
 * @typedef {object} DevProcess A process that pnpm dev starts from the repository root.
 * @property {string} name The name its output lines carry.
 * @property {string} command
 * @property {string[]} args
 * @property {Record<string, string>} env What the process gets on top of the stack's environment.
 */

/**
 * @typedef {object} DevPorts
 * @property {number} server The stack's PORT, which the server listens on.
 * @property {number} shell The port of the shell's dev server, which the browser opens.
 * @property {Readonly<Record<string, number>>} remotes The port of each remote's dev server, by
 *   module id.
 */

/** The ids of the modules with a web remote, each a modules/<id>/web package (ADR 0019). */
export function webRemotes() {
  return globSync('modules/*/web/package.json', { cwd: repositoryRoot })
    .map((path) => path.split('/')[1] ?? '')
    .sort();
}

/**
 * What pnpm dev starts on ports: tsc -b --watch over the server's projects, the built server, which
 * pnpm dev starts after each completed build, and the Vite dev servers of the shell and of each
 * remote; northmes migrate, which it runs when a file in one of the migrations folders changes; and
 * the URL of the seed plant's board on the shell's origin, which it prints.
 * @param {DevPorts} ports
 */
export async function devPlan({ server, shell, remotes }) {
  const serverOrigin = loopbackOrigin(server);
  const remoteOrigins = Object.entries(remotes).map(([id, port]) => [
    `/modules/${id}/`,
    loopbackOrigin(port),
  ]);
  // The shell's dev server forwards these paths in this order, so a remote's files come from its
  // dev server and every other server path from the server.
  const proxy = Object.fromEntries([
    ...remoteOrigins,
    ...['/api', '/graphql', '/health', '/modules'].map((path) => [path, serverOrigin]),
  ]);
  return {
    /** @type {DevProcess} */
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
    /** @type {DevProcess} */
    server: {
      name: 'server',
      command: 'node',
      args: ['apps/server/dist/main.js'],
      env: {
        NORTHMES_ROLE: 'all',
        PORT: String(server),
        NORTHMES_PUBLIC_ORIGIN: loopbackOrigin(shell),
      },
    },
    /** @type {DevProcess[]} */
    web: [
      viteDevServer('shell', 'apps/web', shell, { NORTHMES_DEV_PROXY: JSON.stringify(proxy) }),
      ...Object.entries(remotes).map(([id, port]) => viteDevServer(id, `modules/${id}/web`, port)),
    ],
    // The built server runs migrate. pnpm northmes would build the server through turbo first,
    // over the files that tsc -b --watch writes.
    /** @type {DevProcess} */
    migrate: {
      name: 'migrate',
      command: 'node',
      args: ['apps/server/dist/main.js', 'migrate'],
      env: {},
    },
    migrations: inServerPackages('migrations'),
    boardUrl: await boardUrl(loopbackOrigin(shell)),
  };
}

/**
 * The Vite dev server of the package in dir on port.
 * @param {string} name
 * @param {string} dir
 * @param {number} port
 * @param {Record<string, string>} [env]
 * @returns {DevProcess}
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
 * The folder of apps/server and of every workspace package it depends on, which the built server
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
  visit(join(repositoryRoot, 'apps/server'));
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
