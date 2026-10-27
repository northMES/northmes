// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
// Vitest exports processError from an internal entry point only. When an upgrade moves it, import
// the function that Vitest runs on an error before it prints it from its new place.
import { processError } from 'vitest/internal/browser';
import { query, useTestDatabase } from '../src/index.ts';

/** The error as Vitest reports it, as text. processError is what Vitest runs on a failed test's
 * error and on an unhandled error before it prints them. */
function reported(error: unknown): string {
  return JSON.stringify(processError(error));
}

describe('a pg client or pool in an error that Vitest reports', () => {
  const db = useTestDatabase();
  const password = decodeURIComponent(new URL(db.appUrl).password);

  it("ADR0076 the error that pg-pool emits when Postgres ends an idle connection shows the client's login and database, not its password", async () => {
    const pool = new Pool({ connectionString: db.appUrl });
    const idleErrors: Error[] = [];
    pool.on('error', (error) => idleErrors.push(error));
    try {
      const idle = await pool.connect();
      let pid: number | undefined;
      try {
        const { rows } = await idle.query<{ pid: number }>('select pg_backend_pid() as pid');
        pid = rows[0]?.pid;
      } finally {
        idle.release();
      }
      await query(db.appUrl, `select pg_terminate_backend(${Number(pid)})`);
      await expect.poll(() => idleErrors.length).toBe(1);
      const report = reported(idleErrors[0]);

      expect(idleErrors[0]).toHaveProperty('client');
      // Booleans, so a failure prints neither the report nor the password.
      expect(report.includes('"user":"nm_app"')).toBe(true);
      expect(report.includes(`"database":"${db.databaseName}"`)).toBe(true);
      expect(report.includes(password)).toBe(false);
    } finally {
      await pool.end();
    }
  });

  it("ADR0076 a pool on an error shows the pool's login and database, not the password in its connection string", async () => {
    const pool = new Pool({ connectionString: db.appUrl });
    pool.on('error', () => {});
    try {
      const report = reported(Object.assign(new Error('the pool failed'), { pool }));

      expect(report.includes('"user":"nm_app"')).toBe(true);
      expect(report.includes(`"database":"${db.databaseName}"`)).toBe(true);
      expect(report.includes(password)).toBe(false);
    } finally {
      await pool.end();
    }
  });
});
