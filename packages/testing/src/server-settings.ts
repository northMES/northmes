// SPDX-License-Identifier: MIT

/**
 * The command that starts the test Postgres server. The server time zone is set here so the time
 * zone legs can run the same suite against another zone.
 */
export function serverArgs(_env: NodeJS.ProcessEnv): string[] {
  return ['postgres', '-c', 'timezone=UTC'];
}
