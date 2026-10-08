// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import { Args, Directive, Field, ID, ObjectType, Query, Resolver } from '@nestjs/graphql';
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
}
