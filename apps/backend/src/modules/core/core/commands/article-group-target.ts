// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { HttpStatus } from '@nestjs/common';
import { DomainError } from '@northmes/sdk/errors';
import type { Selectable } from 'kysely';
import type { ArticleGroupTable } from '../../infrastructure/database.ts';
import type { CoreContext } from './context.ts';

/** The article group row that a core command on an existing group acts on. */
export type ArticleGroupRow = Selectable<ArticleGroupTable>;

/**
 * The target of a core command that changes an existing article group (ADR 0012). The bus checks
 * the permission at the group's scope, its company, then locks the row until the command's
 * transaction ends and checks its version. A group outside the principal's read scopes is not
 * found, like one that does not exist.
 */
export const articleGroupTarget = {
  entity: 'ArticleGroup',
  scopeOf: async (id: string, { tx }: Pick<CoreContext, 'tx'>) =>
    (
      await tx
        .selectFrom('core.article_group')
        .select('scope_id')
        .where('id', '=', id)
        .executeTakeFirst()
    )?.scope_id,
  load: (id: string, { tx }: Pick<CoreContext, 'tx'>): Promise<ArticleGroupRow | undefined> =>
    tx
      .selectFrom('core.article_group')
      .selectAll()
      .where('id', '=', id)
      .forUpdate()
      .executeTakeFirst(),
};

/** Refuses a change to an archived article group with core.archived. */
export function refuseArchivedGroup(group: Pick<ArticleGroupRow, 'archived_at' | 'code'>): void {
  if (group.archived_at === null) return;
  throw new DomainError({
    code: 'core.archived',
    status: HttpStatus.PRECONDITION_FAILED,
    message: `Article group ${group.code} is archived, and an archived group cannot be changed until it is restored`,
  });
}

/**
 * Refuses an article's pick of a group with core.article_group_not_active on articleGroupId,
 * unless the group is an active group of the article's company (maintainer, 2026-10-09). An
 * article that already has an archived group keeps it while an update leaves the group out.
 */
export async function requireActiveGroup(
  { tx }: Pick<CoreContext, 'tx'>,
  groupId: string,
  companyId: string,
): Promise<void> {
  const group = await tx
    .selectFrom('core.article_group')
    .select('archived_at')
    .where('id', '=', groupId)
    .where('company_id', '=', companyId)
    .executeTakeFirst();
  if (group !== undefined && group.archived_at === null) return;
  const message = 'Choose an active article group of the company.';
  throw new DomainError({
    code: 'core.article_group_not_active',
    status: HttpStatus.BAD_REQUEST,
    message,
    fieldErrors: [{ path: ['articleGroupId'], message, code: 'core.article_group_not_active' }],
  });
}
