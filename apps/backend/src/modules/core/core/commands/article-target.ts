// SPDX-License-Identifier: AGPL-3.0-or-later
import { HttpStatus } from '@nestjs/common';
import { DomainError } from '@northmes/sdk/errors';
import type { Selectable } from 'kysely';
import type { ArticleTable } from '../../infrastructure/database.ts';
import type { CoreContext } from './context.ts';

/**
 * The article row that a core command on an existing article acts on. Its scope_id is the scope
 * where the bus checked the command's permission, and companyId the article's company node.
 */
export type ArticleRow = Selectable<ArticleTable> & { readonly companyId: string };

/** Reads an article with this id and locks it until the command's transaction ends. */
async function lockArticle(id: string, { tx }: Pick<CoreContext, 'tx'>) {
  return tx
    .selectFrom('core.article')
    .selectAll()
    .where('id', '=', id)
    .forUpdate()
    .executeTakeFirst();
}

/**
 * The target of a core command that changes an existing article (ADR 0012), such as an update,
 * an archive or a restore. The bus checks the permission at the article's edit scope (ADR 0073):
 * the one plant it is assigned to, or the company for an article of several plants, of All plants
 * or of none. It reads that scope, checks the permission there, then locks the row until the
 * command's transaction ends and checks its version. An article outside the principal's read
 * scopes is not found, like one that does not exist.
 */
export const articleTarget = {
  entity: 'Article',
  scopeOf: async (id: string, { tx }: Pick<CoreContext, 'tx'>) =>
    (
      await tx
        .selectFrom('core.article')
        .select('edit_scope_id')
        .where('id', '=', id)
        .executeTakeFirst()
    )?.edit_scope_id,
  load: async (id: string, context: Pick<CoreContext, 'tx'>): Promise<ArticleRow | undefined> => {
    const row = await lockArticle(id, context);
    return row && { ...row, companyId: row.scope_id, scope_id: row.edit_scope_id };
  },
};

/**
 * The target of a core command that changes where an article is used, which the bus checks at the
 * article's company, whatever its edit scope (ADR 0073).
 */
export const articleAtCompanyTarget = {
  entity: 'Article',
  scopeOf: async (id: string, { tx }: Pick<CoreContext, 'tx'>) =>
    (await tx.selectFrom('core.article').select('scope_id').where('id', '=', id).executeTakeFirst())
      ?.scope_id,
  load: async (id: string, context: Pick<CoreContext, 'tx'>): Promise<ArticleRow | undefined> => {
    const row = await lockArticle(id, context);
    return row && { ...row, companyId: row.scope_id };
  },
};

/**
 * Refuses a change to an archived article with core.archived, which the client reads to offer
 * Restore article (design ui-222, DE31).
 */
export function refuseArchived(article: Pick<ArticleRow, 'archived_at' | 'code'>): void {
  if (article.archived_at === null) return;
  throw new DomainError({
    code: 'core.archived',
    status: HttpStatus.PRECONDITION_FAILED,
    message: `Article ${article.code} is archived, and an archived article cannot be changed until it is restored`,
  });
}
