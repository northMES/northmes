// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { createArticleGroup } from '@northmes/core-contracts';
import { commandInputArg } from '@northmes/sdk/commands';
import { PlantFree } from '@northmes/sdk/graphql';
import {
  type ArticleGroupRecord,
  ArticleGroupService,
} from '../../../core/article-group.service.ts';
import { ArticleGroup } from '../types/article-group.type.ts';

/**
 * The mutation coreCreateArticleGroup, whose input type the SDK builds from the contract of
 * core.createArticleGroup. It calls ArticleGroupService.create, which sends the command through the
 * command bus, as every surface does (ADR 0073).
 */
@Resolver(() => ArticleGroup)
export class CreateArticleGroupMutation {
  constructor(@Inject(ArticleGroupService) private readonly groups: ArticleGroupService) {}

  @Mutation(() => ArticleGroup, { description: createArticleGroup.description })
  @PlantFree()
  coreCreateArticleGroup(
    @Args('input', commandInputArg(createArticleGroup)) input: unknown,
  ): Promise<ArticleGroupRecord> {
    return this.groups.create(input);
  }
}
