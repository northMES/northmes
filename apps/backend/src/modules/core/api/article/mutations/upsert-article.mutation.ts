// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Inject } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { upsertArticle } from '@northmes/core-contracts';
import { commandInputArg } from '@northmes/sdk/commands';
import { PlantFree } from '@northmes/sdk/graphql';
import { type ArticleRecord, ArticleService } from '../../../core/article.service.ts';
import { Article } from '../types/article.type.ts';

/**
 * The mutation coreUpsertArticle, whose input type the SDK builds from the contract of
 * core.upsertArticle. It calls ArticleService.upsertByCode, which sends the command through the command
 * bus, as every surface does (ADR 0073).
 */
@Resolver(() => Article)
export class UpsertArticleMutation {
  constructor(@Inject(ArticleService) private readonly articles: ArticleService) {}

  @Mutation(() => Article, { description: upsertArticle.description })
  @PlantFree()
  coreUpsertArticle(
    @Args('input', commandInputArg(upsertArticle)) input: unknown,
  ): Promise<ArticleRecord> {
    return this.articles.upsertByCode(input);
  }
}
