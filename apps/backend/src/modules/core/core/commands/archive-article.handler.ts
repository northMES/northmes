// SPDX-License-Identifier: AGPL-3.0-or-later
import type { archiveArticle } from '@northmes/core-contracts';
import { sql } from 'kysely';
import type { z } from 'zod';
import { type ArticleRecord, recordColumns } from '../article.service.ts';
import { type ArticleRow, articleTarget, refuseArchived } from './article-target.ts';
import type { CoreContext } from './context.ts';

/**
 * The handler of core.archiveArticle (ADR 0012), which the mutation coreArchiveArticle sends
 * through the command bus. It sets the article's archived_at to the transaction's time and returns
 * the article with its new version. An archived article is refused with core.archived.
 */
export const archiveArticleHandler = {
  target: articleTarget,
  handle(
    { id }: z.output<typeof archiveArticle.input>,
    { tx, target }: CoreContext<ArticleRow>,
  ): Promise<ArticleRecord> {
    refuseArchived(target);
    // The version trigger of core.article bumps version with the update.
    return tx
      .updateTable('core.article')
      .set({ archived_at: sql<Date>`now()` })
      .where('id', '=', id)
      .returning(recordColumns)
      .executeTakeFirstOrThrow();
  },
};
