// SPDX-License-Identifier: AGPL-3.0-or-later
import type { updateArticle } from '@northmes/core-contracts';
import type { Selectable } from 'kysely';
import type { z } from 'zod';
import type { ArticleTable } from '../../infrastructure/database.ts';
import { type ArticleRecord, recordColumns } from '../article.service.ts';
import type { CoreContext } from './context.ts';

/**
 * The handler of core.updateArticle (ADR 0012), which the mutation coreUpdateArticle sends through
 * the command bus. It changes the article's code and name and returns it with its new version.
 */
export const updateArticleHandler = {
  // The bus reads the article and locks its row until the command's transaction ends, and checks
  // its version. An article outside the principal's scopes is not found, like one that does not
  // exist.
  target: {
    entity: 'Article',
    load: (id: string, { tx }: Pick<CoreContext, 'tx'>) =>
      tx.selectFrom('core.article').selectAll().where('id', '=', id).forUpdate().executeTakeFirst(),
  },
  handle(
    { id, code, name }: z.output<typeof updateArticle.input>,
    { tx }: CoreContext<Selectable<ArticleTable>>,
  ): Promise<ArticleRecord> {
    // The version trigger of core.article bumps version with the update.
    return tx
      .updateTable('core.article')
      .set({ code, name })
      .where('id', '=', id)
      .returning(recordColumns)
      .executeTakeFirstOrThrow();
  },
};
