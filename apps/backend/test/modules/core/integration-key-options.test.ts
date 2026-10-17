// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { integrationTokenMaxDays } from '@northmes/core-contracts';
import { describe, expect, it } from 'vitest';
import {
  INTEGRATION_KEY_MAX_DAYS,
  integrationKeyOptions,
} from '../../../src/modules/core/infrastructure/auth/auth-options.ts';

// The contract checks the lifetime a creator asks for, and Better Auth's api-key plugin checks it
// again with its own limit. The auth options stay importable by gen:auth-migration, which runs on
// plain Node without the contracts' source condition, so the limit is written twice and this test
// keeps the two the same.
describe('integration key options', () => {
  it('ADR0073-W4 Better Auth caps an integration key at the lifetime the contract allows', () => {
    expect(INTEGRATION_KEY_MAX_DAYS).toBe(integrationTokenMaxDays);
    expect(integrationKeyOptions.keyExpiration.maxExpiresIn).toBe(integrationTokenMaxDays);
  });
});
