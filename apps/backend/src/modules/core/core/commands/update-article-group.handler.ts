// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { updateArticleGroup } from '@northmes/core-contracts';
import { registerCommand } from '@northmes/sdk/commands';
import type { z } from 'zod';
import { type ArticleGroupRecord, selectArticleGroups } from '../article-group-record.ts';
import {
  type ArticleGroupRow,
  articleGroupTarget,
  refuseArchivedGroup,
} from './article-group-target.ts';
import type { CoreContext } from './context.ts';

/**
 * The handler of core.updateArticleGroup (ADR 0012), which the bus checks at the group's company.
 * It changes the group's code and name, and its translations when the input names them. An
 * archived group is refused with core.archived.
 */
export const updateArticleGroupHandler = {
  target: articleGroupTarget,
  async handle(
    { id, code, name, translations }: z.output<typeof updateArticleGroup.input>,
    { tx, target }: CoreContext<ArticleGroupRow>,
  ): Promise<ArticleGroupRecord> {
    refuseArchivedGroup(target);
    await tx
      .updateTable('core.article_group')
      .set({
        code,
        name,
        ...(translations === undefined ? {} : { translations: JSON.stringify(translations) }),
      })
      .where('id', '=', id)
      .execute();
    return selectArticleGroups(tx).where('id', '=', id).executeTakeFirstOrThrow();
  },
};

/** core.updateArticleGroup as the bus runs it, which ArticleGroupService.update sends. */
export const UpdateArticleGroupCommand = registerCommand(
  updateArticleGroup,
  updateArticleGroupHandler,
);
