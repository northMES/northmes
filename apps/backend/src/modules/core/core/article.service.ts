// SPDX-License-Identifier: AGPL-3.0-or-later
import { HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  archiveArticle,
  createArticle,
  restoreArticle,
  setArticlePlants,
  updateArticle,
  upsertArticle,
} from '@northmes/core-contracts';
import { COMMAND_BUS, type CommandBus, parseCommandInput } from '@northmes/sdk/commands';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import { DomainError } from '@northmes/sdk/errors';
import type { Connection } from '@northmes/sdk/lists';
import { type SqlBool, sql, type Transaction } from 'kysely';
import { currentPrincipal } from '../../../principal.ts';
import { type ArticleListArgs, articleList } from '../api/article/queries/article.list.ts';
import type { CoreDatabase } from '../infrastructure/database.ts';
import { readIn, requestScope } from './access/request-scope.ts';
import { type ArticleRecord, selectArticles } from './article-record.ts';
import { ArchiveArticleCommand } from './commands/archive-article.handler.ts';
import { CreateArticleCommand } from './commands/create-article.handler.ts';
import { RestoreArticleCommand } from './commands/restore-article.handler.ts';
import { SetArticlePlantsCommand } from './commands/set-article-plants.handler.ts';
import { UpdateArticleCommand } from './commands/update-article.handler.ts';
import { UpsertArticleCommand } from './commands/upsert-article.handler.ts';

export type { ArticleRecord };

/** What coreArticles reads besides its list arguments (ADR 0073). */
export interface ArticleListScope {
  /** The company of a request without a plant, from company settings or the public API. */
  readonly companyId?: string | undefined;
  /** Only the articles assigned to no plant and not to All plants. */
  readonly unassigned?: boolean | undefined;
}

/** A query on core.article, as the list kit and the reference check take it. */
type ArticleQuery = ReturnType<typeof selectArticles>;

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
    { companyId, unassigned: onlyUnassigned }: ArticleListScope = {},
  ): Promise<Connection<ArticleRecord>> {
    const scope = requestScope('core.article:read', companyId);
    const query = (tx: Transaction<CoreDatabase>) => {
      let rows = selectArticles(tx).where('company_id', '=', scope.companyId);
      if (scope.plantId !== undefined) rows = assignedTo(rows, scope.plantId);
      return onlyUnassigned === true ? unassigned(rows) : rows;
    };
    const page = await readIn(scope, () => articleList.page(this.db, query, args));
    // totalCount counts later, in its own resolver, so it reads where the page did.
    return { ...page, count: () => readIn(scope, () => page.count()) };
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
