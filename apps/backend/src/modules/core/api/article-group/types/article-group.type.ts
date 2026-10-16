// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { Field, GraphQLISODateTime, ID, Int, ObjectType } from '@nestjs/graphql';
import { Translation } from '@northmes/sdk/graphql';

/**
 * A group of articles, such as Flanges or Consumables: a register of the company, which every
 * plant reads and the company changes (maintainer, 2026-10-09). Each article picks one or none.
 */
@ObjectType('ArticleGroup')
export class ArticleGroup {
  @Field(() => ID) id!: string;
  /** The group's code, unique within the company. */
  @Field(() => String) code!: string;
  @Field(() => String) name!: string;
  /** The translations of the name, in the order they were saved. */
  @Field(() => [Translation]) translations!: Translation[];
  /** Grows by one with every change to the group; an update sends it as expectedVersion. */
  @Field(() => Int) version!: number;
  /**
   * When the group was archived, or null while it is active. An archived group is hidden from
   * coreArticleGroups unless includeArchived is true, and no article can pick it.
   */
  @Field(() => GraphQLISODateTime, { nullable: true }) archivedAt!: Date | null;
  /** When the group last changed, its creation included. */
  @Field(() => GraphQLISODateTime) updatedAt!: Date;
}
