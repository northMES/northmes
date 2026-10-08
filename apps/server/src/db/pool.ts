// SPDX-License-Identifier: AGPL-3.0-or-later
import { Pool } from 'pg';

/** The login of the server's pool (ADR 0006): DML rights only, no BYPASSRLS, owns nothing. */
const appRole = 'nm_app';

/**
 * The one pool of the server. It logs in to DATABASE_URL, which carries no login (ADR 0060), as
 * nm_app with the password from nm_app's secret file. pg reads the login from the URL ahead of
 * the user and password options, so they go into the URL.
 */
export function appPool(databaseUrl: string, password: string): Pool {
  const url = new URL(databaseUrl);
  url.username = appRole;
  url.password = password;
  return new Pool({ connectionString: url.href });
}
