// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { startStack } from '../scripts/stack/stack.mjs';
import { stackEnvKey } from './stack-env.ts';

/**
 * Runs the stack script once per run: Postgres from Testcontainers, the roles, the migrations and
 * the seed, into the database that each worker clones (e2e/fixtures.ts). The stack's environment
 * goes to the workers through process.env, which they inherit. The returned teardown stops the
 * container.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  const { env, stop } = await startStack({ log: (line) => console.log(`e2e: ${line}`) });
  process.env[stackEnvKey] = JSON.stringify(env);
  return stop;
}
