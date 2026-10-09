// SPDX-License-Identifier: AGPL-3.0-or-later
import { HttpStatus, NotFoundException } from '@nestjs/common';
import { upsertArticle } from '@northmes/core-contracts';
import { registerCommand } from '@northmes/sdk/commands';
import { DomainError } from '@northmes/sdk/errors';
import { type Selectable, sql, type Updateable } from 'kysely';
import type { z } from 'zod';
import type { ArticleTable } from '../../infrastructure/database.ts';
import { forbidden } from '../access/request-scope.ts';
import { type ArticleRecord, selectArticles } from '../article-record.ts';
import { type PlantsPlan, planPlants, writePlants } from './article-plants.ts';
import { refuseArchived } from './article-target.ts';
import { requestCompany } from './company-scope.ts';
import type { CoreContext } from './context.ts';
import { createArticleHandler } from './create-article.handler.ts';

type UpsertArticleInput = z.output<typeof upsertArticle.input>;

/** True when the input names plants or All plants, rather than leaving them as they are. */
function namesPlants({ allPlants, plants }: UpsertArticleInput): boolean {
  return allPlants !== undefined || plants !== undefined;
}

/** Whether a plan assigns the article elsewhere than its row and its assignments say. */
async function plantsDiffer(
  { tx }: Pick<CoreContext, 'tx'>,
  article: Selectable<ArticleTable>,
  plan: PlantsPlan,
): Promise<boolean> {
  if (plan.allPlants !== article.all_plants) return true;
  const assigned = await tx
    .selectFrom('core.article_plant')
    .select('plant_id')
    .where('article_id', '=', article.id)
    .execute();
  const current = new Set(assigned.map(({ plant_id }) => plant_id));
  return current.size !== plan.plantIds.length || plan.plantIds.some((id) => !current.has(id));
}

/**
 * Locks the article for a change and checks the version the change was made on: the input's
 * expectedVersion, or the version the handler found (ADR 0012 step 5). A row the request reads
 * but does not write is core.forbidden, as the bus answers it.
 */
async function lockAt(
  { tx }: Pick<CoreContext, 'tx'>,
  article: Selectable<ArticleTable>,
  expectedVersion: number,
): Promise<void> {
  const locked = await tx
    .selectFrom('core.article')
    .select('version')
    .where('id', '=', article.id)
    .forUpdate()
    .executeTakeFirst();
  if (!locked) {
    throw forbidden(
      `Article ${article.id} is changed at scope ${article.edit_scope_id}, which this request does not write; open that plant or company settings`,
    );
  }
  if (locked.version !== expectedVersion) {
    throw new DomainError({
      code: 'core.version_conflict',
      status: HttpStatus.CONFLICT,
      message: `Article ${article.id} is at version ${locked.version}, and the change was made on version ${expectedVersion}`,
    });
  }
}

/**
 * The handler of core.upsertArticle (ADR 0073). Its scope hook is create's: the edit scope a new
 * article would have, where the bus checks core.article:create. The handler finds the article with
 * the input's article number in the company, without regard to case, under a lock on that number
 * so concurrent upserts of a new number create it once. None: it creates one as
 * core.createArticle does. An archived one: core.archived. An active one: a different name needs
 * core.article:update at the article's edit scope, and other plants need core.article:assign at
 * the company, both checked with context.require; the change is one update at the input's
 * expectedVersion or the version found, and an input without plants keeps the article's plants.
 * An unchanged article writes nothing and keeps its version.
 */
export const upsertArticleHandler = {
  scope: createArticleHandler.scope,

  async handle(input: UpsertArticleInput, context: CoreContext): Promise<ArticleRecord> {
    const { tx } = context;
    const companyId = await requestCompany(input, context);
    // The scope hook found no company, so the bus refused the command before the handler runs.
    if (!companyId) throw new NotFoundException(`Article ${input.code} was not found`);
    // Postgres lowers the number for the lock and the lookup as it does for the stored code_key;
    // JavaScript's toLowerCase differs for some letters, such as İ. Concurrent upserts of one new
    // number wait on the lock, so the second finds the article the first one created instead of
    // failing on its number with core.code_taken.
    await sql`select pg_advisory_xact_lock(hashtextextended(${`core.article-code:${companyId}:`} || lower(${input.code}), 0))`.execute(
      tx,
    );
    const found = await tx
      .selectFrom('core.article')
      .selectAll()
      .where('company_id', '=', companyId)
      .where('code_key', '=', sql<string>`lower(${input.code})`)
      .executeTakeFirst();
    if (!found) return createArticleHandler.handle(input, context);
    refuseArchived(found);

    const changes: Updateable<ArticleTable> = {};
    if (input.name !== found.name) {
      context.require('core.article:update', found.edit_scope_id);
      changes.name = input.name;
    }
    const plan = namesPlants(input) ? await planPlants(tx, companyId, input) : undefined;
    const reassigns = plan !== undefined && (await plantsDiffer(context, found, plan));
    if (plan && reassigns) {
      context.require('core.article:assign', companyId);
      changes.all_plants = plan.allPlants;
      changes.edit_scope_id = plan.editScopeId;
    }
    if (Object.keys(changes).length > 0) {
      await lockAt(context, found, input.expectedVersion ?? found.version);
      // The version trigger of core.article bumps version with the update, which also moves the
      // edit scope of the article's assignments along through their foreign key.
      await tx.updateTable('core.article').set(changes).where('id', '=', found.id).execute();
      if (plan && reassigns) await writePlants(tx, found.id, plan);
    }
    return selectArticles(tx).where('id', '=', found.id).executeTakeFirstOrThrow();
  },
};

/** core.upsertArticle as the bus runs it, which ArticleService.upsertByCode sends. */
export const UpsertArticleCommand = registerCommand(upsertArticle, upsertArticleHandler);
