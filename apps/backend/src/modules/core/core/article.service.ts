// SPDX-License-Identifier: AGPL-3.0-or-later
import { HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type StockUnitCode, stockUnitCodes } from '@northmes/contracts';
import {
  archiveArticle,
  createArticle,
  type findArticles,
  restoreArticle,
  setArticlePlants,
  updateArticle,
  upsertArticle,
} from '@northmes/core-contracts';
import { COMMAND_BUS, type CommandBus, parseCommandInput } from '@northmes/sdk/commands';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import { DomainError } from '@northmes/sdk/errors';
import type { Connection, ListPage } from '@northmes/sdk/lists';
import { type SqlBool, sql, type Transaction } from 'kysely';
import type { z } from 'zod';
import { currentPrincipal } from '../../../principal.ts';
import { type ArticleListArgs, articleList } from '../api/article/queries/article.list.ts';
import type { CoreDatabase } from '../infrastructure/database.ts';
import { type RequestScope, readIn, requestScope } from './access/request-scope.ts';
import { type ArticleGroupRef, type ArticleRecord, selectArticles } from './article-record.ts';
import { ArchiveArticleCommand } from './commands/archive-article.handler.ts';
import { CreateArticleCommand } from './commands/create-article.handler.ts';
import { RestoreArticleCommand } from './commands/restore-article.handler.ts';
import { SetArticlePlantsCommand } from './commands/set-article-plants.handler.ts';
import { UpdateArticleCommand } from './commands/update-article.handler.ts';
import { UpsertArticleCommand } from './commands/upsert-article.handler.ts';

export type { ArticleRecord };

/**
 * The filter fields of the articles list that keep any of several values (design ui-222, LI3): a
 * null article group is no group, and a null source is NorthMES. A field left out keeps every
 * article.
 */
export interface ArticleValueFilters {
  readonly articleGroupIds?: readonly (string | null)[] | undefined;
  readonly stockUnits?: readonly StockUnitCode[] | undefined;
  readonly sources?: readonly (string | null)[] | undefined;
}

/** What coreArticles reads besides its list arguments (ADR 0073). */
export interface ArticleListScope extends ArticleValueFilters {
  /** The company of a request without a plant, from company settings or the public API. */
  readonly companyId?: string | undefined;
  /** Only the articles assigned to no plant and not to All plants. */
  readonly unassigned?: boolean | undefined;
}

/** What coreArticleFacets counts over: the list's search, Show archived and filter fields. */
export interface ArticleFacetsArgs extends ArticleValueFilters {
  readonly companyId?: string | undefined;
  readonly search?: string | null | undefined;
  readonly includeArchived?: boolean | null | undefined;
}

/** How many articles have one value of a filter field. */
export interface FacetCount<Value> {
  readonly value: Value;
  readonly count: number;
}

/**
 * The values of each filter field among the listed articles with how many have each, each field
 * counted under the other fields' filters but not its own, so its menu offers every value (design
 * ui-222, LI3); and how many articles the list holds.
 */
export interface ArticleFacets {
  readonly total: number;
  /** By the group's name, then no group. */
  readonly articleGroups: readonly FacetCount<ArticleGroupRef | null>[];
  /** In the catalog's order. */
  readonly stockUnits: readonly FacetCount<StockUnitCode>[];
  /** By name, then NorthMES. */
  readonly sources: readonly FacetCount<string | null>[];
}

/** A query on core.article, as the list kit and the reference check take it. */
type ArticleQuery = ReturnType<typeof selectArticles>;

/** What core.findArticles asks of a page (ADR 0073). */
export type FindArticlesInput = z.output<typeof findArticles.input>;

/** The articles a plant may pick: those assigned to it or to All plants (ADR 0073). */
function assignedTo(query: ArticleQuery, plantId: string): ArticleQuery {
  return query.where(
    sql<SqlBool>`(core.article.all_plants or exists (
      select 1 from core.article_plant ap
       where ap.article_id = core.article.id and ap.plant_id = ${plantId}))`,
  );
}

