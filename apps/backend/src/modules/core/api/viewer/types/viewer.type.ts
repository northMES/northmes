// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Field, ID, ObjectType } from '@nestjs/graphql';

/** What the signed-in user holds at one plant (ADR 0091). */
@ObjectType('ViewerPlant', { description: 'What the signed-in user holds at one plant.' })
export class ViewerPlant {
  @Field(() => ID, { description: "The plant's scope id." }) plantId!: string;
  @Field(() => [String], {
    description:
      'The permission keys the user holds at the plant, from roles there or at its company, sorted.',
  })
  permissions!: string[];
}

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
  @Field(() => [ViewerPlant], {
    description:
      "What the user holds at each plant the request reads: the request's plant, or without a plant each plant of the company the user may open.",
  })
  plants!: ViewerPlant[];
}
