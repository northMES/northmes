// SPDX-License-Identifier: AGPL-3.0-or-later
import type { releaseProductionOrder } from '@northmes/planning-contracts';
import type { Selectable } from 'kysely';
import type { z } from 'zod';
import type { ProductionOrderTable } from '../../infrastructure/database.ts';

/** What command validators of planning.releaseProductionOrder get, before the bus parses it. */
export type ReleasePayload = z.input<typeof releaseProductionOrder.payload>;

/** The validator payload of releasing `order`, a row of planning.production_order (ADR 0037). */
export function releasePayload(order: Selectable<ProductionOrderTable>): ReleasePayload {
  return {
    productionOrderId: order.id,
    plantId: order.scope_id,
    articleId: order.article_id,
    quantity: Number(order.quantity),
  };
}
