// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { HttpStatus } from '@nestjs/common';
import { restoreArticleGroup } from '@northmes/core-contracts';
import { registerCommand } from '@northmes/sdk/commands';
import { DomainError } from '@northmes/sdk/errors';
import type { z } from 'zod';
import { type ArticleGroupRecord, selectArticleGroups } from '../article-group-record.ts';
import { type ArticleGroupRow, articleGroupTarget } from './article-group-target.ts';
import type { CoreContext } from './context.ts';

/**
 * The handler of core.restoreArticleGroup (ADR 0012), which the bus checks at the group's company.
 * It clears the group's archived_at. A group that is not archived is refused with
 * core.not_archived.
 */
export const restoreArticleGroupHandler = {
  target: articleGroupTarget,
  async handle(
    { id }: z.output<typeof restoreArticleGroup.input>,
    { tx, target }: CoreContext<ArticleGroupRow>,
  ): Promise<ArticleGroupRecord> {
    if (target.archived_at === null) {
      throw new DomainError({
        code: 'core.not_archived',
        status: HttpStatus.PRECONDITION_FAILED,
        message: `Article group ${target.code} is not archived, so there is nothing to restore`,
      });
    }
    await tx
      .updateTable('core.article_group')
      .set({ archived_at: null })
      .where('id', '=', id)
      .execute();
    return selectArticleGroups(tx).where('id', '=', id).executeTakeFirstOrThrow();
  },
};

/** core.restoreArticleGroup as the bus runs it, which ArticleGroupService.restore sends. */
export const RestoreArticleGroupCommand = registerCommand(
  restoreArticleGroup,
  restoreArticleGroupHandler,
);
