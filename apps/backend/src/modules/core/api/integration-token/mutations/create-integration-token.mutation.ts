// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { createIntegrationToken } from '@northmes/core-contracts';
import { defineCommand } from '@northmes/sdk/commands';
import { createIntegrationTokenHandler } from '../../../core/commands/create-integration-token.handler.ts';
import { CreatedIntegrationToken } from '../types/created-integration-token.type.ts';

/**
 * The mutation coreCreateIntegrationToken, which the SDK generates from the contract of
 * core.createIntegrationToken and which returns the token that createIntegrationTokenHandler
 * creates, with its secret.
 */
export const CreateIntegrationToken = defineCommand(createIntegrationToken, {
  returns: () => CreatedIntegrationToken,
  plantFree: true,
  ...createIntegrationTokenHandler,
});
