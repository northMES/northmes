// SPDX-License-Identifier: AGPL-3.0-or-later
import { updateArticle } from '@northmes/core-contracts';
import { defineCommand } from '@northmes/sdk/commands';
import type { Selectable } from 'kysely';
import { type ArticleRecord, recordColumns } from '../api/article.service.ts';
import { Article } from '../api/article.type.ts';
import type { ArticleTable } from '../db.ts';
import type { CoreContext } from './context.ts';

/**
 * core.updateArticle, whose mutation coreUpdateArticle the SDK generates from the contract. It
 * changes the article's code and name and returns it with its new version.
 */
export const UpdateArticle = defineCommand(updateArticle, {
  returns: () => Article,
  // The bus reads the article and locks its row until the command's transaction ends, and checks
  // its version. An article outside the principal's scopes is not found, like one that does not
  // exist.
  target: {
    entity: 'Article',
    load: (id, { tx }: Pick<CoreContext, 'tx'>) =>
      tx.selectFrom('core.article').selectAll().where('id', '=', id).forUpdate().executeTakeFirst(),
  },
  handle(
    { id, code, name },
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
});
