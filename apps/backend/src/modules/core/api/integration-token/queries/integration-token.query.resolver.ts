// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Inject } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { PlantFree } from '@northmes/sdk/graphql';
import {
  type IntegrationTokenRecord,
  IntegrationTokenService,
} from '../../../core/integration-token.service.ts';
import { companyIdArg } from '../../company/inputs/company-id.arg.ts';
import { IntegrationToken } from '../types/integration-token.type.ts';

/**
 * core's query on IntegrationToken. It needs core.integration:manage at the company of the
 * request's plant, or in company settings at the company the request names (ADR 0073).
 */
@Resolver(() => IntegrationToken)
export class IntegrationTokenQueryResolver {
  constructor(@Inject(IntegrationTokenService) private readonly tokens: IntegrationTokenService) {}

  @Query(() => [IntegrationToken], {
    description:
      'The integration tokens of the company, revoked ones too, newest first, without their secrets. Needs core.integration:manage at the company.',
  })
  @PlantFree()
  coreIntegrationTokens(
    @Args('companyId', companyIdArg) companyId?: string | null,
  ): Promise<IntegrationTokenRecord[]> {
    return this.tokens.tokens(companyId ?? undefined);
  }
}
