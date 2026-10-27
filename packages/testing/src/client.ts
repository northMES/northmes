// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Client, type ClientConfig } from 'pg';

/**
 * Runs `run` on a client connected with `config` and closes the client afterwards. Tests and test
 * helpers that need a client of their own build it here. The error listener keeps a connection that
 * the server terminates from surfacing as an unhandled error in the worker. It records the error
 * and throws it in place of what `run` returns or throws, because pg then only reports that the
 * client is not queryable, and a `run` may catch that and return.
 */
export async function withClient<Result = void>(
  config: ClientConfig,
  run: (client: Client) => Promise<Result>,
): Promise<Result> {
  const client = new Client(config);
  let connectionError: Error | undefined;
  client.on('error', (error) => {
    connectionError ??= error;
  });
  await client.connect();
  try {
    const result = await run(client);
    if (connectionError) throw connectionError;
    return result;
  } catch (error) {
    throw connectionError ?? error;
  } finally {
    await client.end();
  }
}

/** Runs one statement on the database that `connectionString` points at and returns its rows. */
export function query<Row = Record<string, unknown>>(
  connectionString: string,
  sql: string,
): Promise<Row[]> {
  return withClient(
    { connectionString },
    async (client) => (await client.query(sql)).rows as Row[],
  );
}
