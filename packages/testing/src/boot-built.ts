// SPDX-License-Identifier: MIT
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
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

// A waiting test file gives up before the 120 s timeout of the built-server tests, so a build that
// never wrote its outcome fails with this module's error instead of a Vitest timeout.
const outcomeWaitMs = 100_000;

export interface BootBuiltOptions {
  /** The whole environment of the server. Nothing is inherited from the test process. */
  readonly env: Readonly<Record<string, string>>;
}

export interface BootBuiltResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

interface BuildOutcome {
  status: number | null;
  output: string;
}

/**
 * Builds apps/server and the workspace packages it depends on, once per test run. The first test
 * file to ask creates a lock directory in the run directory and builds; the others wait up to
 * outcomeWaitMs for the outcome it writes there.
 */
async function buildServerOnce(runDir: string): Promise<void> {
  const lock = join(runDir, 'server-build');
  const outcomeFile = join(lock, 'outcome.json');
  if (tryMkdir(lock)) {
    const build = spawnSync('pnpm', buildArgs, { cwd: root, encoding: 'utf8' });
    const outcome: BuildOutcome = {
      status: build.status,
      output: build.error?.message ?? `${build.stdout}${build.stderr}`,
    };
    // A rename is atomic, so a waiting file never reads half an outcome.
    writeFileSync(`${outcomeFile}.tmp`, JSON.stringify(outcome));
    renameSync(`${outcomeFile}.tmp`, outcomeFile);
  }
  const deadline = Date.now() + outcomeWaitMs;
  while (!existsSync(outcomeFile)) {
    if (Date.now() >= deadline) {
      throw new Error(
        `no outcome of pnpm ${buildArgs.join(' ')} in ${lock} after ${outcomeWaitMs / 1000} s; the test file that started the build may have crashed`,
      );
    }
    await sleep(100);
  }
  const outcome = JSON.parse(readFileSync(outcomeFile, 'utf8')) as BuildOutcome;
  if (outcome.status !== 0) {
    throw new Error(`pnpm ${buildArgs.join(' ')} failed:\n${outcome.output}`);
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
 * Starts the built server, apps/server/dist/main.js, with env and resolves with its exit code and
 * output once it exits. The server is built once per test run.
 */
export async function bootBuilt({ env }: BootBuiltOptions): Promise<BootBuiltResult> {
  const runDir: string | undefined = inject('runDir');
  if (!runDir) {
    throw new Error(
      'bootBuilt() needs the global setup of @northmes/testing, which only the integration project runs. Name the file *.int.test.ts.',
    );
  }
  await buildServerOnce(runDir);
  const server = spawn(process.execPath, [serverMain], { cwd: root, env });
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
