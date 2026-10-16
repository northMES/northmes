// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import type { HandlerContext } from '@northmes/sdk/commands';
import type { Transaction } from 'kysely';
import type { CoreDatabase } from '../../infrastructure/database.ts';

/**
 * What the command bus hands a core command (ADR 0012): the transaction it opened for this run of
 * the command, here with core's table types, the plant of the principal, the target the bus
 * loaded for a command on an existing entity, and the permission check at a further scope.
 */
export interface CoreContext<Target = undefined> {
  readonly tx: Transaction<CoreDatabase>;
  readonly plantId: string | undefined;
  readonly target: Target;
  /** Throws core.forbidden unless the principal holds `permission` at `scopeId` (ADR 0073). */
  require(permission: string, scopeId: string): void;
  /** Writes an event to the event log in the command's transaction (ADR 0014). */
  readonly publish: HandlerContext['publish'];
}
