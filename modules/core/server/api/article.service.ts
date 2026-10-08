// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject, Injectable } from '@nestjs/common';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import type { CoreDatabase } from '../db.ts';

/** An article as core's API hands it out. */
export interface ArticleRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

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
      tx
        .selectFrom('core.article')
        .select(['id', 'code', 'name'])
        .where('id', '=', id)
        .executeTakeFirst(),
    );
    return article ?? null;
  }
}
