// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Field, GraphQLISODateTime, ID, Int, ObjectType } from '@nestjs/graphql';

/**
 * A customer of the company: a register of the company, which every plant reads (story E06-S07).
 * It holds the customer number and name only.
 */
@ObjectType('Customer', {
  description:
    'A customer of the company, a buyer of its products, identified by its customer number.',
})
export class Customer {
  @Field(() => ID, { description: "The customer's id." }) id!: string;
  @Field(() => String, { description: 'The customer number, unique within the company.' })
  code!: string;
  @Field(() => String, { description: "The customer's name." }) name!: string;
  @Field(() => Int, { description: 'Grows by one with every change to the customer.' })
  version!: number;
  @Field(() => GraphQLISODateTime, {
    description: 'When the customer last changed, its creation included.',
  })
  updatedAt!: Date;
}
