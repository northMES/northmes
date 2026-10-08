// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Generated } from 'kysely';

/** core.article, as its migration creates it. */
export interface ArticleTable {
  id: Generated<string>;
  scope_id: string;
  version: Generated<number>;
  code: string;
  name: string;
}

/**
 * The Kysely table types of the core module, by schema-qualified name. They are written by hand
 * until generated types arrive (ADR 0006), so they change with every core migration.
 */
export interface CoreDatabase {
  'core.article': ArticleTable;
}
