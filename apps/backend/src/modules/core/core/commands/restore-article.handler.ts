// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { HttpStatus } from '@nestjs/common';
import { articleRestored, restoreArticle } from '@northmes/core-contracts';
import { registerCommand } from '@northmes/sdk/commands';
import { DomainError } from '@northmes/sdk/errors';
import type { z } from 'zod';
import { type ArticleRecord, selectArticles } from '../article-record.ts';
import { type ArticleRow, articleTarget } from './article-target.ts';
import type { CoreContext } from './context.ts';

/**
 * The handler of core.restoreArticle (ADR 0012), which the bus checks at the article's edit scope
 * (ADR 0073). It clears the article's archived_at, writes core.article.restored, and returns the
 * article with its new version. An
 * article that is not archived is refused with core.not_archived.
 */
export const restoreArticleHandler = {
  target: articleTarget,
  async handle(
    { id }: z.output<typeof restoreArticle.input>,
    { tx, target, publish }: CoreContext<ArticleRow>,
  ): Promise<ArticleRecord> {
    if (target.archived_at === null) {
      throw new DomainError({
        code: 'core.not_archived',
        status: HttpStatus.PRECONDITION_FAILED,
        message: `Article ${target.code} is not archived, so there is nothing to restore`,
      });
    }
    // The version trigger of core.article bumps version with the update.
    await tx.updateTable('core.article').set({ archived_at: null }).where('id', '=', id).execute();
    const article = await selectArticles(tx).where('id', '=', id).executeTakeFirstOrThrow();
    await publish(
      articleRestored,
      { id, version: article.version, scopeId: target.scope_id },
      { code: article.code, name: article.name },
    );
    return article;
  },
};

/** core.restoreArticle as the bus runs it, which ArticleService.restore sends. */
export const RestoreArticleCommand = registerCommand(restoreArticle, restoreArticleHandler);
