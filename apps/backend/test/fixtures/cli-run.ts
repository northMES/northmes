// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { vi } from 'vitest';
import { cli } from '../../src/cli.ts';
import { serverEnvKeys } from './server-env.ts';

/** What one pnpm northmes command did: its exit code, its standard output and its log lines. */
export interface CliRun {
  /** The code it exited with, 0 when it returned without calling exit. */
  readonly code: number;
  /** What it printed on standard output. */
  readonly out: string;
  /** Every line it wrote to the log, info and error alike. */
  readonly log: readonly string[];
}

/**
 * Runs pnpm northmes with these arguments in this environment, as main.ts does, and records what
 * it did. ConfigModule writes the validated environment into process.env, so the server's keys are
 * stubbed away first.
 */
export async function runCli(
  args: readonly string[],
  env: Readonly<Record<string, string>>,
): Promise<CliRun> {
  for (const key of serverEnvKeys) vi.stubEnv(key, undefined);
  const lines: string[] = [];
  const printed: string[] = [];
  let code = 0;
  let exited = false;
  await cli(args, {
    env,
    exit: (exitCode) => {
      if (exited) return;
      exited = true;
      code = exitCode;
    },
    log: { info: (line) => lines.push(line), error: (line) => lines.push(line) },
    print: (text) => printed.push(text),
  });
  return { code, out: printed.join(''), log: lines };
}
