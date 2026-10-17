// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Field, ObjectType } from '@nestjs/graphql';
import { IntegrationToken } from './integration-token.type.ts';

/** An integration token that coreCreateIntegrationToken created, with its secret to pass on once. */
@ObjectType('CreatedIntegrationToken', {
  description:
    'An integration token that coreCreateIntegrationToken created, with its secret to pass on once.',
})
export class CreatedIntegrationToken {
  @Field(() => IntegrationToken, { description: 'The new token.' }) token!: IntegrationToken;
  @Field(() => String, {
    description:
      "The token's secret, which only this answer holds: NorthMES stores its hash and cannot show it again. The outside system sends it as Authorization: Bearer.",
  })
  secret!: string;
}
