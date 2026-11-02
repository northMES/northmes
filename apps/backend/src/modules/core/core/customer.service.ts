// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Inject, Injectable } from '@nestjs/common';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import type { Connection } from '@northmes/sdk/lists';
import type { Kysely, Transaction } from 'kysely';
import { type CustomerListArgs, customerList } from '../api/customer/queries/customer.list.ts';
import type { CoreDatabase } from '../infrastructure/database.ts';
import { readIn, requestScope } from './access/request-scope.ts';

/** A customer as core's service hands it out: its number and name, and nothing more. */
export interface CustomerRecord {
  readonly id: string;
  /** The customer number, unique within the company. */
  readonly code: string;
  readonly name: string;
  /** Grows by one with every change to the customer. */
  readonly version: number;
  /** When the customer last changed, its creation included. */
  readonly updatedAt: Date;
}

/**
 * The customers of one company that a query on core.customer reads, as CustomerRecords. Row-level
 * security limits it to the principal's read scopes.
 */
function customersOf(companyId: string) {
  return (db: Kysely<CoreDatabase> | Transaction<CoreDatabase>) =>
    db
      .selectFrom('core.customer')
      .select(['id', 'code', 'name', 'version', 'updated_at as updatedAt'])
      .where('company_id', '=', companyId);
}

/**
 * Core's customers, a register of the company (story E06-S07). Reads go through the ScopedDatabase
 * and need core.customer:read at the request's plant, which reads its company's customers.
 */
@Injectable()
export class CustomerService {
  constructor(@Inject(DATABASE) private readonly db: ScopedDatabase<CoreDatabase>) {}

  /** One page of the company's customers, as coreCustomers' arguments ask. */
  async list(args: CustomerListArgs): Promise<Connection<CustomerRecord>> {
    const scope = requestScope('core.customer:read');
    const page = await readIn(scope, () =>
      customerList.page(this.db, customersOf(scope.companyId), args),
    );
    return { ...page, count: () => readIn(scope, () => page.count()) };
  }
}
