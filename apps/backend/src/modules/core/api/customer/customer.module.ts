// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Module } from '@nestjs/common';
import { CustomerServiceModule } from '../../core/customer-service.module.ts';
import { customerList } from './queries/customer.list.ts';
import { CustomerQueryResolver } from './queries/customer.query.resolver.ts';

/** core's GraphQL surface for Customer: the list of the company's customers. */
@Module({
  imports: [CustomerServiceModule],
  providers: [CustomerQueryResolver, customerList.ConnectionResolver],
})
export class CustomerModule {}
