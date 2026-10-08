// SPDX-License-Identifier: MIT
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { query } from '../src/client.ts';
import { type PostgresServer, startPostgres } from '../src/postgres-server.ts';

// The run's server keeps the default log settings, so this file starts a server of its own with
// statement logging on. The server is the file's own, so the test logs in as its superuser.
let server: PostgresServer;

beforeAll(async () => {
  server = await startPostgres({ settings: { log_statement: 'all' } });
}, 120_000);

afterAll(async () => {
  await server?.stop();
});

describe('startPostgres', () => {
  it('E02-S02 startPostgres starts a server with the settings it is given, and logs() returns what it logged', async () => {
    const { user, password, host, port, database } = server.connection;
    const credentials = `${encodeURIComponent(user)}:${encodeURIComponent(password)}`;
    const url = `postgres://${credentials}@${host}:${port}/${encodeURIComponent(database)}`;
    const probe = `nm_log_probe_${randomBytes(4).toString('hex')}`;

    const rows = await query(
      url,
      `select '${probe}' as probe, current_setting('log_statement') as log_statement`,
    );

    expect(rows).toEqual([{ probe, log_statement: 'all' }]);
    // The server's output reaches the container's log stream with a delay.
    await vi.waitFor(
      async () => {
        expect(await server.logs()).toContain(`statement: select '${probe}'`);
      },
      { timeout: 5_000 },
    );
  });
});
