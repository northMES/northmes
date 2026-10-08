// SPDX-License-Identifier: MIT

/**
 * The command that starts the test Postgres server. The test server trades durability for speed:
 * fsync, synchronous_commit and full_page_writes are off, which is safe because the data lives on
 * tmpfs and goes with the container. max_connections is 300, so test files that run in parallel
 * and open many pools do not run out of connections. NM_TEST_PG_TZ sets the server time zone, so
 * the time zone legs can run the same suite against another zone; unset, empty or blank, the zone
 * is UTC (Postgres refuses to boot with an empty one). The settings follow as -c flags of their
 * own, such as the log settings of a test that reads the server log.
 */
export function serverArgs(
  env: NodeJS.ProcessEnv,
  settings: Readonly<Record<string, string>> = {},
): string[] {
  return [
    'postgres',
    '-c',
    `timezone=${env.NM_TEST_PG_TZ?.trim() || 'UTC'}`,
    '-c',
    'fsync=off',
    '-c',
    'synchronous_commit=off',
    '-c',
    'full_page_writes=off',
    '-c',
    'max_connections=300',
    ...Object.entries(settings).flatMap(([name, value]) => ['-c', `${name}=${value}`]),
  ];
}
