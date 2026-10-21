// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import pg from 'pg';

/** What a pg client shows of itself when Vitest serializes it. */
export interface SerializedPgClient {
  host: string | undefined;
  port: number | undefined;
  database: string | undefined;
  user: string | undefined;
}

/**
 * Gives pg's Client a toJSON that shows where the client connects and as whom, and no password.
 *
 * pg-pool puts the client on the error it emits when Postgres ends an idle connection. Vitest
 * serializes an error before it prints it, and it walks Object.getOwnPropertyNames, which also
 * lists the password that pg hides from JSON.stringify and util.inspect as a non-enumerable
 * property. Vitest calls toJSON first where an object has one, so the client's settings and
 * password stay out of the report. This covers the pg that @northmes/testing resolves, the one the
 * tests and the server import; pg-boss brings its own copy.
 */
export function serializePgClientsWithoutSecrets(): void {
  Object.defineProperty(pg.Client.prototype, 'toJSON', {
    configurable: true,
    writable: true,
    value(this: pg.Client): SerializedPgClient {
      return { host: this.host, port: this.port, database: this.database, user: this.user };
    },
  });
}
