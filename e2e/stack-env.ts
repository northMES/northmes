// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
/** The variable that carries the stack's environment from globalSetup to the workers, as JSON. */
export const stackEnvKey = 'NORTHMES_E2E_STACK_ENV';

/** The stack's environment that globalSetup handed the workers. */
export function stackEnv(): Record<string, string> {
  const json = process.env[stackEnvKey];
  if (json === undefined) {
    throw new Error(
      `${stackEnvKey} is not set: run the specs through pnpm e2e, whose globalSetup starts the stack`,
    );
  }
  return JSON.parse(json) as Record<string, string>;
}
