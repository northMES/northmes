// SPDX-License-Identifier: AGPL-3.0-or-later
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ModulesContainer } from '@nestjs/core';
import type { ModuleManifest } from '@northmes/sdk';
import { secretsConfig } from '@northmes/sdk/config';
import { useTestDatabase } from '@northmes/testing';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { AppModule } from '../../src/app.module.ts';
import { boot } from '../../src/boot/boot.ts';
import { inRepoManifests } from '../../src/modules.ts';
import { imageVersion } from '../../src/version.ts';
import { core, inRepoModule } from '../fixtures/catalog.ts';
import { dispatch } from '../fixtures/commands/dispatch.ts';
import { strayRules } from '../fixtures/commands/misplaced-validators.ts';
import { serverEnvKeys, useServerEnv } from '../fixtures/server-env.ts';
import { fixtureCatalog } from '../fixtures/subgraphs/catalog.ts';

// Boot step 5 reads the migration records of the in-repo modules as nm_app, so the server needs a
// migrated database.
const db = useTestDatabase();
const env = useServerEnv({ database: db });

// Collects the lines boot writes.
function recordingLog() {
  return { info: vi.fn<(line: string) => void>(), error: vi.fn<(line: string) => void>() };
}

// Imports fixture manifests in place of the in-repo ones, keyed by the specifier boot imports.
function importFixtures(manifests: Readonly<Record<string, ModuleManifest>>) {
  return async (specifier: string) => {
    const manifest = manifests[specifier];
    if (!manifest) throw new Error(`no fixture manifest for ${specifier}`);
    return { default: manifest };
  };
}

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
  vi.restoreAllMocks();
});

