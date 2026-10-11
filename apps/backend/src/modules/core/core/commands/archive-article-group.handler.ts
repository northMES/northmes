// SPDX-License-Identifier: AGPL-3.0-or-later
import { archiveArticleGroup } from '@northmes/core-contracts';
import { registerCommand } from '@northmes/sdk/commands';
import { sql } from 'kysely';
import type { z } from 'zod';
import { type ArticleGroupRecord, selectArticleGroups } from '../article-group-record.ts';
import {
  type ArticleGroupRow,
  articleGroupTarget,
  refuseArchivedGroup,
} from './article-group-target.ts';
import type { CoreContext } from './context.ts';

/**
 * The handler of core.archiveArticleGroup (ADR 0012), which the bus checks at the group's company.
 * It sets the group's archived_at to the transaction's time; the articles that have the group keep
 * it. An archived group is refused with core.archived.
 */
export const archiveArticleGroupHandler = {
  target: articleGroupTarget,
  async handle(
    { id }: z.output<typeof archiveArticleGroup.input>,
    { tx, target }: CoreContext<ArticleGroupRow>,
  ): Promise<ArticleGroupRecord> {
    refuseArchivedGroup(target);
    await tx
      .updateTable('core.article_group')
      .set({ archived_at: sql<Date>`now()` })
      .where('id', '=', id)
      .execute();
    return selectArticleGroups(tx).where('id', '=', id).executeTakeFirstOrThrow();
  },
};

/** core.archiveArticleGroup as the bus runs it, which ArticleGroupService.archive sends. */
export const ArchiveArticleGroupCommand = registerCommand(
  archiveArticleGroup,
  archiveArticleGroupHandler,
);
