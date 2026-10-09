// SPDX-License-Identifier: AGPL-3.0-or-later
import { copyFileSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { givenCompany, queryAsCore } from '@northmes/backend/testing';
import { emptyTemplateDatabase, useTestDatabase } from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inRepoCatalog } from '../../../src/boot/boot.ts';
import { migrate } from '../../../src/migrate/runner.ts';

/** core's migrations folder. */
const coreMigrations = fileURLToPath(
  new URL('../../../src/modules/core/migrations', import.meta.url),
);

/** The migration that moves every article to its company. */
const moveFile = readdirSync(coreMigrations).find((name) => name.endsWith('_article_plants.sql'));

/** A folder with core's migration files up to, and without, the move. */
function migrationsBeforeMove(): string {
  const dir = mkdtempSync(join(tmpdir(), 'nm-article-plants-'));
  for (const name of readdirSync(coreMigrations).sort()) {
    if (moveFile !== undefined && name >= moveFile) break;
    copyFileSync(join(coreMigrations, name), join(dir, name));
  }
  return dir;
}

/** Writes an article at the scope of `plant` as the migrations before the move kept it. */
function articleAt(ownerUrl: string, plant: string, code: string): Promise<unknown> {
  return queryAsCore(
    ownerUrl,
    'insert into core.article (scope_id, code, name) values ($1, $2, $2) returning id',
    [plant, code],
  );
}

describe('the migration that moves articles to the company', () => {
  const db = useTestDatabase({ template: emptyTemplateDatabase });
  let dir = '';

  // core's catalog entry, with its migrations from migrationsDir.
  const catalogIn = (migrationsDir: string) =>
    inRepoCatalog({ modules: ['core'] }).map((entry) => ({ ...entry, migrationsDir }));

  beforeAll(async () => {
    dir = migrationsBeforeMove();
    await migrate({ ownerUrl: db.ownerUrl, catalog: catalogIn(dir) });
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('ADR0073-W2 the migration stops naming the code when HEL and STO of one company use it, and moves a HEL article to the company and assigns it to HEL once one is renamed', async () => {
    expect(moveFile).toBeDefined();
    const place = await givenCompany(db.ownerUrl, { plantNames: ['HEL', 'STO'] });
    const [hel = '', sto = ''] = place.plants;
    await articleAt(db.ownerUrl, hel, 'BR-140');
    await articleAt(db.ownerUrl, sto, 'br-140');
    await articleAt(db.ownerUrl, hel, 'HG-110');
    const withMove = migrationsBeforeMove();
    copyFileSync(join(coreMigrations, moveFile ?? ''), join(withMove, moveFile ?? ''));

    try {
      await expect(
        migrate({ ownerUrl: db.ownerUrl, catalog: catalogIn(withMove) }),
      ).rejects.toThrow(/br-140/);
      await queryAsCore(
        db.ownerUrl,
        "update core.article set code = 'BR-141' where scope_id = $1 and code = 'br-140'",
        [sto],
      );
      await migrate({ ownerUrl: db.ownerUrl, catalog: catalogIn(withMove) });
    } finally {
      rmSync(withMove, { recursive: true, force: true });
    }

    const articles = await queryAsCore<Record<string, unknown>>(
      db.ownerUrl,
      `select a.code, a.scope_id, a.company_id, a.edit_scope_id, a.all_plants, a.version,
              array_agg(ap.plant_id) as plants
         from core.article a join core.article_plant ap on ap.article_id = a.id
        group by a.id order by a.code`,
    );
    expect(articles).toEqual([
      {
        code: 'BR-140',
        scope_id: place.company,
        company_id: place.company,
        edit_scope_id: hel,
        all_plants: false,
        version: 1,
        plants: [hel],
      },
      {
        code: 'BR-141',
        scope_id: place.company,
        company_id: place.company,
        edit_scope_id: sto,
        all_plants: false,
        version: 2,
        plants: [sto],
      },
      {
        code: 'HG-110',
        scope_id: place.company,
        company_id: place.company,
        edit_scope_id: hel,
        all_plants: false,
        version: 1,
        plants: [hel],
      },
    ]);
  });
});
