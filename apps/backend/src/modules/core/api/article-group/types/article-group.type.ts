// SPDX-License-Identifier: AGPL-3.0-or-later
import { Field, GraphQLISODateTime, ID, Int, ObjectType } from '@nestjs/graphql';
import { Translation } from '@northmes/sdk/graphql';

/**
 * A group of articles, such as Flanges or Consumables: a register of the company, which every
 * plant reads and the company changes (maintainer, 2026-10-09). Each article picks one or none.
 */
@ObjectType('ArticleGroup', {
  description:
    'A group of articles of the company, such as Flanges or Consumables. Each article has one group or none.',
})
export class ArticleGroup {
  @Field(() => ID, { description: "The group's id." }) id!: string;
  @Field(() => String, { description: "The group's code, unique within the company." })
  code!: string;
  @Field(() => String, { description: "The group's name." }) name!: string;
  @Field(() => [Translation], {
    description: 'The translations of the name, in the order they were saved.',
  })
  translations!: Translation[];
  @Field(() => Int, {
    description:
      'Grows by one with every change to the group; an update sends it as expectedVersion.',
  })
  version!: number;
  @Field(() => GraphQLISODateTime, {
    nullable: true,
    description:
      'When the group was archived, or null while it is active. An archived group is hidden from coreArticleGroups unless includeArchived is true, and no article can pick it.',
  })
  archivedAt!: Date | null;
  @Field(() => GraphQLISODateTime, {
    description: 'When the group last changed, its creation included.',
  })
  updatedAt!: Date;
}
