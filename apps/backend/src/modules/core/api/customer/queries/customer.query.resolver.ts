// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Inject } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import type { Connection } from '@northmes/sdk/lists';
import { type CustomerRecord, CustomerService } from '../../../core/customer.service.ts';
import { Customer } from '../types/customer.type.ts';
import { type CustomerListArgs, customerList } from './customer.list.ts';

/** core's queries on Customer. Each needs core.customer:read at the request's plant. */
@Resolver(() => Customer)
export class CustomerQueryResolver {
  constructor(@Inject(CustomerService) private readonly customers: CustomerService) {}

  @Query(() => customerList.Connection, {
    description:
      "One page of the company's customers, with search, orderBy and paging. Needs core.customer:read.",
  })
  coreCustomers(
    @Args({ type: () => customerList.Args }) args: CustomerListArgs,
  ): Promise<Connection<CustomerRecord>> {
    return this.customers.list(args);
  }
}
