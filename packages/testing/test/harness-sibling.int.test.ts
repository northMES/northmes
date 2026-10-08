// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { query, useTestDatabase } from '../src/index.ts';

// harness.int.test.ts runs the same test with a schema of its own, in parallel.
describe('the test database of the sibling file', () => {
  const { appUrl, ownerUrl, databaseName } = useTestDatabase();

  it('each test file gets its own database', async () => {
    expect(databaseName).toMatch(/^t_\d+_[0-9a-f]{12}$/);
    await query(ownerUrl, 'create schema sibling_only');

    const rows = await query<{ nspname: string }>(
      appUrl,
      "select nspname from pg_namespace where nspname in ('harness_only', 'sibling_only')",
    );

    expect(rows).toEqual([{ nspname: 'sibling_only' }]);
  });
});
