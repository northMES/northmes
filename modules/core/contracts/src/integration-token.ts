// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { defineCommandContract } from '@northmes/contracts';
import { z } from 'zod';
import { tooLong } from './messages.ts';
import { settingsCompanyId } from './role.ts';

/** The longest an integration token lives, in days (ADR 0073). */
export const integrationTokenMaxDays = 365;

/** How long an integration token lives when its creator names no expiry, in days (ADR 0073). */
export const integrationTokenDefaultDays = 90;

/** A role id in a list. A uuid, checked by pattern so that the generated input is a [String]. */
const roleId = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'A role id is a uuid.');

/**
 * Creates an integration token of the company of the request's plant, or of companyId from
 * company settings, under the client-generated id (ADR 0073). The token acts as its own principal,
 * of type integration, and holds the roles at its binding, the company or one of its plants. It
 * needs core.integration:manage at the company, and every permission of each role held by the
 * creator at the binding (ADR 0010), else core.role_not_held. It expires after expiresInDays, 90
 * unless given and at most 365. The answer shows the secret once; a retry with the id of a created
 * token is refused with core.integration_token_secret_shown, since the secret is shown once only.
 */
export const createIntegrationToken = defineCommandContract({
  name: 'core.createIntegrationToken',
  description:
    'Creates an integration token of the company that holds roles at the company or at one of its plants. Needs core.integration:manage at the company and every permission of each role at that place. The answer shows the secret once.',
  target: 'new',
  fields: z.object({
    name: z
      .string()
      .trim()
      .min(1, 'Enter a name.')
      .max(80, { error: tooLong('Name', 80) })
      .describe("The token's name, such as the system that uses it, at most 80 characters."),
    scopeId: z
      .uuid()
      .describe('The company or the plant of the company where the token holds its roles.'),
    roleIds: z
      .array(roleId)
      .min(1, 'Choose at least one role.')
      .max(20, 'A token can hold at most 20 roles.')
      .describe('The ids of the roles of the company that the token holds at scopeId, 1 to 20.'),
    expiresInDays: z
      .int32()
      .min(1, 'A token lives at least 1 day.')
      .max(integrationTokenMaxDays, `A token expires within ${integrationTokenMaxDays} days.`)
      .default(integrationTokenDefaultDays)
      .describe(
        `How many days the token lives, 1 to ${integrationTokenMaxDays}, ${integrationTokenDefaultDays} unless given.`,
      ),
    companyId: settingsCompanyId,
  }),
  permission: 'core.integration:manage',
});

/**
 * Revokes an integration token of the company at once: Better Auth's key is deleted, so the
 * secret is refused from then on, and the token's record stays for the audit trail (ADR 0073,
 * ADR 0010). It needs core.integration:manage at the token's company. A revoked token is refused
 * with core.integration_token_revoked.
 */
export const revokeIntegrationToken = defineCommandContract({
  name: 'core.revokeIntegrationToken',
  description:
    "Revokes an integration token at once and keeps its record. Needs core.integration:manage at the token's company.",
  target: 'existing',
  fields: z.object({}),
  permission: 'core.integration:manage',
});
