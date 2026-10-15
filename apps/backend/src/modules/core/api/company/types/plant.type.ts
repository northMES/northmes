// SPDX-License-Identifier: AGPL-3.0-or-later
import { Field, ID, ObjectType } from '@nestjs/graphql';

/** A site of a company where production happens (GLOSSARY.md), at a plant node (ADR 0007). */
@ObjectType('Plant', { description: 'One production site of a company.' })
export class Plant {
  @Field(() => ID, { description: "The plant's id, the id of its node in the scope tree." })
  id!: string;
  @Field(() => String, {
    description:
      "The plant's segment of the web's URLs, unique per installation. The x-northmes-plant header names a plant by it.",
  })
  slug!: string;
  @Field(() => String, { description: "The plant's name." }) name!: string;
}
