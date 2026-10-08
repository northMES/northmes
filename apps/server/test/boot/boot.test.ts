// SPDX-License-Identifier: AGPL-3.0-or-later
import type { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ModulesContainer } from '@nestjs/core';
import type { ModuleManifest } from '@northmes/sdk';
import { secretsConfig } from '@northmes/sdk/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../src/app.module.ts';
import { boot } from '../../src/boot/boot.ts';
import { core, inRepoModule } from '../fixtures/catalog.ts';

// A valid server environment. PORT 0 lets the operating system pick a free port.
const env = { NODE_ENV: 'test', PORT: '0', NORTHMES_PUBLIC_ORIGIN: 'http://127.0.0.1:4100' };

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
  for (const key of ['PORT', 'NORTHMES_PUBLIC_ORIGIN', 'NORTHMES_ROLE']) vi.stubEnv(key, undefined);
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
    expect(log.info.mock.calls).toEqual([
      ['Modules in boot order: core, planning'],
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
    // The server environment has no secret file keys yet, so the secrets namespace is empty.
    expect(app?.get(secretsConfig.KEY)).toEqual({});
  });

  it('E02-S01 a catalog BootError exits 1 with its message', async () => {
    const log = recordingLog();
    const exit = vi.fn<(code: number) => void>();
    const importManifest = importFixtures({
      '@northmes/module-core/manifest': core.manifest,
      '@northmes/module-planning/manifest': inRepoModule('planning', ['core', 'quality']).manifest,
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
});
