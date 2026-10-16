// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { archiveArticle, articleArchived } from '@northmes/core-contracts';
import { registerCommand } from '@northmes/sdk/commands';
import { sql } from 'kysely';
import type { z } from 'zod';
import { type ArticleRecord, selectArticles } from '../article-record.ts';
import { type ArticleRow, articleTarget, refuseArchived } from './article-target.ts';
import type { CoreContext } from './context.ts';

/**
 * The handler of core.archiveArticle (ADR 0012), which the bus checks at the article's edit scope
 * (ADR 0073). It sets the article's archived_at to the transaction's time, at every plant, writes
 * core.article.archived, and returns the article with its new version. An archived article is refused with core.archived.
 */
export const archiveArticleHandler = {
  target: articleTarget,
  async handle(
    { id }: z.output<typeof archiveArticle.input>,
    { tx, target, publish }: CoreContext<ArticleRow>,
  ): Promise<ArticleRecord> {
    refuseArchived(target);
    // The version trigger of core.article bumps version with the update.
    await tx
      .updateTable('core.article')
      .set({ archived_at: sql<Date>`now()` })
      .where('id', '=', id)
      .execute();
    const article = await selectArticles(tx).where('id', '=', id).executeTakeFirstOrThrow();
    await publish(
      articleArchived,
      { id, version: article.version, scopeId: target.scope_id },
      { code: article.code, name: article.name },
    );
    return article;
  },
};

/** core.archiveArticle as the bus runs it, which ArticleService.archive sends. */
export const ArchiveArticleCommand = registerCommand(archiveArticle, archiveArticleHandler);
