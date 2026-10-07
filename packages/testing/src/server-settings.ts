// SPDX-License-Identifier: MIT

/**
 * The command that starts the test Postgres server. NM_TEST_PG_TZ sets the server time zone, so the
 * time zone legs can run the same suite against another zone; unset, empty or blank, the zone is UTC
 * (Postgres refuses to boot with an empty one).
 */
export function serverArgs(env: NodeJS.ProcessEnv): string[] {
  return ['postgres', '-c', `timezone=${env.NM_TEST_PG_TZ?.trim() || 'UTC'}`];
}
