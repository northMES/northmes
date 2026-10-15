// SPDX-License-Identifier: AGPL-3.0-or-later
import { useTestDatabase } from '@northmes/testing';
import { describe, expect, it } from 'vitest';
import { givenCompany, queryAsCore } from '../../../src/testing.ts';

/** core.plant refuses a slug that is a first path segment of the server's or the web's own. */
describe('a plant slug in the database', () => {
  const db = useTestDatabase();

  it('ADR 0075 shared, the path of the files plugin screens import, is reserved like assets', async () => {
    const { plants } = await givenCompany(db.ownerUrl);

    const refusals = await Promise.all(
      ['shared', 'assets'].map((slug) =>
        queryAsCore(db.ownerUrl, 'update core.plant set slug = $1 where id = $2', [
          slug,
          plants[0],
        ]).then(
          () => 'saved',
          (error: Error) => error.message,
        ),
      ),
    );

    expect(refusals).toEqual([
      'new row for relation "plant" violates check constraint "plant_slug_check"',
      'new row for relation "plant" violates check constraint "plant_slug_check"',
    ]);
  });
});
