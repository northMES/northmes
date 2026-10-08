// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Transaction } from 'kysely';
import type { CoreDatabase } from '../db.ts';

/**
 * What the command bus hands a core command (ADR 0012): the transaction it opened for this run of
 * the command, here with core's table types, the plant of the principal, and the target the bus
 * loaded for a command on an existing entity.
 */
export interface CoreContext<Target = undefined> {
  readonly tx: Transaction<CoreDatabase>;
  readonly plantId: string | undefined;
  readonly target: Target;
}