/** The articles assigned to no plant and not to All plants, which only company views show. */
function unassigned(query: ArticleQuery): ArticleQuery {
  return query.where(
    sql<SqlBool>`not core.article.all_plants and not exists (
      select 1 from core.article_plant ap where ap.article_id = core.article.id)`,
  );
}

/** The filter fields of the articles list (ADR 0073). */
interface ArticleFilters extends ArticleValueFilters {
  readonly code?: string | undefined;
  readonly unassigned?: boolean | undefined;
}

/** The rows whose column holds one of `values`, a null value matching a null column. */
function oneOf(
  query: ArticleQuery,
  column: 'article_group_id' | 'stock_unit' | 'source',
  values: readonly (string | null)[] | undefined,
): ArticleQuery {
  if (values === undefined) return query;
  const named = values.filter((value): value is string => value !== null);
  const orNull = values.includes(null);
  const ref = sql.ref(`core.article.${column}`);
  if (named.length === 0)
    return query.where(orNull ? sql<SqlBool>`${ref} is null` : sql<SqlBool>`false`);
  const inList = sql<SqlBool>`${ref}::text = any(${named}::text[])`;
  return query.where(orNull ? sql<SqlBool>`(${inList} or ${ref} is null)` : inList);
}

/**
 * The articles a list reads where `scope` reads: those of its company, at a plant only those
 * assigned to it or to All plants, narrowed by the filter fields.
 */
function listed(scope: RequestScope, filters: ArticleFilters) {
  return (tx: Transaction<CoreDatabase>) => {
    let rows = selectArticles(tx).where('company_id', '=', scope.companyId);
    if (scope.plantId !== undefined) rows = assignedTo(rows, scope.plantId);
    if (filters.code !== undefined) rows = rows.where('code', '=', filters.code);
    rows = oneOf(rows, 'article_group_id', filters.articleGroupIds);
    rows = oneOf(rows, 'stock_unit', filters.stockUnits);
    rows = oneOf(rows, 'source', filters.sources);
    return filters.unassigned === true ? unassigned(rows) : rows;
  };
}

/**
 * Refuses a new reference from a row at `plantId` to the article `articleId` with
 * core.article_not_assigned, unless the article is active and assigned to that plant or to All
 * plants (ADR 0073, changes to ADR 0009). A row of the company, without a plant, may reference any
 * active article of the company. An article the transaction does not read is not found. A command
 * of another module calls it in its own transaction, through core's public API, when it sets or
 * changes a reference to an article; rows that kept an article keep it.
 */
export async function requireArticleAssigned(
  tx: Transaction<CoreDatabase>,
  articleId: string,
  plantId: string | undefined,
): Promise<void> {
  const article = await tx
    .selectFrom('core.article')
    .select(['code', 'archived_at'])
    .select(
      plantId === undefined
        ? sql<boolean>`true`.as('assigned')
        : sql<boolean>`core.article.all_plants or exists (
            select 1 from core.article_plant ap
             where ap.article_id = core.article.id and ap.plant_id = ${plantId})`.as('assigned'),
    )
    .where('id', '=', articleId)
    .executeTakeFirst();
  if (!article) throw new NotFoundException(`Article ${articleId} was not found`);
  if (article.archived_at === null && article.assigned) return;
  throw new DomainError({
    code: 'core.article_not_assigned',
    status: HttpStatus.PRECONDITION_FAILED,
    message:
      article.archived_at === null
        ? `Article ${article.code} is not used at this plant, so a new row here cannot pick it`
        : `Article ${article.code} is archived, so a new row cannot pick it`,
  });
}

/**
 * Core's articles (ADR 0073). Reads go through the ScopedDatabase, so a caller sees only the
 * articles of the companies it reads. Each write parses its input with the command's contract and
 * sends the command through the command bus, which checks the permission, the version and the
 * validators (ADR 0012). Every surface calls these methods and holds no logic of its own: the
 * GraphQL resolvers now, the public REST routes and the agent tools later.
 */
