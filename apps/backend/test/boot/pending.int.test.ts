// SPDX-License-Identifier: AGPL-3.0-or-later
import type { INestApplication } from '@nestjs/common';
import { emptyTemplateDatabase, query, useTestDatabase } from '@northmes/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { boot } from '../../src/boot/boot.ts';
import { cli } from '../../src/cli.ts';
import {
  migrateEnvKeys,
  serverEnvKeys,
  useMigrateEnv,
  useServerEnv,
} from '../fixtures/server-env.ts';

/** Collects the lines boot writes. */
function recordingLog() {
  return { info: vi.fn<(line: string) => void>(), error: vi.fn<(line: string) => void>() };
}

describe('the migration check of boot', () => {
  // A clone of the migrated template, which holds every file of the in-repo modules.
  const db = useTestDatabase();
  const env = useServerEnv({ database: db });
  let app: INestApplication | undefined;

  // ConfigModule writes the validated environment into process.env, as it does in the server. The
  // stubs remove these keys for each test, and unstubAllEnvs takes them out again afterwards.
  beforeEach(() => {
    for (const key of serverEnvKeys) vi.stubEnv(key, undefined);
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    vi.unstubAllEnvs();
  });

  it('E02-S02 boot refuses to start while a migration is pending, naming the module and the file', async () => {
    const log = recordingLog();
    const exit = vi.fn<(code: number) => void>();
    // A file whose record is gone counts as pending, as a file added after the last migrate does.
    const [file] = await query<{ module: string; name: string }>(
      db.ownerUrl,
      `delete from northmes_meta.migration
        where (module, name) = (select module, name from northmes_meta.migration
                                 order by module desc, name desc limit 1)
       returning module, name`,
    );

    app = await boot({ env, exit, log });

    expect(log.error.mock.calls).toEqual([
      [
        `refused to start (1 problem)\n- ${file?.module}/${file?.name} is not applied; run pnpm northmes migrate`,
      ],
    ]);
    expect(exit.mock.calls).toEqual([[1]]);
    expect(app).toBeUndefined();
    expect(log.info).not.toHaveBeenCalled();
  });
});

describe('the migration check of pnpm northmes migrate', () => {
  // An empty database, so every file of the in-repo modules is pending.
  const db = useTestDatabase({ template: emptyTemplateDatabase });
  const env = useMigrateEnv({ database: db });

  // ConfigModule writes the validated environment into process.env, as it does in the server.
  beforeEach(() => {
    for (const key of migrateEnvKeys) vi.stubEnv(key, undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('E02-S02 migrate lists the pending files and applies them', async () => {
    const log = recordingLog();
    const exit = vi.fn<(code: number) => void>();

    await cli(['migrate'], { env, exit, log });
    const files = (
      await query<{ module: string; name: string }>(
        db.ownerUrl,
        'select module, name from northmes_meta.migration order by applied_at',
      )
    ).map(({ module, name }) => `${module}/${name}`);

    expect(exit).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
    expect(files).not.toEqual([]);
    expect(log.info.mock.calls).toEqual([
      ['Modules in boot order: core, planning'],
      ...files.map((file) => [`Pending ${file}`]),
      ...files.map((file) => [`Applied ${file}`]),
      ['Migrations up to date'],
    ]);
  });
});
