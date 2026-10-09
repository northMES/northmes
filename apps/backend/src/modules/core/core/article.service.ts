// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject, Injectable } from '@nestjs/common';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import type { Connection } from '@northmes/sdk/lists';
import { type ArticleListArgs, articleList } from '../api/article/queries/article.list.ts';
import type { CoreDatabase } from '../infrastructure/database.ts';
import { requestScope } from './access/request-scope.ts';

/** An article as core's service hands it out. */
export interface ArticleRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  /** Grows by one with every change to the article. */
  readonly version: number;
  /** When the article was archived, or null while it is active. */
  readonly archivedAt: Date | null;
  /** When the article last changed, its creation included. */
  readonly updatedAt: Date;
}

/** The columns of core.article that make an ArticleRecord. */
export const recordColumns = [
  'id',
  'code',
  'name',
  'version',
  'archived_at as archivedAt',
  'updated_at as updatedAt',
] as const;

/**
 * Reads articles through the ScopedDatabase, so a caller sees only the articles at the scopes of
 * the principal it runs as.
 */
@Injectable()
export class ArticleService {
  constructor(@Inject(DATABASE) private readonly db: ScopedDatabase<CoreDatabase>) {}

  /**
   * The article with this id, or null when none exists at the principal's read scopes. A
   * principal without core.article:read at the request's plant gets core.forbidden.
   */
  async byId(id: string): Promise<ArticleRecord | null> {
    requestScope('core.article:read');
    const article = await this.db.transaction((tx) =>
      tx.selectFrom('core.article').select(recordColumns).where('id', '=', id).executeTakeFirst(),
    );
    return article ?? null;
  }

  /**
   * The articles with these ids in one query, one entry per id in the order of the ids: the
   * article, or null when none exists at the principal's read scopes. It checks no permission,
   * because another module's field reads the articles of its own rows through it, such as the
   * article of a production order.
   */
  async byIds(ids: readonly string[]): Promise<(ArticleRecord | null)[]> {
    if (ids.length === 0) return [];
    const articles = await this.db.transaction((tx) =>
      tx.selectFrom('core.article').select(recordColumns).where('id', 'in', ids).execute(),
    );
    const byId = new Map(articles.map((article) => [article.id, article]));
    return ids.map((id) => byId.get(id) ?? null);
  }

  /**
   * One page of the articles at the principal's read scopes, as coreArticles' arguments ask: the
   * active ones, and the archived ones too when includeArchived is true. A principal without
   * core.article:read at the request's plant gets core.forbidden.
   */
  async list(args: ArticleListArgs): Promise<Connection<ArticleRecord>> {
    requestScope('core.article:read');
    return articleList.page(
      this.db,
      (tx) => tx.selectFrom('core.article').select(recordColumns),
      args,
    );
  }
}
