// SPDX-License-Identifier: MIT
import { defineCommandContract } from '@northmes/contracts';
import { z } from 'zod';

/**
 * Releases a planned production order, which the input names by id. Until operations exist, the
 * release only sets the order's status to released. Command validators of other modules and
 * plugins may veto it, and they get the payload below, never the input (ADR 0037).
 */
export const releaseProductionOrder = defineCommandContract({
  name: 'planning.releaseProductionOrder',
  target: 'existing',
  fields: z.object({}),
  permission: 'planning.productionOrder:release',
  validatable: true,
  payload: z.object({
    productionOrderId: z.uuid(),
    /** The scope id of the plant the order belongs to. */
    plantId: z.uuid(),
    /** The id of core's article the order makes. */
    articleId: z.uuid(),
    /** The order quantity in the article's unit. */
    quantity: z.number(),
  }),
});
