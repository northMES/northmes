// SPDX-License-Identifier: AGPL-3.0-or-later
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { StockUnit } from './article.type.ts';

/** How many listed articles have one article group, or none when id is null. */
@ObjectType('ArticleGroupCount')
export class ArticleGroupCount {
  /** The group's id, or null for the articles of no group. */
  @Field(() => ID, { nullable: true }) id!: string | null;
  @Field(() => String, { nullable: true }) code!: string | null;
  @Field(() => String, { nullable: true }) name!: string | null;
  @Field(() => Int) count!: number;
}

/** How many listed articles count in one stock unit. */
@ObjectType('StockUnitCount')
export class StockUnitCount {
  @Field(() => StockUnit) stockUnit!: string;
  @Field(() => Int) count!: number;
}

/** How many listed articles came from one source, or from NorthMES when source is null. */
@ObjectType('SourceCount')
export class SourceCount {
  /** The integration that created the articles, or null for NorthMES. */
  @Field(() => String, { nullable: true }) source!: string | null;
  @Field(() => Int) count!: number;
}

/**
 * The values of the articles list's filter fields with how many listed articles have each (design
 * ui-222, LI3): each field counted under the search, Show archived and the other fields' filters,
 * but not its own, so its menu still offers every value.
 */
@ObjectType('ArticleFacets')
export class ArticleFacets {
  /** How many articles the list holds with every filter applied. */
  @Field(() => Int) total!: number;
  /** By the group's name, then the articles of no group. */
  @Field(() => [ArticleGroupCount]) articleGroups!: ArticleGroupCount[];
  /** In the unit catalog's order. */
  @Field(() => [StockUnitCount]) stockUnits!: StockUnitCount[];
  /** By name, then NorthMES. */
  @Field(() => [SourceCount]) sources!: SourceCount[];
}
