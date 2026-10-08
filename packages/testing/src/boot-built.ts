// SPDX-License-Identifier: MIT
import { spawn, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { inject } from 'vitest';

declare module 'vitest' {
  export interface ProvidedContext {
    /** A directory that exists for one test run, for state the test files of the run share. */
    runDir: string;
  }
}

const root = fileURLToPath(new URL('../../../', import.meta.url));

// The built server is started by path, so this MIT package imports nothing from apps/server.
const serverMain = join(root, 'apps/server/dist/main.js');
const buildArgs = ['--filter', '@northmes/server...', 'run', 'build'];

// The folder that pnpm plugin:build <id> installs a plugin into, as plugins/<id>/.
const pluginsDir = join(root, 'plugins');

// A waiting test file gives up before the 120 s timeout of the built-server tests, so a build that
// never wrote its outcome fails with this module's error instead of a Vitest timeout.
const outcomeWaitMs = 100_000;

/** The contents of northmes.config.json: the NorthMES version and the plugins to load. */
export interface NorthmesConfig {
  readonly northmes?: string;
  /** The folders of the plugins, as absolute paths. */
  readonly plugins: readonly string[];
}

export interface BootBuiltOptions {
  /** The whole environment of the server. Nothing is inherited from the test process. */
  readonly env: Readonly<Record<string, string>>;
  /**
   * The words of a pnpm northmes command, such as ['db', 'bootstrap'] or ['migrate']. Without them
   * the server serves.
   */
  readonly args?: readonly string[];
  /**
   * The northmes.config.json the server reads, written to a file of its own that NORTHMES_CONFIG
   * names. A listed plugin under plugins/ is built with pnpm plugin:build <id> once per test run.
   * Without it, the server reads northmes.config.json at the repository root.
   */
  readonly config?: NorthmesConfig;
}

export interface BootBuiltResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

interface Outcome {
  status: number | null;
  output: string;
}

/**
 * Runs pnpm with args at the repository root once per test run. The first test file to ask creates
 * the lock directory `name` in the run directory and runs it; the others wait up to outcomeWaitMs
 * for the outcome it writes there.
 */
async function runOnce(runDir: string, name: string, args: readonly string[]): Promise<void> {
  const lock = join(runDir, name);
  const outcomeFile = join(lock, 'outcome.json');
  if (tryMkdir(lock)) {
    const run = spawnSync('pnpm', args, { cwd: root, encoding: 'utf8' });
    const outcome: Outcome = {
      status: run.status,
      output: run.error?.message ?? `${run.stdout}${run.stderr}`,
    };
    // A rename is atomic, so a waiting file never reads half an outcome.
    writeFileSync(`${outcomeFile}.tmp`, JSON.stringify(outcome));
    renameSync(`${outcomeFile}.tmp`, outcomeFile);
  }
  const deadline = Date.now() + outcomeWaitMs;
  while (!existsSync(outcomeFile)) {
    if (Date.now() >= deadline) {
      throw new Error(
        `no outcome of pnpm ${args.join(' ')} in ${lock} after ${outcomeWaitMs / 1000} s; the test file that started it may have crashed`,
      );
    }
    await sleep(100);
  }
  const outcome = JSON.parse(readFileSync(outcomeFile, 'utf8')) as Outcome;
  if (outcome.status !== 0) {
    throw new Error(`pnpm ${args.join(' ')} failed:\n${outcome.output}`);
  }
}

/** Creates a directory and returns true, or returns false when another process created it. */
function tryMkdir(path: string): boolean {
  try {
    mkdirSync(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw error;
  }
}

/**
 * Builds apps/server and the workspace packages it depends on, then each plugin that the config
 * lists under plugins/, each once per test run. A plugin build imports the built SDK, so it runs
 * after the server build.
 */
async function buildOnce(runDir: string, config: NorthmesConfig | undefined): Promise<void> {
  await runOnce(runDir, 'server-build', buildArgs);
  for (const plugin of config?.plugins ?? []) {
    if (dirname(plugin) !== pluginsDir) continue;
    const id = basename(plugin);
    await runOnce(runDir, `plugin-build-${id}`, ['plugin:build', id]);
  }
}

/**
 * Starts the built server, apps/server/dist/main.js, with env, config and the command that args
 * name, and resolves with its exit code and output once it exits. The server and the plugins the
 * config lists under plugins/ are built once per test run.
 */
export async function bootBuilt({
  env,
  args = [],
  config,
}: BootBuiltOptions): Promise<BootBuiltResult> {
  const runDir: string | undefined = inject('runDir');
  if (!runDir) {
    throw new Error(
      'bootBuilt() needs the global setup of @northmes/testing, which only the integration project runs. Name the file *.int.test.ts.',
    );
  }
  await buildOnce(runDir, config);
  if (!config) return run([serverMain, ...args], env);
  const configDir = mkdtempSync(join(tmpdir(), 'northmes-config-'));
  try {
    const configFile = join(configDir, 'northmes.config.json');
    writeFileSync(configFile, JSON.stringify(config));
    return await run([serverMain, ...args], { ...env, NORTHMES_CONFIG: configFile });
  } finally {
    rmSync(configDir, { recursive: true, force: true });
  }
}

/** Runs node with args and env at the repository root, and resolves once the process exits. */
async function run(
  args: readonly string[],
  env: Readonly<Record<string, string>>,
): Promise<BootBuiltResult> {
  const server = spawn(process.execPath, args, { cwd: root, env });
  let stdout = '';
  let stderr = '';
  server.stdout.setEncoding('utf8').on('data', (chunk: string) => {
    stdout += chunk;
  });
  server.stderr.setEncoding('utf8').on('data', (chunk: string) => {
    stderr += chunk;
  });
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    server.on('error', reject);
    server.on('close', resolve);
  });
  return { exitCode, stdout, stderr };
}
