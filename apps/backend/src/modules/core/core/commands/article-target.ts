// SPDX-License-Identifier: AGPL-3.0-or-later
import { HttpStatus } from '@nestjs/common';
import { DomainError } from '@northmes/sdk/errors';
import type { Selectable } from 'kysely';
import type { ArticleTable } from '../../infrastructure/database.ts';
import type { CoreContext } from './context.ts';

/** The article row that a core command on an existing article acts on. */
export type ArticleRow = Selectable<ArticleTable>;

/**
 * The target of a core command on an existing article (ADR 0012). The bus reads the article and
 * locks its row until the command's transaction ends, and checks its version. An article outside
 * the principal's scopes is not found, like one that does not exist.
 */
export const articleTarget = {
  entity: 'Article',
  load: (id: string, { tx }: Pick<CoreContext, 'tx'>) =>
    tx.selectFrom('core.article').selectAll().where('id', '=', id).forUpdate().executeTakeFirst(),
};

/**
 * Refuses a change to an archived article with core.archived, which the client reads to offer
 * Restore article (design ui-222, DE31).
 */
export function refuseArchived(article: ArticleRow): void {
  if (article.archived_at === null) return;
  throw new DomainError({
    code: 'core.archived',
    status: HttpStatus.PRECONDITION_FAILED,
    message: `Article ${article.code} is archived, and an archived article cannot be changed until it is restored`,
  });
}
