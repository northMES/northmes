// SPDX-License-Identifier: AGPL-3.0-or-later
import { currentPrincipal } from '../../../../principal.ts';
import type { CoreContext } from './context.ts';

/** What the scope hook reads of a command's input: the company that company settings name. */
interface CompanyInput {
  readonly companyId?: string;
}

/**
 * The scope hook of a command that writes at a company, such as a role or a user (ADR 0012): the
 * company's scope id, where the bus checks the command's permission. At a plant it is the plant's
 * company, and an input that names another company finds none; in company settings, a request
 * without a plant, it is the company the input names (ADR 0066), or else the one the principal acts
 * at (ADR 0073). Undefined, which the bus refuses
 * with core.forbidden, when neither names one.
 */
export async function requestCompany(
  input: unknown,
  { tx, plantId }: Pick<CoreContext, 'tx' | 'plantId'>,
): Promise<string | undefined> {
  const asked =
    (input as CompanyInput | undefined)?.companyId ?? currentPrincipal()?.companyId ?? undefined;
  if (!plantId) return asked;
  const plant = await tx
    .selectFrom('core.scope')
    .select('company_id')
    .where('id', '=', plantId)
    .executeTakeFirst();
  if (asked !== undefined && asked !== plant?.company_id) return undefined;
  return plant?.company_id;
}
