// SPDX-License-Identifier: MIT
// Fixture module quality: adds a field to catalog's Article and returns Article from no field.
import { Module } from '@nestjs/common';
import { Int, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { type EntityReference, graphqlKit } from '@northmes/sdk/graphql';

const gql = graphqlKit(() => QualityModule);

/** Catalog's Article, referenced by name and key only. */
export const ArticleRef = gql.entityRef('Article');

@Resolver(() => ArticleRef)
export class QualityArticleResolver {
  @ResolveField(() => Boolean, { nullable: true })
  qualityInspectionRequired(@Parent() article: EntityReference): boolean {
    return article.id === 'a-1';
  }
}

@Resolver()
export class QualityResolver {
  @Query(() => Int)
  qualityOpenInspectionCount(): number {
    return 0;
  }
}

@Module({ providers: [QualityArticleResolver, QualityResolver] })
export class QualityModule {}
