// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { HttpStatus } from '@nestjs/common';
import type { revokeIntegrationToken } from '@northmes/core-contracts';
import { DomainError } from '@northmes/sdk/errors';
import { sql } from 'kysely';
import type { z } from 'zod';
import { integrationKeys } from '../access/user-accounts.ts';
import type { IntegrationTokenRecord } from '../integration-token.service.ts';
import type { CoreContext } from './context.ts';
import {
  actingUser,
  type IntegrationTokenRow,
  integrationTokenById,
  integrationTokenTarget,
} from './integration-token-target.ts';

/**
 * The handler of core.revokeIntegrationToken (ADR 0073), which the mutation
 * coreRevokeIntegrationToken sends through the command bus after it checked
 * core.integration:manage at the token's company. It records who revoked the token and when, then
 * deletes Better Auth's key, so the secret is refused from the next call on, and returns the token.
 * The core.credential row stays for the audit trail (ADR 0010). A revoked token is refused with
 * core.integration_token_revoked. A key delete that fails rolls the revoke back; a commit that
 * fails after the delete leaves a token that no secret resolves to, which a second revoke records.
 */
export const revokeIntegrationTokenHandler = {
  target: integrationTokenTarget,
  async handle(
    { id }: z.output<typeof revokeIntegrationToken.input>,
    { tx, target }: CoreContext<IntegrationTokenRow>,
  ): Promise<IntegrationTokenRecord> {
    const revoker = actingUser();
    if (target.revoked_at !== null) {
      throw new DomainError({
        code: 'core.integration_token_revoked',
        status: HttpStatus.PRECONDITION_FAILED,
        message: `${target.name} is revoked already.`,
      });
    }
    await tx
      .updateTable('core.credential')
      .set({ revoked_at: sql<Date>`now()`, revoked_by: revoker })
      .where('id', '=', id)
      .execute();
    await integrationKeys().deleteIntegrationKey(target.key_id);
    return integrationTokenById(tx, id);
  },
};
