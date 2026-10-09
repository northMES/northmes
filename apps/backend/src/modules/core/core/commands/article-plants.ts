// SPDX-License-Identifier: AGPL-3.0-or-later
import { HttpStatus } from '@nestjs/common';
import { DomainError } from '@northmes/sdk/errors';
import type { Transaction } from 'kysely';
import type { CoreDatabase } from '../../infrastructure/database.ts';

/** The plants an article is assigned to, as a command input names them (ADR 0073). */
export interface PlantsInput {
  readonly allPlants?: boolean | undefined;
  /** Plant slugs. */
  readonly plants?: readonly string[] | undefined;
}

/** Where an article is used, with the plants as scope ids, and the edit scope that follows. */
export interface PlantsPlan {
  readonly companyId: string;
  readonly allPlants: boolean;
  /** The scope ids of the plants, in the order the input named them. */
  readonly plantIds: readonly string[];
  /** The one plant the article is assigned to, or the company otherwise. */
  readonly editScopeId: string;
}

/** The edit scope of an article with these plants: its one plant, or the company otherwise. */
export function editScopeOf(companyId: string, allPlants: boolean, plantIds: readonly string[]) {
  const [only] = plantIds;
  return !allPlants && plantIds.length === 1 && only !== undefined ? only : companyId;
}

/** The company of the plant at `plantId`, or undefined for a scope that is not a plant. */
export async function companyOfPlant(
  tx: Transaction<CoreDatabase>,
  plantId: string,
): Promise<string | undefined> {
  return (
    await tx
      .selectFrom('core.plant')
      .select('company_id')
      .where('id', '=', plantId)
      .executeTakeFirst()
  )?.company_id;
}

/**
 * The plan of the plants that `input` names in the company: All plants, or the plants by slug. A
 * slug that names no plant of the company is refused with BAD_USER_INPUT on its place in plants.
 */
export async function planPlants(
  tx: Transaction<CoreDatabase>,
  companyId: string,
  { allPlants = false, plants = [] }: PlantsInput,
): Promise<PlantsPlan> {
  const slugs = [...new Set(plants)];
  const found =
    slugs.length === 0
      ? []
      : await tx
          .selectFrom('core.plant')
          .select(['id', 'slug'])
          .where('company_id', '=', companyId)
          .where('slug', 'in', slugs)
          .execute();
  const idOf = new Map(found.map(({ id, slug }) => [slug, id]));
  const unknown = plants.flatMap((slug, index) => (idOf.has(slug) ? [] : [{ slug, index }]));
  if (unknown.length > 0) {
    const message = (slug: string) => `No plant of the company has the slug ${slug}.`;
    throw new DomainError({
      code: 'core.plant_unknown',
      status: HttpStatus.BAD_REQUEST,
      message: unknown.map(({ slug }) => message(slug)).join(' '),
      fieldErrors: unknown.map(({ slug, index }) => ({
        path: ['plants', index],
        message: message(slug),
        code: 'core.plant_unknown',
      })),
    });
  }
  const plantIds = slugs.map((slug) => idOf.get(slug) ?? '');
  return {
    companyId,
    allPlants,
    plantIds,
    editScopeId: editScopeOf(companyId, allPlants, plantIds),
  };
}

/**
 * Writes an article's assignments for `plan`, after removing those it had: one core.article_plant
 * row per plant, with the article's scope and edit scope. The caller has set the article's
 * all_plants and edit_scope_id to the plan's.
 */
export async function writePlants(
  tx: Transaction<CoreDatabase>,
  articleId: string,
  plan: PlantsPlan,
): Promise<void> {
  await tx.deleteFrom('core.article_plant').where('article_id', '=', articleId).execute();
  if (plan.plantIds.length === 0) return;
  await tx
    .insertInto('core.article_plant')
    .values(
      plan.plantIds.map((plantId) => ({
        article_id: articleId,
        plant_id: plantId,
        scope_id: plan.companyId,
        edit_scope_id: plan.editScopeId,
      })),
    )
    .execute();
}
