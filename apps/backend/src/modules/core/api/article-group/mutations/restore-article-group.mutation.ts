// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Inject } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { restoreArticleGroup } from '@northmes/core-contracts';
import { commandInput } from '@northmes/sdk/commands';
import { PlantFree } from '@northmes/sdk/graphql';
import {
  type ArticleGroupRecord,
  ArticleGroupService,
} from '../../../core/article-group.service.ts';
import { ArticleGroup } from '../types/article-group.type.ts';

/** The input type of the mutation, registered when the module loads. */
const RestoreArticleGroupInput = commandInput(restoreArticleGroup);

/**
 * The mutation coreRestoreArticleGroup, whose input type the SDK builds from the contract of
 * core.restoreArticleGroup. It calls ArticleGroupService.restore, which sends the command through
 * the command bus, as every surface does (ADR 0073).
 */
@Resolver(() => ArticleGroup)
export class RestoreArticleGroupMutation {
  constructor(@Inject(ArticleGroupService) private readonly groups: ArticleGroupService) {}

  /** Restores an archived article group. */
  @Mutation(() => ArticleGroup)
  @PlantFree()
  coreRestoreArticleGroup(
    @Args('input', { type: () => RestoreArticleGroupInput }) input: unknown,
  ): Promise<ArticleGroupRecord> {
    return this.groups.restore(input);
  }
}
