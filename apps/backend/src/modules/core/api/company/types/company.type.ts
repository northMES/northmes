// SPDX-License-Identifier: AGPL-3.0-or-later
import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Plant } from './plant.type.ts';

/** A company, the root of its scope tree and a Better Auth organization (ADR 0007). */
@ObjectType('Company')
export class Company {
  /** The company's id, the id of its node in the scope tree. */
  @Field(() => ID) id!: string;
  @Field(() => String) name!: string;
  /** The plants of the company that the signed-in user may open, sorted by name. */
  @Field(() => [Plant]) plants!: Plant[];
}
