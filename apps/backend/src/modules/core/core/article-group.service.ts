// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  archiveArticleGroup,
  createArticleGroup,
  type findArticleGroups,
  restoreArticleGroup,
  updateArticleGroup,
} from '@northmes/core-contracts';
import { COMMAND_BUS, type CommandBus, parseCommandInput } from '@northmes/sdk/commands';
import { DATABASE, type ScopedDatabase } from '@northmes/sdk/data';
import { DomainError } from '@northmes/sdk/errors';
import type { Connection, ListPage } from '@northmes/sdk/lists';
import type { Transaction } from 'kysely';
import type { z } from 'zod';
import {
  type ArticleGroupListArgs,
  articleGroupList,
} from '../api/article-group/queries/article-group.list.ts';
import type { CoreDatabase } from '../infrastructure/database.ts';
import { type RequestScope, readAsRequest, readIn, requestScope } from './access/request-scope.ts';
import { type ArticleGroupRecord, selectArticleGroups } from './article-group-record.ts';
import { ArchiveArticleGroupCommand } from './commands/archive-article-group.handler.ts';
import { CreateArticleGroupCommand } from './commands/create-article-group.handler.ts';
import { RestoreArticleGroupCommand } from './commands/restore-article-group.handler.ts';
import { UpdateArticleGroupCommand } from './commands/update-article-group.handler.ts';

export type { ArticleGroupRecord };

/** What core.findArticleGroups asks of a page. */
export type FindArticleGroupsInput = z.output<typeof findArticleGroups.input>;

/** The article groups of the company that `scope` reads. */
function ofCompany(scope: RequestScope) {
  return (tx: Transaction<CoreDatabase>) =>
    selectArticleGroups(tx).where('company_id', '=', scope.companyId);
}

/**
 * Core's article groups, a register of the company (maintainer, 2026-10-09). Reads go through the
 * ScopedDatabase and need core.articleGroup:read at the request's plant, or in company settings
 * at the company the request names. Each write parses its input with the command's contract and
 * sends the command through the command bus (ADR 0012). Every surface calls these methods.
 */
@Injectable()
export class ArticleGroupService {
  constructor(
    @Inject(DATABASE) private readonly db: ScopedDatabase<CoreDatabase>,
    @Inject(COMMAND_BUS) private readonly bus: CommandBus,
  ) {}

  /** The article group with this id among the company's, or null. */
  async byId(id: string, companyId?: string): Promise<ArticleGroupRecord | null> {
    const scope = requestScope('core.articleGroup:read', companyId);
    const group = await readIn(scope, () =>
      this.db.transaction((tx) => ofCompany(scope)(tx).where('id', '=', id).executeTakeFirst()),
    );
    return group ?? null;
  }

  /**
   * The article groups with these ids in one query, one entry per id in the order of the ids: the
   * group, or null when none exists where the request reads, in company settings too. It checks no
   * permission, because an article's field reads its group through it.
   */
  async byIds(ids: readonly string[]): Promise<(ArticleGroupRecord | null)[]> {
    if (ids.length === 0) return [];
    const groups = await readAsRequest(() =>
      this.db.transaction((tx) => selectArticleGroups(tx).where('id', 'in', ids).execute()),
    );
    const byId = new Map(groups.map((group) => [group.id, group]));
    return ids.map((id) => byId.get(id) ?? null);
  }

  /** The article group with this id, as byId reads it, or core.not_found (ADR 0073). */
  async byIdOrThrow(id: string): Promise<ArticleGroupRecord> {
    const group = await this.byId(id);
    if (!group) {
      throw new DomainError({
        code: 'core.not_found',
        status: HttpStatus.NOT_FOUND,
        message: `Article group ${id} was not found`,
      });
    }
    return group;
  }

  /** One page of the company's article groups, as coreArticleGroups' arguments ask. */
  async list(
    args: ArticleGroupListArgs,
    companyId?: string,
  ): Promise<Connection<ArticleGroupRecord>> {
    const scope = requestScope('core.articleGroup:read', companyId);
    const page = await readIn(scope, () => articleGroupList.page(this.db, ofCompany(scope), args));
    return { ...page, count: () => readIn(scope, () => page.count()) };
  }

  /** One page of the company's article groups as core.findArticleGroups asks (ADR 0073). */
  async find(input: FindArticleGroupsInput): Promise<ListPage<ArticleGroupRecord>> {
    const scope = requestScope('core.articleGroup:read');
    return readIn(scope, () => articleGroupList.find(this.db, ofCompany(scope), input));
  }

  /** Creates an article group: core.createArticleGroup with this input. */
  create(input: unknown): Promise<ArticleGroupRecord> {
    return this.bus.run(
      CreateArticleGroupCommand.command,
      parseCommandInput(createArticleGroup, input),
    );
  }

  /** Changes an article group: core.updateArticleGroup with this input. */
  update(input: unknown): Promise<ArticleGroupRecord> {
    return this.bus.run(
      UpdateArticleGroupCommand.command,
      parseCommandInput(updateArticleGroup, input),
    );
  }

  /** Archives an article group: core.archiveArticleGroup with this input. */
  archive(input: unknown): Promise<ArticleGroupRecord> {
    return this.bus.run(
      ArchiveArticleGroupCommand.command,
      parseCommandInput(archiveArticleGroup, input),
    );
  }

  /** Restores an archived article group: core.restoreArticleGroup with this input. */
  restore(input: unknown): Promise<ArticleGroupRecord> {
    return this.bus.run(
      RestoreArticleGroupCommand.command,
      parseCommandInput(restoreArticleGroup, input),
    );
  }
}
