// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import type { CreatedIntegrationTokenRecord } from '../../../core/commands/create-integration-token.handler.ts';
import { CreatedIntegrationToken } from '../types/created-integration-token.type.ts';

/**
 * The secret of a token that coreCreateIntegrationToken created. The record holds it as a Secret,
 * which reads as [redacted] when it is logged or serialized, so only this field reveals it, in the
 * one answer that shows it.
 */
@Resolver(() => CreatedIntegrationToken)
export class CreatedIntegrationTokenFieldResolver {
  @ResolveField(() => String)
  secret(@Parent() created: CreatedIntegrationTokenRecord): string {
    return created.secret.reveal();
  }
}
