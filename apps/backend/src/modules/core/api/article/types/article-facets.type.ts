// SPDX-License-Identifier: AGPL-3.0-or-later
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { StockUnit } from './article.type.ts';

/** How many listed articles have one article group, or none when id is null. */
@ObjectType('ArticleGroupCount', {
  description: 'How many listed articles have one article group, or no group when id is null.',
})
export class ArticleGroupCount {
  @Field(() => ID, {
    nullable: true,
    description: "The group's id, or null for the articles of no group.",
  })
  id!: string | null;
  @Field(() => String, {
    nullable: true,
    description: "The group's code, or null for the articles of no group.",
  })
  code!: string | null;
  @Field(() => String, {
    nullable: true,
    description: "The group's name, or null for the articles of no group.",
  })
  name!: string | null;
  @Field(() => Int, { description: 'How many listed articles have the group.' }) count!: number;
}

/** How many listed articles count in one stock unit. */
@ObjectType('StockUnitCount', {
  description: 'How many listed articles count in one stock unit.',
})
export class StockUnitCount {
  @Field(() => StockUnit, { description: 'The stock unit.' }) stockUnit!: string;
  @Field(() => Int, { description: 'How many listed articles count in the unit.' })
  count!: number;
}

/** How many listed articles came from one source, or from NorthMES when source is null. */
@ObjectType('SourceCount', {
  description:
    'How many listed articles came from one source, or from NorthMES when source is null.',
})
export class SourceCount {
  @Field(() => String, {
    nullable: true,
    description: 'The integration that created the articles, or null for NorthMES.',
  })
  source!: string | null;
  @Field(() => Int, { description: 'How many listed articles came from the source.' })
  count!: number;
}

/**
 * The values of the articles list's filter fields with how many listed articles have each (design
 * ui-222, LI3): each field counted under the search, Show archived and the other fields' filters,
 * but not its own, so its menu still offers every value.
 */
@ObjectType('ArticleFacets', {
  description:
    "The values of the articles list's filter fields with how many articles have each. Each field is counted under the search and the other fields' filters, but not its own.",
})
export class ArticleFacets {
  @Field(() => Int, { description: 'How many articles the list holds with every filter applied.' })
  total!: number;
  @Field(() => [ArticleGroupCount], {
    description: "The article groups, by the group's name, then the articles of no group.",
  })
  articleGroups!: ArticleGroupCount[];
  @Field(() => [StockUnitCount], { description: "The stock units, in the unit catalog's order." })
  stockUnits!: StockUnitCount[];
  @Field(() => [SourceCount], { description: 'The sources, by name, then NorthMES.' })
  sources!: SourceCount[];
}
