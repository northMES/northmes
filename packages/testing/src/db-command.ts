// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { Client } from 'pg';
import { withClient } from './client.ts';

/** Who runs a command: the principal type and id that the audit context records (ADR 0013). */
export interface CommandPrincipal {
  readonly type: 'user' | 'system' | 'station' | 'agent';
  readonly id: string;
}

/** What a fixture command runs with (ADR 0041). */
export interface CommandContext {
  readonly principal: CommandPrincipal;
  /** The scope ids the transaction sets as both its read and its write scopes (ADR 0008). */
  readonly scopes: readonly string[];
  /**
   * The scope ids the transaction sets as its write scopes, when they differ from its read scopes,
   * such as none for a viewer (ADR 0008). They default to the scopes.
   */
  readonly writeScopes?: readonly string[];
  /** The user the transaction acts for, northmes.user_id (ADR 0078). It defaults to none. */
  readonly userId?: string;
  readonly reason: string;
}

/** The connection that a command's function runs its statements on, inside the transaction. */
export type CommandTransaction = Pick<Client, 'query'>;

/**
 * Runs fn in one transaction as the role that appUrl logs in as, with northmes.read_scopes set to
 * the context's scopes, northmes.write_scopes to its write scopes and northmes.user_id to its user,
 * and commits it. When fn fails, the
 * connection closes with the transaction open, and Postgres rolls it back. The audit context does
 * not exist yet, so the principal and the reason are not recorded.
 */
export function runCommand<Result>(
  appUrl: string,
  { scopes, writeScopes = scopes, userId = '' }: CommandContext,
  fn: (tx: CommandTransaction) => Promise<Result>,
): Promise<Result> {
  return withClient({ connectionString: appUrl }, async (client) => {
    await client.query('begin');
    // set_config takes bind parameters, which SET LOCAL does not (ADR 0008). The cast refuses a
    // scope id that is not a uuid.
    await client.query(
      `select set_config('northmes.read_scopes', $1::uuid[]::text, true),
              set_config('northmes.write_scopes', $2::uuid[]::text, true),
              set_config('northmes.user_id', $3, true)`,
      [scopes, writeScopes, userId],
    );
    const result = await fn(client);
    await client.query('commit');
    return result;
  });
}