describe('boot', () => {
  it('E02-S01 a valid environment boots core then planning and logs them in that order', async () => {
    const log = recordingLog();
    const exit = vi.fn<(code: number) => void>();

    app = await boot({ env, importManifest: (specifier) => import(specifier), exit, log });
    const url = await app?.getUrl();

    expect(exit).not.toHaveBeenCalled();
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    // Core's server entry gives the gateway a supergraph to serve.
    expect(log.info.mock.calls).toEqual([
      ['Modules in boot order: core, planning'],
      [expect.stringMatching(/^Serving \/graphql with supergraph=[0-9a-f]{12}$/)],
      [`Listening on ${url}`],
    ]);
    expect(log.error).not.toHaveBeenCalled();
  });

  it("E02-S01 AppModule's first import is the ConfigModule built from loadEnv(serverEnvSchema) and secretsConfig", async () => {
    const exit = vi.fn<(code: number) => void>();
    const forRoot = vi.spyOn(ConfigModule, 'forRoot');

    app = await boot({
      env,
      importManifest: (specifier) => import(specifier),
      exit,
      log: recordingLog(),
    });
    const modules = [...(app?.get(ModulesContainer).values() ?? [])];
    const root = modules.find((module) => module.metatype === AppModule);
    const [first] = root?.imports ?? [];

    expect(exit).not.toHaveBeenCalled();
    // The server reads no .env file, and ConfigService caches what it reads.
    expect(forRoot).toHaveBeenCalledWith(
      expect.objectContaining({
        isGlobal: true,
        ignoreEnvFile: true,
        cache: true,
        load: [secretsConfig],
      }),
    );
    expect(first?.metatype).toBe(ConfigModule);
    expect(first?.isGlobal).toBe(true);
    const config = app?.get(ConfigService);
    // serverEnvSchema reads PORT as a number and defaults NORTHMES_ROLE to all.
    expect(config?.get('PORT')).toBe(0);
    expect(config?.get('NORTHMES_ROLE')).toBe('all');
    // The secrets namespace holds the value of each secret file the environment names.
    expect(app?.get(secretsConfig.KEY)).toEqual({
      NORTHMES_DB_APP_PASSWORD: decodeURIComponent(new URL(db.appUrl).password),
    });
  });

  it('E02-S02 boot resolves each manifest it was given through resolveManifest', async () => {
    const exit = vi.fn<(code: number) => void>();
    const specifier = '@northmes/fixture-core/manifest';
    // A fixture specifier names no package, so import.meta.resolve could not resolve it.
    const resolveManifest = vi.fn<(specifier: string) => string>(() => import.meta.url);

    app = await boot({
      env,
      manifests: [specifier],
      importManifest: importFixtures({ [specifier]: core.manifest }),
      resolveManifest,
      exit,
      log: recordingLog(),
    });

    expect(exit).not.toHaveBeenCalled();
    expect(resolveManifest.mock.calls).toEqual([[specifier]]);
  });

  it('E02-S01 a catalog BootError exits 1 with its message', async () => {
    const log = recordingLog();
    const exit = vi.fn<(code: number) => void>();
    const [coreSpecifier = '', planningSpecifier = ''] = inRepoManifests;
    const importManifest = importFixtures({
      [coreSpecifier]: core.manifest,
      [planningSpecifier]: inRepoModule('planning', ['core', 'quality']).manifest,
    });

    app = await boot({ env, importManifest, exit, log });

    expect(app).toBeUndefined();
    expect(exit.mock.calls).toEqual([[1]]);
    expect(log.error.mock.calls).toEqual([
      [
        'refused to start (1 problem)\n- Module planning depends on "quality", which is not installed',
      ],
    ]);
    expect(log.info).not.toHaveBeenCalled();
  });

  it("E02-S04 a northmes.config.json that names a version other than the image's exits 1 naming both", async () => {
    const configDir = mkdtempSync(join(tmpdir(), 'northmes-config-'));
    onTestFinished(() => rmSync(configDir, { recursive: true, force: true }));
    const file = join(configDir, 'northmes.config.json');
    writeFileSync(file, JSON.stringify({ northmes: '0.3.0', plugins: [] }));
    // ConfigModule writes NORTHMES_CONFIG into process.env; unstubAllEnvs takes it out again.
    vi.stubEnv('NORTHMES_CONFIG', undefined);
    const log = recordingLog();
    const exit = vi.fn<(code: number) => void>();

    app = await boot({
      env: { ...env, NORTHMES_CONFIG: file },
      importManifest: (specifier) => import(specifier),
      exit,
      log,
    });

    const image = imageVersion();
    expect(app).toBeUndefined();
    expect(exit.mock.calls).toEqual([[1]]);
    expect(log.error.mock.calls).toEqual([
      [
        `refused to start (1 problem)\n- ${file}: config names 0.3.0, this image is ${image}. Set northmes to ${image} or remove it`,
      ],
    ]);
    expect(log.info).not.toHaveBeenCalled();
  });

  it.for([
    { reason: 'is missing', content: undefined, problem: /^cannot be read \(ENOENT\)$/ },
    { reason: 'is not JSON', content: '{ plugins: [] }', problem: /^is not JSON: .+/ },
    {
      reason: 'lists its plugins as one string',
      content: '{ "plugins": "plugins/scrap-rules" }',
      problem: /^plugins: Invalid input: expected array, received string$/,
    },
  ])(
    'E02-S04 a northmes.config.json that $reason exits 1 naming the file',
    async ({ content, problem }) => {
      const configDir = mkdtempSync(join(tmpdir(), 'northmes-config-'));
      onTestFinished(() => rmSync(configDir, { recursive: true, force: true }));
      const file = join(configDir, 'northmes.config.json');
      if (content !== undefined) writeFileSync(file, content);
      // ConfigModule writes NORTHMES_CONFIG into process.env; unstubAllEnvs takes it out again.
      vi.stubEnv('NORTHMES_CONFIG', undefined);
      const log = recordingLog();
      const exit = vi.fn<(code: number) => void>();

      app = await boot({
        env: { ...env, NORTHMES_CONFIG: file },
        importManifest: (specifier) => import(specifier),
        exit,
        log,
      });

      const [header, line = ''] = String(log.error.mock.calls[0]?.[0]).split('\n');
      expect(app).toBeUndefined();
      expect(exit.mock.calls).toEqual([[1]]);
      expect(header).toBe('refused to start (1 problem)');
      expect(line.startsWith(`- ${file}: `)).toBe(true);
      expect(line.slice(`- ${file}: `.length)).toMatch(problem);
      expect(log.info).not.toHaveBeenCalled();
    },
  );

  it('E02-S04 a validator from a module without dependsOn on the owner exits 1 with its message', async () => {
    const log = recordingLog();
    const exit = vi.fn<(code: number) => void>();

    app = await boot({ env, ...fixtureCatalog(dispatch, strayRules), exit, log });

    expect(app).toBeUndefined();
    expect(exit.mock.calls).toEqual([[1]]);
    expect(log.error.mock.calls).toEqual([
      [
        'refused to start (1 problem)\n- Validator quantity-cap of module stray-rules is on dispatch.releaseJob of module dispatch, which is not in the dependsOn of stray-rules',
      ],
    ]);
  });
});
