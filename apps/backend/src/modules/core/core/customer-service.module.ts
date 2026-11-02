// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Module } from '@nestjs/common';
import { CustomerService } from './customer.service.ts';

/** Provides core's CustomerService. */
@Module({ providers: [CustomerService], exports: [CustomerService] })
export class CustomerServiceModule {}
