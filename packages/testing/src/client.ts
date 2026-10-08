// SPDX-License-Identifier: MIT
import { Client, type ClientConfig } from 'pg';

/**
 * Runs `run` on a client connected with `config` and closes the client afterwards. This is the one
 * place that builds a pg client. The error listener keeps a connection that the server terminates
 * from surfacing as an unhandled error in the worker. It records the error, and when `run` fails
 * afterwards, the recorded error is thrown, because pg only reports that the client is not queryable.
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
    return await run(client);
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
