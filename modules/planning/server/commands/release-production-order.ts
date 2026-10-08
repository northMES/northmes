// SPDX-License-Identifier: AGPL-3.0-or-later
import { releaseProductionOrder } from '@northmes/planning-contracts';
import { defineCommand } from '@northmes/sdk/commands';
import { DomainError } from '@northmes/sdk/errors';
import type { Selectable, Transaction } from 'kysely';
import type { ProductionOrderRecord } from '../api/production-order.service.ts';
import type { PlanningDatabase, ProductionOrderTable } from '../db.ts';
import { ProductionOrder } from '../production-order.resolver.ts';
import { releasePayload } from './release-payload.ts';

/** The transaction the command bus opened for this run of the command (ADR 0012). */
interface PlanningContext {
  readonly tx: Transaction<PlanningDatabase>;
}

/**
 * Reads the order and locks its row until the command's transaction ends, so the validators and
 * the handler see the same order and a second release waits for the first. An order outside the
 * principal's scopes is not found, like one that does not exist.
 */
async function lockOrder(
  tx: Transaction<PlanningDatabase>,
  id: string,
): Promise<Selectable<ProductionOrderTable>> {
  const order = await tx
    .selectFrom('planning.production_order')
    .selectAll()
    .where('id', '=', id)
    .forUpdate()
    .executeTakeFirst();
  if (!order) {
    throw new DomainError({
      code: 'core.not_found',
      kind: 'not_found',
      message: `Production order ${id} was not found`,
    });
  }
  return order;
}

/**
 * planning.releaseProductionOrder, whose mutation planningReleaseProductionOrder the SDK generates
 * from the contract. It returns the released order with its new version.
 */
export const ReleaseProductionOrder = defineCommand(releaseProductionOrder, {
  returns: () => ProductionOrder,
  async buildPayload({ id }, { tx }: PlanningContext) {
    return releasePayload(await lockOrder(tx, id));
  },
  async handle({ id }, { tx }: PlanningContext): Promise<ProductionOrderRecord> {
    const order = await lockOrder(tx, id);
    if (order.status !== 'planned') {
      throw new DomainError({
        code: 'planning.production_order.not_planned',
        kind: 'precondition',
        message: `Production order ${order.number} is ${order.status}, and only a planned order can be released`,
      });
    }
    // The version trigger of planning.production_order bumps version with the update.
    return tx
      .updateTable('planning.production_order')
      .set({ status: 'released' })
      .where('id', '=', id)
      .returning(['id', 'number', 'article_id as articleId', 'quantity', 'status', 'version'])
      .executeTakeFirstOrThrow();
  },
});
