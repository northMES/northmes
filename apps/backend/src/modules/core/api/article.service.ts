// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject, Injectable } from '@nestjs/common';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import type { Connection } from '@northmes/sdk/lists';
import type { CoreDatabase } from '../db.ts';
import { type ArticleListArgs, articleList } from './article-list.ts';

/** An article as core's API hands it out. */
export interface ArticleRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  /** Grows by one with every change to the article. */
  readonly version: number;
}

/** The columns of core.article that make an ArticleRecord. */
export const recordColumns = ['id', 'code', 'name', 'version'] as const;

/**
 * Reads articles through the ScopedDatabase, so a caller sees only the articles at the scopes of
 * the principal it runs as.
 */
@Injectable()
export class ArticleService {
  constructor(@Inject(DATABASE) private readonly db: ScopedDatabase<CoreDatabase>) {}

  /** The article with this id, or null when none exists at the principal's read scopes. */
  async byId(id: string): Promise<ArticleRecord | null> {
    const article = await this.db.transaction((tx) =>
      tx.selectFrom('core.article').select(recordColumns).where('id', '=', id).executeTakeFirst(),
    );
    return article ?? null;
  }

  /**
   * The articles with these ids in one query, one entry per id in the order of the ids: the
   * article, or null when none exists at the principal's read scopes.
   */
  async byIds(ids: readonly string[]): Promise<(ArticleRecord | null)[]> {
    if (ids.length === 0) return [];
    const articles = await this.db.transaction((tx) =>
      tx.selectFrom('core.article').select(recordColumns).where('id', 'in', ids).execute(),
    );
    const byId = new Map(articles.map((article) => [article.id, article]));
    return ids.map((id) => byId.get(id) ?? null);
  }

  /** One page of the articles at the principal's read scopes, as coreArticles' arguments ask. */
  list(args: ArticleListArgs): Promise<Connection<ArticleRecord>> {
    return articleList.page(
      this.db,
      (tx) => tx.selectFrom('core.article').select(recordColumns),
      args,
    );
  }
}
