// SPDX-License-Identifier: AGPL-3.0-or-later
import type { INestApplication } from '@nestjs/common';
import { query, useTestDatabase } from '@northmes/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { boot } from '../../src/boot/boot.ts';
import { serverEnvKeys, useServerEnv } from '../fixtures/server-env.ts';

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

    app = await boot({ env, importManifest: (specifier) => import(specifier), exit, log });

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
