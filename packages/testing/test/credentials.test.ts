// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { newRunCredentials } from '../src/credentials.ts';

describe('newRunCredentials', () => {
  it('two runs get different passwords and database names', () => {
    const first = newRunCredentials();
    const second = newRunCredentials();

    expect(first.password).not.toBe(second.password);
    expect(first.database).not.toBe(second.database);
    for (const { password, database } of [first, second]) {
      expect(password.length).toBeGreaterThanOrEqual(32);
      expect(database).toMatch(/^nm_run_[0-9a-f]+$/);
      expect(password).not.toBe('test');
      expect(database).not.toBe('test');
    }
  });
});
