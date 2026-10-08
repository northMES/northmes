// SPDX-License-Identifier: AGPL-3.0-or-later
import { Logger } from '@nestjs/common';
import { Pool } from 'pg';

/** The login of the server's pool (ADR 0006): DML rights only, no BYPASSRLS, owns nothing. */
const appRole = 'nm_app';

const logger = new Logger('Database');

/**
 * The one pool of the server. It logs in to DATABASE_URL, which carries no login (ADR 0060), as
 * nm_app with the password from nm_app's secret file. pg reads the login from the URL ahead of
 * the user and password options, so they go into the URL.
 *
 * When Postgres ends an idle connection (a restart, pg_terminate_backend or idle_session_timeout),
 * pg-pool drops the client and emits error on the pool; without a listener that error would end
 * the process. The listener logs only the error's code and message, because pg-pool puts the
 * client, with its connection settings and password, on the error.
 */
export function appPool(databaseUrl: string, password: string): Pool {
  const url = new URL(databaseUrl);
  url.username = appRole;
  url.password = password;
  const pool = new Pool({ connectionString: url.href });
  pool.on('error', (error: Error & { code?: string }) => {
    logger.warn(
      `The nm_app pool dropped an idle connection after error ${error.code ?? 'without a code'}: ${error.message}`,
    );
  });
  return pool;
}
