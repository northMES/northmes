// SPDX-License-Identifier: AGPL-3.0-or-later
import { NotFoundException } from '@nestjs/common';
import { createArticle } from '@northmes/core-contracts';
import { registerCommand } from '@northmes/sdk/commands';
import { noteCreated } from '@northmes/sdk/operations';
import type { z } from 'zod';
import { type ArticleRecord, selectArticles } from '../article-record.ts';
import { type PlantsPlan, planPlants, writePlants } from './article-plants.ts';
import { requestCompany } from './company-scope.ts';
import type { CoreContext } from './context.ts';

type CreateArticleInput = z.output<typeof createArticle.input>;

/** True when the input names plants or All plants, rather than leaving them to the default. */
function namesPlants({ allPlants, plants }: CreateArticleInput): boolean {
  return allPlants !== undefined || plants !== undefined;
}

/**
 * Where a new article is used: the plants or All plants that the input names, or else the
 * request's plant, or no plant in company settings, a request without a plant (ADR 0073).
 * undefined when the request names no company, or one other than its plant's.
 */
async function planOf(
  input: CreateArticleInput,
  context: Pick<CoreContext, 'tx' | 'plantId'>,
): Promise<PlantsPlan | undefined> {
  const companyId = await requestCompany(input, context);
  if (!companyId) return undefined;
  if (namesPlants(input)) return planPlants(context.tx, companyId, input);
  const plantIds = context.plantId ? [context.plantId] : [];
  return { companyId, allPlants: false, plantIds, editScopeId: plantIds[0] ?? companyId };
}

/**
 * True when the plan is the default, the request's plant alone or no plant in company settings,
 * which needs no core.article:assign.
 */
function isDefault(plan: PlantsPlan, plantId: string | undefined): boolean {
  if (plan.allPlants) return false;
  if (!plantId) return plan.plantIds.length === 0;
  return plan.plantIds.length === 1 && plan.plantIds[0] === plantId;
}

/**
 * The handler of core.createArticle (ADR 0012). Its scope hook returns the edit scope the new
 * article will have, where the bus checks core.article:create: the request's plant by default, or
 * the company for an article of several plants, of All plants or, from company settings, of none
 * (ADR 0073). Plants other than that default also need core.article:assign at the company. It
 * writes the article at its company's node under the client's id with its plants, notes that it
 * created a row, and returns it with version 1, or returns the article a first run with that id
 * created.
 */
export const createArticleHandler = {
  async scope(input: CreateArticleInput, context: Pick<CoreContext, 'tx' | 'plantId'>) {
    return (await planOf(input, context))?.editScopeId;
  },

  async handle(input: CreateArticleInput, context: CoreContext): Promise<ArticleRecord> {
    const { tx, plantId } = context;
    const plan = await planOf(input, context);
    // The scope hook found no plan, so the bus refused the command before the handler runs.
    if (!plan) throw new NotFoundException(`Article ${input.id} was not found`);
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
    if (created) {
      await writePlants(tx, input.id, plan);
      noteCreated();
    }
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
