// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import { Field, ID, Int, ObjectType, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { graphqlKit } from '@northmes/sdk/graphql';
import {
  type ProductionOrderRecord,
  ProductionOrderService,
} from './api/production-order.service.ts';
import { PlanningModule } from './planning.module.ts';

const gql = graphqlKit(() => PlanningModule);

/** Core's Article, referenced by name and key only. */
export const ArticleRef = gql.entityRef('Article');

/** An order to make a quantity of one article at one plant (GLOSSARY.md). */
@ObjectType('ProductionOrder', { registerIn: () => PlanningModule })
export class ProductionOrder {
  @Field(() => ID) id!: string;
  @Field(() => String) number!: string;
  /** Decimal text with six decimals, until a decimal scalar is chosen (open item M-34). */
  @Field(() => String) quantity!: string;
  /** planned or released. */
  @Field(() => String) status!: string;
  /** Grows by one with every change to the order. */
  @Field(() => Int) version!: number;
}

@Resolver(() => ProductionOrder)
export class ProductionOrderResolver {
  constructor(@Inject(ProductionOrderService) private readonly orders: ProductionOrderService) {}

  /** The production orders at the request's plant, by number. */
  @Query(() => [ProductionOrder])
  planningProductionOrders(): Promise<ProductionOrderRecord[]> {
    return this.orders.list();
  }

  /** The article the order makes, which the core subgraph resolves; null when core has none. */
  @ResolveField(() => ArticleRef, { nullable: true })
  article(@Parent() order: ProductionOrderRecord): { __typename: 'Article'; id: string } {
    return { __typename: 'Article', id: order.articleId };
  }
}
