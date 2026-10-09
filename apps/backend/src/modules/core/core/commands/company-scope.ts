// SPDX-License-Identifier: AGPL-3.0-or-later
import type { CoreContext } from './context.ts';

/**
 * The scope hook of a command that writes at the company of the request's plant, such as a role or
 * a user (ADR 0012): the company's scope id, where the bus checks the command's permission, or
 * undefined for a request without a plant, which the bus refuses with core.forbidden.
 */
export async function companyOfPlant(
  _input: unknown,
  { tx, plantId }: Pick<CoreContext, 'tx' | 'plantId'>,
): Promise<string | undefined> {
  if (!plantId) return undefined;
  const plant = await tx
    .selectFrom('core.scope')
    .select('company_id')
    .where('id', '=', plantId)
    .executeTakeFirst();
  return plant?.company_id;
}
