// SPDX-License-Identifier: AGPL-3.0-or-later
import { Field, GraphQLISODateTime, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { type StockUnitCode, stockUnitCodes, unitOf } from '@northmes/contracts';
import { Plant } from '../../company/types/plant.type.ts';

/** The stock units of the unit catalog, by their codes (ADR 0023). */
const StockUnit = Object.fromEntries(stockUnitCodes.map((code) => [code, code])) as {
  readonly [Code in StockUnitCode]: Code;
};

registerEnumType(StockUnit, {
  name: 'StockUnit',
  description: 'A unit of the unit catalog that an article counts its quantities in (ADR 0023).',
  valuesMap: Object.fromEntries(
    stockUnitCodes.map((code) => [code, { description: unitOf(code).label }]),
  ),
});

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
  /** The unit the article's quantities are counted in, pieces unless someone chose another. */
  @Field(() => StockUnit) stockUnit!: string;
  /** A note on the article, or null. */
  @Field(() => String, { nullable: true }) note!: string | null;
  /**
   * The integration that created the article through coreUpsertArticle, such as Pyramid, or null
   * for an article created in NorthMES.
   */
  @Field(() => String, { nullable: true }) source!: string | null;
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
  /** When the article was created. */
  @Field(() => GraphQLISODateTime) createdAt!: Date;
  /** When the article last changed, its creation included; the articles list sorts by it. */
  @Field(() => GraphQLISODateTime) updatedAt!: Date;
}
