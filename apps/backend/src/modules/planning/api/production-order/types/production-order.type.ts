// SPDX-License-Identifier: AGPL-3.0-or-later
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

/** An order to make a quantity of one article at one plant (GLOSSARY.md). */
@ObjectType('ProductionOrder')
export class ProductionOrder {
  @Field(() => ID) id!: string;
  @Field(() => String) number!: string;
  /** Decimal text with six decimals, until a decimal scalar is chosen (open item M-34). */
  @Field(() => String) quantity!: string;
  /** planned or released. */
  @Field(() => String) status!: string;
  /** Grows by one with every change to the order. */
  @Field(() => Int) version!: number;
}
