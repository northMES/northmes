// SPDX-License-Identifier: AGPL-3.0-or-later
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { bootBuilt, useTestDatabase } from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BootError } from '../../src/boot/boot-error.ts';
import { readConfigFile } from '../../src/boot/config-file.ts';

const repositoryRoot = fileURLToPath(new URL('../../../../', import.meta.url));

/** The example validator as pnpm plugin:build installs it. bootBuilt builds it for the run. */
const exampleValidator = join(repositoryRoot, 'plugins/example-validator');

// Preloaded into the built server to record the file each import resolves to.
const recordResolutions = new URL('./record-resolutions.mjs', import.meta.url).href;

interface Resolution {
  readonly specifier: string;
  readonly url: string;
}

/** The files each specifier that starts with prefix resolved to, by specifier. */
function filesBySpecifier(resolutions: readonly Resolution[], prefix: string) {
  const files: Record<string, string[]> = {};
  for (const { specifier, url } of resolutions) {
    if (!specifier.startsWith(prefix)) continue;
    files[specifier] = [...new Set([...(files[specifier] ?? []), url])];
  }
  return files;
}

describe('plugins listed in northmes.config.json', () => {
  const db = useTestDatabase();
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'northmes-plugins-'));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  /**
   * The environment of pnpm northmes migrate on the file's database. migrate runs the boot steps
   * without listening and exits, so the test sees a whole boot and its exit code.
   */
  function migrateEnv(): Record<string, string> {
    const databaseUrl = new URL(db.ownerUrl);
    const ownerPasswordFile = join(dir, 'db_owner_password');
    writeFileSync(ownerPasswordFile, `${decodeURIComponent(databaseUrl.password)}\n`, {
      mode: 0o600,
    });
    databaseUrl.username = '';
    databaseUrl.password = '';
    return {
      NODE_ENV: 'test',
      DATABASE_URL: databaseUrl.href,
      NORTHMES_DB_OWNER_PASSWORD_FILE: ownerPasswordFile,
    };
  }

  it("E02-S04 a plugin listed in northmes.config.json loads from plugins/ after the in-repo modules with the host's @nestjs/core", {
    timeout: 120_000,
  }, async () => {
    const resolutionsFile = join(dir, 'resolutions.json');

    const { exitCode, stdout, stderr } = await bootBuilt({
      args: ['migrate'],
      env: {
        ...migrateEnv(),
        NODE_OPTIONS: `--import=${recordResolutions}`,
        NM_TEST_RESOLUTIONS_FILE: resolutionsFile,
      },
      config: { plugins: [exampleValidator] },
    });
    const resolutions = JSON.parse(readFileSync(resolutionsFile, 'utf8')) as Resolution[];
    const nestFiles = filesBySpecifier(resolutions, '@nestjs/');

    expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: '' });
    expect(stdout).toContain('Modules in boot order: core, planning, example-validator\n');
    expect(resolutions.map(({ url }) => url)).toContain(
      pathToFileURL(join(exampleValidator, 'dist/server.js')).href,
    );
    // The plugin's server part imports @nestjs/common. Each Nest package resolved to one file in
    // the whole process, so the plugin's module is built from the host's copies, by the host's
    // @nestjs/core.
    expect(nestFiles['@nestjs/common']).toHaveLength(1);
    expect(nestFiles['@nestjs/core']).toHaveLength(1);
  });
});

describe('northmes.config.json', () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'northmes-config-'));
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('E02-S04 config version 0.3.0 with image 0.4.0 stops boot naming both', () => {
    const file = join(dir, 'northmes.config.json');
    writeFileSync(file, JSON.stringify({ northmes: '0.3.0', plugins: [] }));

    expect(() => readConfigFile(file, { imageVersion: '0.4.0' })).toThrow(
      new BootError([
        `${file}: config names 0.3.0, this image is 0.4.0. Set northmes to 0.4.0 or remove it`,
      ]),
    );
  });
});
