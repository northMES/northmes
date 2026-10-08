// SPDX-License-Identifier: AGPL-3.0-or-later
import { releaseProductionOrder } from '@northmes/planning-contracts';
import { defineCommand } from '@northmes/sdk/commands';
import type { Transaction } from 'kysely';
import type { ProductionOrderRecord } from '../api/production-order.service.ts';
import type { PlanningDatabase } from '../db.ts';
import { ProductionOrder } from '../production-order.resolver.ts';
import { releasePayload } from './release-payload.ts';

/** The transaction the command bus opened for this run of the command (ADR 0012). */
interface PlanningContext {
  readonly tx: Transaction<PlanningDatabase>;
}

/**
 * planning.releaseProductionOrder, whose mutation planningReleaseProductionOrder the SDK generates
 * from the contract. It returns the released order with its new version.
 */
export const ReleaseProductionOrder = defineCommand(releaseProductionOrder, {
  returns: () => ProductionOrder,
  async buildPayload({ id }, { tx }: PlanningContext) {
    const order = await tx
      .selectFrom('planning.production_order')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirstOrThrow();
    return releasePayload(order);
  },
  // The version trigger of planning.production_order bumps version with the update.
  handle({ id }, { tx }: PlanningContext): Promise<ProductionOrderRecord> {
    return tx
      .updateTable('planning.production_order')
      .set({ status: 'released' })
      .where('id', '=', id)
      .returning(['id', 'number', 'article_id as articleId', 'quantity', 'status', 'version'])
      .executeTakeFirstOrThrow();
  },
});
