// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import {
  Context,
  Field,
  ID,
  Int,
  ObjectType,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { loaderFor, type RequestContext } from '@northmes/sdk/graphql';
import { Article, type ArticleRecord, ArticleService } from '../core/api/index.ts';
import {
  type ProductionOrderRecord,
  ProductionOrderService,
} from './api/production-order.service.ts';

/** An order to make a quantity of one article at one plant (GLOSSARY.md). */
@ObjectType('ProductionOrder')
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
  constructor(
    @Inject(ProductionOrderService) private readonly orders: ProductionOrderService,
    @Inject(ArticleService) private readonly articles: ArticleService,
  ) {}

  /** The production orders at the request's plant, by number. */
  @Query(() => [ProductionOrder])
  planningProductionOrders(): Promise<ProductionOrderRecord[]> {
    return this.orders.list();
  }

  /**
   * The article the order makes, or null when core has none at the request's scopes. The request's
   * core.article loader reads the articles of every order in a list with one query of core's API.
   */
  @ResolveField(() => Article, { nullable: true })
  article(
    @Parent() order: ProductionOrderRecord,
    @Context() context: RequestContext,
  ): Promise<ArticleRecord | null> {
    return loaderFor(context, 'core.article', (ids: readonly string[]) =>
      this.articles.byIds(ids),
    ).load(order.articleId);
  }
}
