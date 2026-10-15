// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { createArticle } from '@northmes/core-contracts';
import { commandInputArg } from '@northmes/sdk/commands';
import { PlantFree } from '@northmes/sdk/graphql';
import { type ArticleRecord, ArticleService } from '../../../core/article.service.ts';
import { Article } from '../types/article.type.ts';

/**
 * The mutation coreCreateArticle, whose input type the SDK builds from the contract of
 * core.createArticle. It calls ArticleService.create, which sends the command through the command
 * bus, as every surface does (ADR 0073).
 */
@Resolver(() => Article)
export class CreateArticleMutation {
  constructor(@Inject(ArticleService) private readonly articles: ArticleService) {}

  @Mutation(() => Article, { description: createArticle.description })
  @PlantFree()
  coreCreateArticle(
    @Args('input', commandInputArg(createArticle)) input: unknown,
  ): Promise<ArticleRecord> {
    return this.articles.create(input);
  }
}
