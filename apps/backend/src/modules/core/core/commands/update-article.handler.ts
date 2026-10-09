// SPDX-License-Identifier: AGPL-3.0-or-later
import { updateArticle } from '@northmes/core-contracts';
import { registerCommand } from '@northmes/sdk/commands';
import type { z } from 'zod';
import { type ArticleRecord, selectArticles } from '../article-record.ts';
import { type ArticleRow, articleTarget, refuseArchived } from './article-target.ts';
import type { CoreContext } from './context.ts';

/**
 * The handler of core.updateArticle (ADR 0012), which the bus checks at the article's edit scope
 * (ADR 0073). It changes the article's code and name and returns it with its new version. An
 * archived article is refused with core.archived.
 */
export const updateArticleHandler = {
  target: articleTarget,
  async handle(
    { id, code, name }: z.output<typeof updateArticle.input>,
    { tx, target }: CoreContext<ArticleRow>,
  ): Promise<ArticleRecord> {
    refuseArchived(target);
    // The version trigger of core.article bumps version with the update.
    await tx.updateTable('core.article').set({ code, name }).where('id', '=', id).execute();
    return selectArticles(tx).where('id', '=', id).executeTakeFirstOrThrow();
  },
};

/** core.updateArticle as the bus runs it, which ArticleService.update sends. */
export const UpdateArticleCommand = registerCommand(updateArticle, updateArticleHandler);
