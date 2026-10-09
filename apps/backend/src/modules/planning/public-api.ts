// SPDX-License-Identifier: AGPL-3.0-or-later
// What other modules may import from planning. The module boundary check refuses any other file.
export {
  type ProductionOrderRecord,
  ProductionOrderService,
  type ProductionOrderStatus,
} from './core/production-order.service.ts';
export { ProductionOrderServiceModule } from './core/production-order-service.module.ts';
