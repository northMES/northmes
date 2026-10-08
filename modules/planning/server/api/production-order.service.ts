// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject, Injectable } from '@nestjs/common';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import type { PlanningDatabase } from '../db.ts';

/** Where a production order stands. */
export type ProductionOrderStatus = 'planned' | 'released';

/** A production order as planning's API hands it out. */
export interface ProductionOrderRecord {
  readonly id: string;
  readonly number: string;
  /** The id of core's article the order makes. */
  readonly articleId: string;
  /** The numeric(18,6) quantity as decimal text, such as 12.500000. */
  readonly quantity: string;
  readonly status: ProductionOrderStatus;
  /** Grows by one with every change to the order. */
  readonly version: number;
}

/** The columns of planning.production_order that make a ProductionOrderRecord. */
export const recordColumns = [
  'id',
  'number',
  'article_id as articleId',
  'quantity',
  'status',
  'version',
] as const;

/**
 * Reads production orders through the ScopedDatabase, so a caller sees only the orders at the
 * scopes of the principal it runs as.
 */
@Injectable()
export class ProductionOrderService {
  constructor(@Inject(DATABASE) private readonly db: ScopedDatabase<PlanningDatabase>) {}

  /** The production orders at the principal's read scopes, by number. */
  list(): Promise<ProductionOrderRecord[]> {
    return this.db.transaction((tx) =>
      tx
        .selectFrom('planning.production_order')
        .select(recordColumns)
        .orderBy('number')
        .orderBy('id')
        .execute(),
    );
  }
}
