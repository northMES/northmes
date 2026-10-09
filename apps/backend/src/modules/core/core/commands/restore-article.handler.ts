// SPDX-License-Identifier: AGPL-3.0-or-later
import { HttpStatus } from '@nestjs/common';
import type { restoreArticle } from '@northmes/core-contracts';
import { DomainError } from '@northmes/sdk/errors';
import type { z } from 'zod';
import { type ArticleRecord, recordColumns } from '../article.service.ts';
import { type ArticleRow, articleTarget } from './article-target.ts';
import type { CoreContext } from './context.ts';

/**
 * The handler of core.restoreArticle (ADR 0012), which the mutation coreRestoreArticle sends
 * through the command bus. It clears the article's archived_at and returns the article with its
 * new version. An article that is not archived is refused with core.not_archived.
 */
export const restoreArticleHandler = {
  target: articleTarget,
  handle(
    { id }: z.output<typeof restoreArticle.input>,
    { tx, target }: CoreContext<ArticleRow>,
  ): Promise<ArticleRecord> {
    if (target.archived_at === null) {
      throw new DomainError({
        code: 'core.not_archived',
        status: HttpStatus.PRECONDITION_FAILED,
        message: `Article ${target.code} is not archived, so there is nothing to restore`,
      });
    }
    // The version trigger of core.article bumps version with the update.
    return tx
      .updateTable('core.article')
      .set({ archived_at: null })
      .where('id', '=', id)
      .returning(recordColumns)
      .executeTakeFirstOrThrow();
  },
};
