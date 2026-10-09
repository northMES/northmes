// SPDX-License-Identifier: AGPL-3.0-or-later
import { setArticlePlants } from '@northmes/core-contracts';
import { registerCommand } from '@northmes/sdk/commands';
import type { z } from 'zod';
import { type ArticleRecord, selectArticles } from '../article-record.ts';
import { planPlants, writePlants } from './article-plants.ts';
import { type ArticleRow, articleAtCompanyTarget, refuseArchived } from './article-target.ts';
import type { CoreContext } from './context.ts';

/**
 * The handler of core.setArticlePlants (ADR 0073), which the bus checks at the article's company,
 * where core.article:assign is held. It replaces the article's plants with the input's, or with All
 * plants, recomputes its edit scope and returns it with its new version. A plant taken off keeps
 * its rows that use the article. An archived article is refused with core.archived.
 */
export const setArticlePlantsHandler = {
  target: articleAtCompanyTarget,
  async handle(
    { id, allPlants, plants }: z.output<typeof setArticlePlants.input>,
    { tx, target }: CoreContext<ArticleRow>,
  ): Promise<ArticleRecord> {
    refuseArchived(target);
    const plan = await planPlants(tx, target.companyId, { allPlants, plants });
    // The version trigger of core.article bumps version with the update, which also moves the
    // edit scope of the article's assignments along through their foreign key.
    await tx
      .updateTable('core.article')
      .set({ all_plants: plan.allPlants, edit_scope_id: plan.editScopeId })
      .where('id', '=', id)
      .execute();
    await writePlants(tx, id, plan);
    return selectArticles(tx).where('id', '=', id).executeTakeFirstOrThrow();
  },
};

/** core.setArticlePlants as the bus runs it, which ArticleService.setPlants sends. */
export const SetArticlePlantsCommand = registerCommand(setArticlePlants, setArticlePlantsHandler);