@Injectable()
export class ArticleService {
  constructor(
    @Inject(DATABASE) private readonly db: ScopedDatabase<CoreDatabase>,
    @Inject(COMMAND_BUS) private readonly bus: CommandBus,
  ) {}

  /**
   * The article with this id among the articles of the company, or null, whether or not it is
   * assigned to the request's plant: a row that kept an article after its plant was removed still
   * shows it (ADR 0073). It needs core.article:read at the request's plant, or in company settings
   * at the company the request names, and is core.forbidden otherwise.
   */
  async byId(id: string, companyId?: string): Promise<ArticleRecord | null> {
    const scope = requestScope('core.article:read', companyId);
    const article = await readIn(scope, () =>
      this.db.transaction((tx) => selectArticles(tx).where('id', '=', id).executeTakeFirst()),
    );
    return article ?? null;
  }

  /**
   * The articles with these ids in one query, one entry per id in the order of the ids: the
   * article, or null when none exists at the principal's read scopes. It checks no permission,
   * because another module's field reads the articles of its own rows through it, such as the
   * article of a production order.
   */
  async byIds(ids: readonly string[]): Promise<(ArticleRecord | null)[]> {
    if (ids.length === 0) return [];
    const articles = await this.db.transaction((tx) =>
      selectArticles(tx).where('id', 'in', ids).execute(),
    );
    const byId = new Map(articles.map((article) => [article.id, article]));
    return ids.map((id) => byId.get(id) ?? null);
  }

  /**
   * One page of the articles, as coreArticles' arguments ask: at a plant, those assigned to it or
   * to All plants; without a plant, every article of the company the request names, unassigned
   * ones included (ADR 0073). Archived ones are left out unless includeArchived is true. It needs
   * core.article:read at the request's plant, or at the company, and is core.forbidden otherwise.
   */
  async list(
    args: ArticleListArgs,
    { companyId, ...filters }: ArticleListScope = {},
  ): Promise<Connection<ArticleRecord>> {
    const scope = requestScope('core.article:read', companyId);
    const query = listed(scope, filters);
    const page = await readIn(scope, () => articleList.page(this.db, query, args));
    // totalCount counts later, in its own resolver, so it reads where the page did.
    return { ...page, count: () => readIn(scope, () => page.count()) };
  }

  /**
   * The values of each filter field among the articles the list shows for these arguments, with
   * how many articles have each value, and how many it shows (design ui-222, LI3 and ST17): each
   * field is counted under the search, Show archived and the other fields' filters, but not its
   * own, so its menu still offers every value. A value no listed article has is left out. It needs
   * core.article:read as the list does.
   */
  async facets({
    companyId,
    search,
    includeArchived,
    ...filters
  }: ArticleFacetsArgs): Promise<ArticleFacets> {
    const scope = requestScope('core.article:read', companyId);
    const rowsWithout = (field: keyof ArticleValueFilters) =>
      articleList.listed(listed(scope, { ...filters, [field]: undefined }), {
        search,
        includeArchived,
      });
    const all = articleList.listed(listed(scope, filters), { search, includeArchived });
    return readIn(scope, () =>
      this.db.transaction(async (tx) => {
        const counted = (field: keyof ArticleValueFilters, column: string) =>
          sql<{ value: string | null; count: string }>`
            select _nm_value::text as value, count(*) as count
              from (${rowsWithout(field)(tx).select(sql.ref(`core.article.${column}`).as('_nm_value'))}) as listed
             group by _nm_value`.execute(tx);
        const [groups, units, sources, total] = await Promise.all([
          counted('articleGroupIds', 'article_group_id'),
          counted('stockUnits', 'stock_unit'),
          counted('sources', 'source'),
          sql<{ count: string }>`select count(*) as count from (${all(tx)}) as listed`.execute(tx),
        ]);
        const groupIds = groups.rows.flatMap(({ value }) => (value === null ? [] : [value]));
        const named =
          groupIds.length === 0
            ? []
            : await tx
                .selectFrom('core.article_group')
                .select(['id', 'code', 'name'])
                .where('id', 'in', groupIds)
                .execute();
        const byId = new Map(named.map((group) => [group.id, group]));
        const lastNull = <T>(a: FacetCount<T | null>, b: FacetCount<T | null>, order: number) =>
          a.value === null ? 1 : b.value === null ? -1 : order;
        return {
          total: Number(total.rows[0]?.count ?? 0),
          articleGroups: groups.rows
            .map(({ value, count }) => ({
              value: value === null ? null : (byId.get(value) ?? null),
              count: Number(count),
            }))
            .sort((a, b) =>
              lastNull(a, b, (a.value?.name ?? '').localeCompare(b.value?.name ?? '')),
            ),
          stockUnits: units.rows
            .map(({ value, count }) => ({ value: value as StockUnitCode, count: Number(count) }))
            .sort((a, b) => stockUnitCodes.indexOf(a.value) - stockUnitCodes.indexOf(b.value)),
          sources: sources.rows
            .map(({ value, count }) => ({ value, count: Number(count) }))
            .sort((a, b) => lastNull(a, b, (a.value ?? '').localeCompare(b.value ?? ''))),
        };
      }),
    );
  }

