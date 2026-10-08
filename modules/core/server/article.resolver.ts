// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import {
  Args,
  Context,
  Directive,
  Field,
  ID,
  ObjectType,
  Parent,
  Query,
  ResolveReference,
  Resolver,
} from '@nestjs/graphql';
import { type EntityReference, loaderFor, type SubgraphContext } from '@northmes/sdk/graphql';
import { type ArticleRecord, ArticleService } from './api/article.service.ts';
import { CoreModule } from './core.module.ts';

/** Something the company makes or consumes, identified by its article number (GLOSSARY.md). */
@ObjectType('Article', { registerIn: () => CoreModule })
@Directive('@key(fields: "id")')
export class Article {
  @Field(() => ID) id!: string;
  @Field(() => String) code!: string;
  @Field(() => String) name!: string;
}

@Resolver(() => Article)
export class ArticleResolver {
  constructor(@Inject(ArticleService) private readonly articles: ArticleService) {}

  /** The article with this id at the request's plant, or null. */
  @Query(() => Article, { nullable: true })
  coreArticle(@Args('id', { type: () => ID }) id: string): Promise<ArticleRecord | null> {
    return this.articles.byId(id);
  }

  /**
   * The article that another subgraph references by id, or null when none is at the request's
   * scopes. The request's loader reads the references that one _entities call resolves in one
   * query, so the articles of every order in a list cost one read.
   */
  @ResolveReference()
  resolveReference(
    @Parent() reference: EntityReference,
    @Context() context: SubgraphContext,
  ): Promise<ArticleRecord | null> {
    return loaderFor(context, 'core.article', (ids: readonly string[]) =>
      this.articles.byIds(ids),
    ).load(reference.id);
  }
}
