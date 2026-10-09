// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { userIdOf } from '../../../src/modules/core/core/commands/create-user.handler.ts';

describe('userIdOf', () => {
  it('E05-S08 derives one user id per command id in a uuid layout that Better Auth keeps, without SHA-1', () => {
    const first = userIdOf('01920000-0000-7000-8000-000000000001');
    const second = userIdOf('01920000-0000-7000-8000-000000000002');

    expect(userIdOf('01920000-0000-7000-8000-000000000001')).toBe(first);
    expect(second).not.toBe(first);
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const source = readFileSync(
      new URL('../../../src/modules/core/core/commands/create-user.handler.ts', import.meta.url),
      'utf8',
    );
    expect(source).not.toMatch(/createHash\('sha1'\)/);
  });
});
