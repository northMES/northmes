// SPDX-License-Identifier: AGPL-3.0-or-later
import { Field, ID, ObjectType } from '@nestjs/graphql';

/** A site of a company where production happens (GLOSSARY.md), at a plant node (ADR 0007). */
@ObjectType('Plant')
export class Plant {
  /** The plant's id, the id of its node in the scope tree. */
  @Field(() => ID) id!: string;
  /** The plant's segment of the web's URLs, unique per installation; x-northmes-plant names it. */
  @Field(() => String) slug!: string;
  @Field(() => String) name!: string;
}
