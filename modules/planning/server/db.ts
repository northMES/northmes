// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Generated } from 'kysely';

/** planning.production_order, as its migration creates it. */
export interface ProductionOrderTable {
  id: Generated<string>;
  scope_id: string;
  version: Generated<number>;
  number: string;
  article_id: string;
  /** numeric(18,6), which pg reads as decimal text. */
  quantity: string;
  status: Generated<'planned' | 'released'>;
}

/**
 * The Kysely table types of the planning module, by schema-qualified name. They are written by
 * hand until generated types arrive (ADR 0006), so they change with every planning migration.
 */
export interface PlanningDatabase {
  'planning.production_order': ProductionOrderTable;
}
