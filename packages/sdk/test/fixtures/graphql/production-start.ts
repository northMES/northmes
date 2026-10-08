// SPDX-License-Identifier: MIT
// Fixture module production-start: owns ProductionOrder and references catalog's Article.
import { Module } from '@nestjs/common';
import { Field, ID, ObjectType, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { graphqlKit } from '@northmes/sdk/graphql';

const gql = graphqlKit(() => ProductionStartModule);

/** Catalog's Article, referenced by name and key only. */
export const ArticleRef = gql.entityRef('Article');

@ObjectType('ProductionOrder', { registerIn: () => ProductionStartModule })
export class ProductionOrder {
  @Field(() => ID) id!: string;
  @Field(() => String) number!: string;
  articleId!: string;
}

@Resolver(() => ProductionOrder)
export class ProductionOrderResolver {
  @Query(() => [ProductionOrder])
  productionStartOrders(): ProductionOrder[] {
    return [{ id: 'po-1', number: '7001', articleId: 'a-1' }];
  }

  @ResolveField(() => ArticleRef, { nullable: true })
  article(@Parent() order: ProductionOrder): { __typename: 'Article'; id: string } {
    return { __typename: 'Article', id: order.articleId };
  }
}

@Module({ providers: [ProductionOrderResolver] })
export class ProductionStartModule {}
