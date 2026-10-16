// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { articleUpdated, updateArticle } from '@northmes/core-contracts';
import { registerCommand } from '@northmes/sdk/commands';
import type { z } from 'zod';
import { type ArticleRecord, selectArticles } from '../article-record.ts';
import { requireActiveGroup } from './article-group-target.ts';
import { type ArticleRow, articleTarget, refuseArchived } from './article-target.ts';
import type { CoreContext } from './context.ts';

/**
 * The handler of core.updateArticle (ADR 0012), which the bus checks at the article's edit scope
 * (ADR 0073). It changes the article's code and name, and its translations, article group, stock
 * unit and note when the input names them; a newly picked group must be an active group of the
 * article's company, writes core.article.updated, and returns it with its new version. An archived article is refused
 * with core.archived.
 */
export const updateArticleHandler = {
  target: articleTarget,
  async handle(
    {
      id,
      code,
      name,
      translations,
      articleGroupId,
      stockUnit,
      note,
    }: z.output<typeof updateArticle.input>,
    context: CoreContext<ArticleRow>,
  ): Promise<ArticleRecord> {
    const { tx, target } = context;
    refuseArchived(target);
    // A group the article already has stays, also an archived one; a new pick must be active.
    if (articleGroupId && articleGroupId !== target.article_group_id) {
      await requireActiveGroup(context, articleGroupId, target.companyId);
    }
    // The version trigger of core.article bumps version with the update.
    await tx
      .updateTable('core.article')
      .set({
        code,
        name,
        ...(translations === undefined ? {} : { translations: JSON.stringify(translations) }),
        ...(articleGroupId === undefined ? {} : { article_group_id: articleGroupId }),
        ...(stockUnit === undefined ? {} : { stock_unit: stockUnit }),
        ...(note === undefined ? {} : { note }),
      })
      .where('id', '=', id)
      .execute();
    const article = await selectArticles(tx).where('id', '=', id).executeTakeFirstOrThrow();
    await context.publish(
      articleUpdated,
      { id, version: article.version, scopeId: target.scope_id },
      { code: article.code, name: article.name },
    );
    return article;
  },
};

/** core.updateArticle as the bus runs it, which ArticleService.update sends. */
export const UpdateArticleCommand = registerCommand(updateArticle, updateArticleHandler);
