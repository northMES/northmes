// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Inject } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { setArticlePlants } from '@northmes/core-contracts';
import { commandInputArg } from '@northmes/sdk/commands';
import { PlantFree } from '@northmes/sdk/graphql';
import { type ArticleRecord, ArticleService } from '../../../core/article.service.ts';
import { Article } from '../types/article.type.ts';

/**
 * The mutation coreSetArticlePlants, whose input type the SDK builds from the contract of
 * core.setArticlePlants. It calls ArticleService.setPlants, which sends the command through the
 * command bus, as every surface does (ADR 0073).
 */
@Resolver(() => Article)
export class SetArticlePlantsMutation {
  constructor(@Inject(ArticleService) private readonly articles: ArticleService) {}

  @Mutation(() => Article, { description: setArticlePlants.description })
  @PlantFree()
  coreSetArticlePlants(
    @Args('input', commandInputArg(setArticlePlants)) input: unknown,
  ): Promise<ArticleRecord> {
    return this.articles.setPlants(input);
  }
}
