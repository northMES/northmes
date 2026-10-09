// SPDX-License-Identifier: AGPL-3.0-or-later

import { HttpStatus } from '@nestjs/common';
import { releaseProductionOrder } from '@northmes/planning-contracts';
import { defineCommand } from '@northmes/sdk/commands';
import { DomainError } from '@northmes/sdk/errors';
import type { Selectable, Transaction } from 'kysely';
import { type ProductionOrderRecord, recordColumns } from '../api/production-order.service.ts';
import type { PlanningDatabase, ProductionOrderTable } from '../db.ts';
import { ProductionOrder } from '../production-order.resolver.ts';
import { releasePayload } from './release-payload.ts';

/**
 * What the command bus hands the command (ADR 0012): the transaction it opened for this run of the
 * command, here with planning's table types, and the order it loaded and locked.
 */
interface ReleaseContext {
  readonly tx: Transaction<PlanningDatabase>;
  readonly target: Selectable<ProductionOrderTable>;
}

/**
 * planning.releaseProductionOrder, whose mutation planningReleaseProductionOrder the SDK generates
 * from the contract. It returns the released order with its new version.
 */
export const ReleaseProductionOrder = defineCommand(releaseProductionOrder, {
  returns: () => ProductionOrder,
  // The bus reads the order and locks its row until the command's transaction ends, so the version
  // check, the validators and the handler see the same order and a second release waits for the
  // first. An order outside the principal's scopes is not found, like one that does not exist.
  target: {
    entity: 'Production order',
    load: (id, { tx }: Pick<ReleaseContext, 'tx'>) =>
      tx
        .selectFrom('planning.production_order')
        .selectAll()
        .where('id', '=', id)
        .forUpdate()
        .executeTakeFirst(),
  },
  async buildPayload(_input, { target }: ReleaseContext) {
    return releasePayload(target);
  },
  async handle({ id }, { tx, target: order }: ReleaseContext): Promise<ProductionOrderRecord> {
    if (order.status !== 'planned') {
      throw new DomainError({
        code: 'planning.production_order.not_planned',
        status: HttpStatus.PRECONDITION_FAILED,
        message: `Production order ${order.number} is ${order.status}, and only a planned order can be released`,
      });
    }
    // The version trigger of planning.production_order bumps version with the update.
    return tx
      .updateTable('planning.production_order')
      .set({ status: 'released' })
      .where('id', '=', id)
      .returning(recordColumns)
      .executeTakeFirstOrThrow();
  },
});
