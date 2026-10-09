// SPDX-License-Identifier: AGPL-3.0-or-later
import { Field, GraphQLISODateTime, ID, Int, ObjectType } from '@nestjs/graphql';

/**
 * Something the company makes or consumes, identified by its article number (GLOSSARY.md). Core
 * owns the type; another module returns it from a field of its own through core's API.
 */
@ObjectType('Article')
export class Article {
  @Field(() => ID) id!: string;
  /** The article number, unique at the article's scope. */
  @Field(() => String) code!: string;
  @Field(() => String) name!: string;
  /** Grows by one with every change to the article; an update sends it as expectedVersion. */
  @Field(() => Int) version!: number;
  /**
   * When the article was archived, or null while it is active. An archived article is hidden from
   * coreArticles unless includeArchived is true, and cannot be changed until it is restored.
   */
  @Field(() => GraphQLISODateTime, { nullable: true }) archivedAt!: Date | null;
}
