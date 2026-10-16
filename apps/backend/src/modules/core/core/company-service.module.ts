// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Module } from '@nestjs/common';
import { CompanyService } from './company.service.ts';

/** Provides core's CompanyService: plain providers and no resolvers. */
@Module({ providers: [CompanyService], exports: [CompanyService] })
export class CompanyServiceModule {}
