// SPDX-License-Identifier: AGPL-3.0-or-later
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

/** An order to make a quantity of one article at one plant (GLOSSARY.md). */
@ObjectType('ProductionOrder', {
  description: 'An order to make a quantity of one article at one plant.',
})
export class ProductionOrder {
  @Field(() => ID, { description: "The order's id." }) id!: string;
  @Field(() => String, { description: 'The order number.' }) number!: string;
  /** Decimal text until a decimal scalar is chosen (open item M-34). */
  @Field(() => String, {
    description: "The quantity to make in the article's unit, as decimal text with six decimals.",
  })
  quantity!: string;
  @Field(() => String, { description: 'Where the order stands: planned or released.' })
  status!: string;
  @Field(() => Int, {
    description:
      'Grows by one with every change to the order; planningReleaseProductionOrder sends it as expectedVersion.',
  })
  version!: number;
}
