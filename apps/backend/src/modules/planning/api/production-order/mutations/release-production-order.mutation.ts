// SPDX-License-Identifier: AGPL-3.0-or-later
import { releaseProductionOrder } from '@northmes/planning-contracts';
import { defineCommand } from '@northmes/sdk/commands';
import { releaseProductionOrderHandler } from '../../../core/commands/release-production-order.handler.ts';
import { ProductionOrder } from '../types/production-order.type.ts';

/**
 * The mutation planningReleaseProductionOrder, which the SDK generates from the contract of
 * planning.releaseProductionOrder and which returns the order that the handler released.
 */
export const ReleaseProductionOrder = defineCommand(releaseProductionOrder, {
  returns: () => ProductionOrder,
  ...releaseProductionOrderHandler,
});
