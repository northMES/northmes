// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import {
  type ProductionOrderRecord,
  ProductionOrderService,
} from '../../../core/production-order.service.ts';
import { ProductionOrder } from '../types/production-order.type.ts';

/** planning's queries on ProductionOrder. */
@Resolver(() => ProductionOrder)
export class ProductionOrderQueryResolver {
  constructor(@Inject(ProductionOrderService) private readonly orders: ProductionOrderService) {}

  /** The production orders at the request's plant, by number. */
  @Query(() => [ProductionOrder])
  planningProductionOrders(): Promise<ProductionOrderRecord[]> {
    return this.orders.list();
  }
}
