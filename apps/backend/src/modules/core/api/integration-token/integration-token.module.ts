// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Module } from '@nestjs/common';
import { IntegrationTokenServiceModule } from '../../core/integration-token-service.module.ts';
import { CreatedIntegrationTokenFieldResolver } from './fields/created-integration-token.field.resolver.ts';
import { CreateIntegrationToken } from './mutations/create-integration-token.mutation.ts';
import { RevokeIntegrationToken } from './mutations/revoke-integration-token.mutation.ts';
import { IntegrationTokenQueryResolver } from './queries/integration-token.query.resolver.ts';

/** core's GraphQL surface for IntegrationToken: its query and the mutations of its commands. */
@Module({
  imports: [IntegrationTokenServiceModule],
  providers: [
    IntegrationTokenQueryResolver,
    CreatedIntegrationTokenFieldResolver,
    CreateIntegrationToken,
    RevokeIntegrationToken,
  ],
})
export class IntegrationTokenModule {}
