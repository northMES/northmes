// SPDX-License-Identifier: AGPL-3.0-or-later
import { type Kysely, sql, type Transaction } from 'kysely';
import type { CoreDatabase } from '../infrastructure/database.ts';
import type { PlantRecord } from './company.service.ts';

/** An article as core's service hands it out. */
export interface ArticleRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  /** Grows by one with every change to the article. */
  readonly version: number;
  /** Assigned to every plant of the company, those created later included (ADR 0073). */
  readonly allPlants: boolean;
  /** The plants the article is assigned to, sorted by name; empty with allPlants. */
  readonly plants: readonly PlantRecord[];
  /** When the article was archived, or null while it is active. */
  readonly archivedAt: Date | null;
  /** When the article last changed, its creation included. */
  readonly updatedAt: Date;
}

/** The columns of core.article that make an ArticleRecord, but for its plants. */
const recordColumns = [
  'id',
  'code',
  'name',
  'version',
  'all_plants as allPlants',
  'archived_at as archivedAt',
  'updated_at as updatedAt',
] as const;

/** The plants of the article on the row being read, sorted by name, as a JSON array. */
const plantsColumn = sql<PlantRecord[]>`coalesce((
  select jsonb_agg(jsonb_build_object('id', p.id, 'slug', p.slug, 'name', p.name)
                   order by p.name, p.slug)
    from core.article_plant ap
    join core.plant p on p.id = ap.plant_id
   where ap.article_id = ${sql.ref('core.article.id')}
), '[]'::jsonb)`.as('plants');

/**
 * The articles that a query on core.article reads, as ArticleRecords: the article's columns and
 * its plants, in one statement. Row-level security limits it to the principal's read scopes.
 */
export function selectArticles(db: Kysely<CoreDatabase> | Transaction<CoreDatabase>) {
  return db.selectFrom('core.article').select(recordColumns).select(plantsColumn);
}
