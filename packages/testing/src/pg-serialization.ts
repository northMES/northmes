// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import pg from 'pg';

/** What a pg client or pool shows of itself when Vitest serializes it. */
export interface SerializedPgConnection {
  host: string | undefined;
  port: number | undefined;
  database: string | undefined;
  user: string | undefined;
}

/** Where a pool connects and as whom, from its options, without the password. */
function poolConnection(options: pg.PoolConfig): SerializedPgConnection {
  if (options.connectionString) {
    try {
      const url = new URL(options.connectionString);
      return {
        host: decodeURIComponent(url.hostname) || undefined,
        port: url.port ? Number(url.port) : undefined,
        database: decodeURIComponent(url.pathname.slice(1)) || undefined,
        user: decodeURIComponent(url.username) || undefined,
      };
    } catch {
      // A connection string that is no URL, such as a socket path, shows nothing.
      return { host: undefined, port: undefined, database: undefined, user: undefined };
    }
  }
  return { host: options.host, port: options.port, database: options.database, user: options.user };
}

/**
 * Gives pg's Client and Pool a toJSON that shows where they connect and as whom, and no password.
 *
 * pg-pool puts the client on the error it emits when Postgres ends an idle connection. Vitest
 * serializes an error before it prints it, and it walks Object.getOwnPropertyNames, which also
 * lists the password that pg hides from JSON.stringify and util.inspect as a non-enumerable
 * property. A pool keeps its connection string, password included, in its options. Vitest calls
 * toJSON first where an object has one, so the settings and the password stay out of the report.
 * This covers the pg that @northmes/testing resolves, the one the tests and the server import;
 * pg-boss brings its own copy.
 */
export function serializePgConnectionsWithoutSecrets(): void {
  Object.defineProperty(pg.Client.prototype, 'toJSON', {
    configurable: true,
    writable: true,
    value(this: pg.Client): SerializedPgConnection {
      return { host: this.host, port: this.port, database: this.database, user: this.user };
    },
  });
  Object.defineProperty(pg.Pool.prototype, 'toJSON', {
    configurable: true,
    writable: true,
    value(this: pg.Pool & { options: pg.PoolConfig }): SerializedPgConnection {
      return poolConnection(this.options);
    },
  });
}
