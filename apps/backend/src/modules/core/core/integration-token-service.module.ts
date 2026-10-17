// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Module } from '@nestjs/common';
import { IntegrationTokenService } from './integration-token.service.ts';

/** Provides core's IntegrationTokenService: plain providers and no resolvers. */
@Module({ providers: [IntegrationTokenService], exports: [IntegrationTokenService] })
export class IntegrationTokenServiceModule {}
