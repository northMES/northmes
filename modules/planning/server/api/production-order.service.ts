// SPDX-License-Identifier: AGPL-3.0-or-later
import { Inject, Injectable } from '@nestjs/common';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import type { PlanningDatabase } from '../db.ts';

/** A production order as planning's API hands it out. */
export interface ProductionOrderRecord {
  readonly id: string;
  readonly number: string;
}

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
        .select(['id', 'number'])
        .orderBy('number')
        .orderBy('id')
        .execute(),
    );
  }
}
