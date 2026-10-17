// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { HttpStatus, NotFoundException } from '@nestjs/common';
import type { createIntegrationToken } from '@northmes/core-contracts';
import { DomainError } from '@northmes/sdk/errors';
import { sql } from 'kysely';
import type { z } from 'zod';
import { NotOrganizationMember } from '../access/auth.service.ts';
import { forbidden } from '../access/request-scope.ts';
import type { Secret } from '../access/secret.ts';
import { integrationKeys } from '../access/user-accounts.ts';
import type { IntegrationTokenRecord } from '../integration-token.service.ts';
import { requestCompany } from './company-scope.ts';
import type { CoreContext } from './context.ts';
import { actingUser, integrationTokenById } from './integration-token-target.ts';
import { refuseRoleNotHeld } from './role-assignment-rules.ts';

/** An integration token that core.createIntegrationToken created, with its secret. */
export interface CreatedIntegrationTokenRecord {
  readonly token: IntegrationTokenRecord;
  /** The token's secret, which only this answer holds; it reads as [redacted] anywhere else. */
  readonly secret: Secret;
}

type CreateIntegrationTokenInput = z.output<typeof createIntegrationToken.input>;

/**
 * The refusal of a retry whose first run created the token: the first answer showed the secret,
 * which NorthMES cannot show again. Its details name the token, so the client can open it.
 */
function secretShown(id: string): DomainError {
  return new DomainError({
    code: 'core.integration_token_secret_shown',
    status: HttpStatus.CONFLICT,
    message:
      'The integration token was created by an earlier try. NorthMES cannot show its secret again: revoke it and create a new one.',
    details: { tokenId: id },
  });
}

/** Whether an insert failed because core.credential already holds its id. */
function isCredentialIdTaken(error: unknown): boolean {
  const { code, constraint } = error as { code?: unknown; constraint?: unknown };
  return code === '23505' && constraint === 'credential_pkey';
}

/**
 * The handler of core.createIntegrationToken (ADR 0073), which the mutation
 * coreCreateIntegrationToken sends through the command bus after it checked
 * core.integration:manage at the company of the request's plant, or in company settings at the
 * company the input names. It checks that the binding is the company or one of its plants and
 * that each role is the company's, applies the grant rule of ADR 0010 for each role at the binding,
 * has Better Auth's api-key plugin create the key, and records the token in core.credential with
 * the creator. It returns the token with its secret, which nothing else stores: Better Auth keeps
 * only its hash.
 *
 * Better Auth writes on its own pool, which the command's transaction cannot join. A key whose
 * credential row is not committed resolves to no principal, since the resolver needs both, and a
 * failed insert deletes it at once. A retry with the id of a created token is refused with
 * core.integration_token_secret_shown and changes nothing.
 */
export const createIntegrationTokenHandler = {
  scope: requestCompany,
  async handle(
    input: CreateIntegrationTokenInput,
    context: CoreContext,
  ): Promise<CreatedIntegrationTokenRecord> {
    const { id, name, scopeId, expiresInDays } = input;
    const { tx } = context;
    const creator = actingUser();
    const companyId = (await requestCompany(input, context)) ?? '';
    // Two runs with one id wait for each other, so only one of them creates the key.
    await sql`select pg_advisory_xact_lock(hashtextextended(${`core.create-integration-token:${id}`}, 0))`.execute(
      tx,
    );
    const first = await tx
      .selectFrom('core.credential')
      .select('scope_id')
      .where('id', '=', id)
      .executeTakeFirst();
    // Row-level security hides another company's token, so its id reaches the insert below.
    if (first) throw secretShown(id);
    const binding = await tx
      .selectFrom('core.scope')
      .select('id')
      .where('id', '=', scopeId)
      .where('company_id', '=', companyId)
      .executeTakeFirst();
    if (!binding) throw new NotFoundException(`Scope ${scopeId} was not found`);
    const roleIds = [...new Set(input.roleIds.map((roleId) => roleId.toLowerCase()))];
    const roles = await tx
      .selectFrom('core.role')
      .select('id')
      .where('id', 'in', roleIds)
      .where('company_id', '=', companyId)
      .execute();
    const missing = roleIds.find((roleId) => !roles.some((role) => role.id === roleId));
    if (missing) throw new NotFoundException(`Role ${missing} was not found`);
    for (const roleId of roleIds) await refuseRoleNotHeld(tx, { roleId, scopeId });
    const { organization_id } = await tx
      .selectFrom('core.company')
      .select('organization_id')
      .where('id', '=', companyId)
      .executeTakeFirstOrThrow();
    const keys = integrationKeys();
    const key = await keys
      .createIntegrationKey({
        organizationId: organization_id,
        creatorId: creator,
        name,
        expiresInDays,
      })
      .catch((error: unknown) => {
        if (!(error instanceof NotOrganizationMember)) throw error;
        throw forbidden(
          "You are not a member of the company's organization, so you cannot create its integration tokens.",
        );
      });
    try {
      await tx
        .insertInto('core.credential')
        .values({
          id,
          scope_id: companyId,
          kind: 'integration',
          name,
          binding_scope_id: scopeId,
          role_ids: roleIds,
          key_id: key.keyId,
          created_by: creator,
          expires_at: key.expiresAt,
          revoked_at: null,
          revoked_by: null,
          last_used_at: null,
        })
        .execute();
    } catch (error) {
      await keys.deleteIntegrationKey(key.keyId);
      // Another company's token holds this id, and row-level security hid it from the lookup.
      if (isCredentialIdTaken(error)) {
        throw new NotFoundException(`Integration token ${id} was not found`);
      }
      throw error;
    }
    return { token: await integrationTokenById(tx, id), secret: key.secret };
  },
};
