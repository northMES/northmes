// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { processError } from 'vitest/internal/browser';
import { query, useTestDatabase } from '../src/index.ts';

describe('a pg client in an error that Vitest reports', () => {
  const db = useTestDatabase();

  it("the error that pg-pool emits when Postgres ends an idle connection shows the client's login and database, not its password", async () => {
    const password = decodeURIComponent(new URL(db.appUrl).password);
    const pool = new Pool({ connectionString: db.appUrl });
    const idleErrors: Error[] = [];
    pool.on('error', (error) => idleErrors.push(error));
    try {
      const idle = await pool.connect();
      const { rows } = await idle.query<{ pid: number }>('select pg_backend_pid() as pid');
      idle.release();
      await query(db.appUrl, `select pg_terminate_backend(${Number(rows[0]?.pid)})`);
      await expect.poll(() => idleErrors.length).toBe(1);

      // processError is what Vitest runs on a failed test's error and on an unhandled error before
      // it prints them.
      const reported = JSON.stringify(processError(idleErrors[0]));

      expect(idleErrors[0]).toHaveProperty('client');
      expect(reported).toContain('"user":"nm_app"');
      expect(reported).toContain(`"database":"${db.databaseName}"`);
      // A boolean, so a failure does not print the password either.
      expect(reported.includes(password)).toBe(false);
    } finally {
      await pool.end();
    }
  });
});
