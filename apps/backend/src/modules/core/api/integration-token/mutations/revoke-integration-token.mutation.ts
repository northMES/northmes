// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { revokeIntegrationToken } from '@northmes/core-contracts';
import { defineCommand } from '@northmes/sdk/commands';
import { revokeIntegrationTokenHandler } from '../../../core/commands/revoke-integration-token.handler.ts';
import { IntegrationToken } from '../types/integration-token.type.ts';

/**
 * The mutation coreRevokeIntegrationToken, which the SDK generates from the contract of
 * core.revokeIntegrationToken and which returns the token that revokeIntegrationTokenHandler
 * revokes.
 */
export const RevokeIntegrationToken = defineCommand(revokeIntegrationToken, {
  returns: () => IntegrationToken,
  plantFree: true,
  ...revokeIntegrationTokenHandler,
});