  /**
   * One page of the articles as core.findArticles asks (ADR 0073): the articles list reads, with
   * the filter fields code (exact match) and unassigned, answered as nodes and pageInfo. Without a
   * plant it reads the company the request's principal acts at.
   */
  async find(input: FindArticlesInput): Promise<ListPage<ArticleRecord>> {
    const scope = requestScope('core.article:read');
    const query = listed(scope, input);
    return readIn(scope, () => articleList.find(this.db, query, input));
  }

  /**
   * The article with this id among the articles of the company, as byId reads it, or
   * core.not_found when there is none (ADR 0073).
   */
  async byIdOrThrow(id: string): Promise<ArticleRecord> {
    const article = await this.byId(id);
    if (!article) {
      throw new DomainError({
        code: 'core.not_found',
        status: HttpStatus.NOT_FOUND,
        message: `Article ${id} was not found`,
      });
    }
    return article;
  }

  /** Creates an article: core.createArticle with this input. */
  create(input: unknown): Promise<ArticleRecord> {
    return this.bus.run(CreateArticleCommand.command, parseCommandInput(createArticle, input));
  }

  /** Changes an article's code and name: core.updateArticle with this input. */
  update(input: unknown): Promise<ArticleRecord> {
    return this.bus.run(UpdateArticleCommand.command, parseCommandInput(updateArticle, input));
  }

  /** Replaces an article's plants: core.setArticlePlants with this input. */
  setPlants(input: unknown): Promise<ArticleRecord> {
    return this.bus.run(
      SetArticlePlantsCommand.command,
      parseCommandInput(setArticlePlants, input),
    );
  }

  /** Archives an article: core.archiveArticle with this input. */
  archive(input: unknown): Promise<ArticleRecord> {
    return this.bus.run(ArchiveArticleCommand.command, parseCommandInput(archiveArticle, input));
  }

  /** Restores an archived article: core.restoreArticle with this input. */
  restore(input: unknown): Promise<ArticleRecord> {
    return this.bus.run(RestoreArticleCommand.command, parseCommandInput(restoreArticle, input));
  }

  /**
   * Creates or changes the article with the input's article number: core.upsertArticle with this
   * input (ADR 0073).
   */
  upsertByCode(input: unknown): Promise<ArticleRecord> {
    return this.bus.run(UpsertArticleCommand.command, parseCommandInput(upsertArticle, input));
  }

  /**
   * Refuses a new reference at the request's plant to this article with core.article_not_assigned
   * unless the article is active and assigned to the plant or to All plants, in a transaction of
   * its own. A command checks in its own transaction with requireArticleAssigned.
   */
  requireAssigned(articleId: string): Promise<void> {
    const plantId = currentPrincipal()?.plantId;
    return this.db.transaction((tx) => requireArticleAssigned(tx, articleId, plantId));
  }
}
