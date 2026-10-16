// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Plant } from './plant.type.ts';

/** A company, the root of its scope tree and a Better Auth organization (ADR 0007). */
@ObjectType('Company', {
  description: 'The business that uses NorthMES and owns its plants and master data.',
})
export class Company {
  @Field(() => ID, { description: "The company's id, the id of its node in the scope tree." })
  id!: string;
  @Field(() => String, { description: "The company's name." }) name!: string;
  @Field(() => [Plant], {
    description: 'The plants of the company that the signed-in user may open, sorted by name.',
  })
  plants!: Plant[];
}
