// SPDX-License-Identifier: AGPL-3.0-or-later
import { Module } from '@nestjs/common';
import { CompanyServiceModule } from '../../core/company-service.module.ts';
import { CompanyQueryResolver } from './queries/company.query.resolver.ts';

/** core's GraphQL surface for companies and their plants. */
@Module({ imports: [CompanyServiceModule], providers: [CompanyQueryResolver] })
export class CompanyModule {}
