// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import { Field, ID, ObjectType, Query, Resolver } from '@nestjs/graphql';
import {
  type ProductionOrderRecord,
  ProductionOrderService,
} from './api/production-order.service.ts';
import { PlanningModule } from './planning.module.ts';

/** An order to make a quantity of one article at one plant (GLOSSARY.md). */
@ObjectType('ProductionOrder', { registerIn: () => PlanningModule })
export class ProductionOrder {
  @Field(() => ID) id!: string;
  @Field(() => String) number!: string;
}

@Resolver(() => ProductionOrder)
export class ProductionOrderResolver {
  constructor(@Inject(ProductionOrderService) private readonly orders: ProductionOrderService) {}

  /** The production orders at the request's plant, by number. */
  @Query(() => [ProductionOrder])
  planningProductionOrders(): Promise<ProductionOrderRecord[]> {
    return this.orders.list();
  }
}
