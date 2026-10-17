// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { NotFoundException } from '@nestjs/common';
import type { Selectable, Transaction } from 'kysely';
import { currentPrincipal } from '../../../../principal.ts';
import type { CoreDatabase, CredentialTable } from '../../infrastructure/database.ts';
import { forbidden } from '../access/request-scope.ts';
import { type IntegrationTokenRecord, integrationTokens } from '../integration-token.service.ts';
import type { CoreContext } from './context.ts';

/** The core.credential row of an integration token that a core command acts on. */
export type IntegrationTokenRow = Selectable<CredentialTable>;

/**
 * The target of a core command on an existing integration token (ADR 0012). The bus reads the
 * token's company and checks the permission there, then locks the row and checks its version.
 */
export const integrationTokenTarget = {
  entity: 'Integration token',
  scopeOf: async (id: string, { tx }: Pick<CoreContext, 'tx'>) =>
    (
      await tx
        .selectFrom('core.credential')
        .select('scope_id')
        .where('id', '=', id)
        .where('kind', '=', 'integration')
        .executeTakeFirst()
    )?.scope_id,
  load: (id: string, { tx }: Pick<CoreContext, 'tx'>): Promise<IntegrationTokenRow | undefined> =>
    tx
      .selectFrom('core.credential')
      .selectAll()
      .where('id', '=', id)
      .where('kind', '=', 'integration')
      .forUpdate()
      .executeTakeFirst(),
};

/**
 * The user who creates or revokes a token: the request's principal, which must be a person, since
 * core.credential records who did it (ADR 0073). Any other principal is core.forbidden.
 */
export function actingUser(): string {
  const principal = currentPrincipal();
  if (!principal || principal.type === 'integration' || principal.userId === '') {
    throw forbidden('Integration tokens are created and revoked only by a signed-in user');
  }
  return principal.userId;
}

/** The record of the token with this id, as the transaction reads it now. */
export async function integrationTokenById(
  tx: Transaction<CoreDatabase>,
  id: string,
): Promise<IntegrationTokenRecord> {
  const [token] = await integrationTokens(tx, { id });
  if (!token) throw new NotFoundException(`Integration token ${id} was not found`);
  return token;
}
