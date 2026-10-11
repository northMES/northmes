// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Translation } from '@northmes/contracts';
import type { Kysely, Transaction } from 'kysely';
import type { CoreDatabase } from '../infrastructure/database.ts';

/** An article group as core's service hands it out. */
export interface ArticleGroupRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  /** The translations of the name (ADR 0053). */
  readonly translations: readonly Translation[];
  /** Grows by one with every change to the group. */
  readonly version: number;
  /** When the group was archived, or null while it is active. */
  readonly archivedAt: Date | null;
  /** When the group last changed, its creation included. */
  readonly updatedAt: Date;
}

/**
 * The article groups that a query on core.article_group reads, as ArticleGroupRecords. Row-level
 * security limits it to the principal's read scopes.
 */
export function selectArticleGroups(db: Kysely<CoreDatabase> | Transaction<CoreDatabase>) {
  return db
    .selectFrom('core.article_group')
    .select([
      'id',
      'code',
      'name',
      'translations',
      'version',
      'archived_at as archivedAt',
      'updated_at as updatedAt',
    ]);
}
