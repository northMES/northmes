// SPDX-License-Identifier: AGPL-3.0-or-later
import { NotFoundException } from '@nestjs/common';
import { createArticle } from '@northmes/core-contracts';
import { registerCommand } from '@northmes/sdk/commands';
import type { z } from 'zod';
import { type ArticleRecord, selectArticles } from '../article-record.ts';
import { companyOfPlant, type PlantsPlan, planPlants, writePlants } from './article-plants.ts';
import type { CoreContext } from './context.ts';

type CreateArticleInput = z.output<typeof createArticle.input>;

/** True when the input names plants or All plants, rather than leaving them to the default. */
function namesPlants({ allPlants, plants }: CreateArticleInput): boolean {
  return allPlants !== undefined || plants !== undefined;
}

/**
 * Where a new article is used: the plants or All plants that the input names, or else the
 * request's plant (ADR 0073). undefined for a request without a plant, which has no company.
 */
async function planOf(
  input: CreateArticleInput,
  { tx, plantId }: Pick<CoreContext, 'tx' | 'plantId'>,
): Promise<PlantsPlan | undefined> {
  if (!plantId) return undefined;
  const companyId = await companyOfPlant(tx, plantId);
  if (!companyId) return undefined;
  if (!namesPlants(input)) {
    return { companyId, allPlants: false, plantIds: [plantId], editScopeId: plantId };
  }
  return planPlants(tx, companyId, input);
}

/** True when the plan is the request's plant alone, which needs no core.article:assign. */
function isDefault(plan: PlantsPlan, plantId: string): boolean {
  return !plan.allPlants && plan.plantIds.length === 1 && plan.plantIds[0] === plantId;
}

/**
 * The handler of core.createArticle (ADR 0012). Its scope hook returns the edit scope the new
 * article will have, where the bus checks core.article:create: the request's plant by default, or
 * the company for an article of several plants or All plants (ADR 0073). Plants other than the
 * request's plant also need core.article:assign at the company. It writes the article at its
 * company's node under the client's id with its plants and returns it with version 1, or returns
 * the article a first run with that id created.
 */
export const createArticleHandler = {
  async scope(input: CreateArticleInput, context: Pick<CoreContext, 'tx' | 'plantId'>) {
    return (await planOf(input, context))?.editScopeId;
  },

  async handle(input: CreateArticleInput, context: CoreContext): Promise<ArticleRecord> {
    const { tx, plantId } = context;
    const plan = await planOf(input, context);
    // The scope hook found no plan, so the bus refused the command before the handler runs.
    if (!plan || !plantId) throw new NotFoundException(`Article ${input.id} was not found`);
    if (!isDefault(plan, plantId)) context.require('core.article:assign', plan.companyId);
    const created = await tx
      .insertInto('core.article')
      .values({
        id: input.id,
        scope_id: plan.companyId,
        company_id: plan.companyId,
        scope_span: tx.selectFrom('core.scope').select('span').where('id', '=', plan.companyId),
        edit_scope_id: plan.editScopeId,
        all_plants: plan.allPlants,
        code: input.code,
        name: input.name,
      })
      .onConflict((conflict) => conflict.column('id').doNothing())
      .returning('id')
      .executeTakeFirst();
    if (created) await writePlants(tx, input.id, plan);
    // A retry after a timeout or a restart finds the article the first run created (ADR 0012).
    const article = await selectArticles(tx).where('id', '=', input.id).executeTakeFirst();
    if (!article) {
      // The id is taken in a company the principal cannot read.
      throw new NotFoundException(`Article ${input.id} was not found`);
    }
    return article;
  },
};

/** core.createArticle as the bus runs it, which ArticleService.create sends. */
export const CreateArticleCommand = registerCommand(createArticle, createArticleHandler);
