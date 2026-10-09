// SPDX-License-Identifier: AGPL-3.0-or-later
import { Field, GraphQLISODateTime, ID, Int, ObjectType } from '@nestjs/graphql';
import { Plant } from '../../company/types/plant.type.ts';

/**
 * Something the company makes or consumes, identified by its article number (GLOSSARY.md). Every
 * article belongs to the company and is assigned to plants (ADR 0073). Core owns the type; another
 * module returns it from a field of its own through core's API.
 */
@ObjectType('Article')
export class Article {
  @Field(() => ID) id!: string;
  /** The article number, unique within the company. */
  @Field(() => String) code!: string;
  @Field(() => String) name!: string;
  /**
   * The article is assigned to every plant of the company, those created later included
   * (ADR 0073). Its plants list is then empty.
   */
  @Field(() => Boolean) allPlants!: boolean;
  /**
   * The plants the article is assigned to, sorted by name. A plant's lists and pickers show only
   * the articles assigned to it or to All plants; an article with neither shows only in company
   * views.
   */
  @Field(() => [Plant]) plants!: Plant[];
  /** Grows by one with every change to the article; an update sends it as expectedVersion. */
  @Field(() => Int) version!: number;
  /**
   * When the article was archived, or null while it is active. An archived article is hidden from
   * coreArticles unless includeArchived is true, and cannot be changed until it is restored.
   */
  @Field(() => GraphQLISODateTime, { nullable: true }) archivedAt!: Date | null;
  /** When the article last changed, its creation included; the articles list sorts by it. */
  @Field(() => GraphQLISODateTime) updatedAt!: Date;
}
