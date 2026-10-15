// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { restoreArticle } from '@northmes/core-contracts';
import { commandInputArg } from '@northmes/sdk/commands';
import { PlantFree } from '@northmes/sdk/graphql';
import { type ArticleRecord, ArticleService } from '../../../core/article.service.ts';
import { Article } from '../types/article.type.ts';

/**
 * The mutation coreRestoreArticle, whose input type the SDK builds from the contract of
 * core.restoreArticle. It calls ArticleService.restore, which sends the command through the command
 * bus, as every surface does (ADR 0073).
 */
@Resolver(() => Article)
export class RestoreArticleMutation {
  constructor(@Inject(ArticleService) private readonly articles: ArticleService) {}

  @Mutation(() => Article, { description: restoreArticle.description })
  @PlantFree()
  coreRestoreArticle(
    @Args('input', commandInputArg(restoreArticle)) input: unknown,
  ): Promise<ArticleRecord> {
    return this.articles.restore(input);
  }
}
