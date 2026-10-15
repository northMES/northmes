// SPDX-License-Identifier: AGPL-3.0-or-later
import { Field, ID, ObjectType } from '@nestjs/graphql';

/** The signed-in user and what they hold at the request's plant and at its company (ADR 0010). */
@ObjectType('Viewer', {
  description: "The signed-in user and what they hold at the request's plant and at its company.",
})
export class Viewer {
  @Field(() => ID, { description: "The signed-in user's id." }) userId!: string;
  @Field(() => [String], {
    description:
      'The permission keys the user holds at the plant, from roles there or at its company, sorted.',
  })
  plantPermissions!: string[];
  @Field(() => [String], {
    description: "The permission keys the user holds at the plant's company, sorted.",
  })
  companyPermissions!: string[];
}
