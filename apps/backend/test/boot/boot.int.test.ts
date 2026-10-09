// SPDX-License-Identifier: AGPL-3.0-or-later
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ModulesContainer } from '@nestjs/core';
import { secretsConfig } from '@northmes/sdk/config';
import { useTestDatabase } from '@northmes/testing';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { AppModule } from '../../src/app.module.ts';
import { type BootOptions, boot } from '../../src/boot/boot.ts';
import { imageVersion } from '../../src/version.ts';
import { dispatch } from '../fixtures/commands/dispatch.ts';
import { strayRules } from '../fixtures/commands/misplaced-validators.ts';
import { alpha } from '../fixtures/graphql/alpha.ts';
import { beta } from '../fixtures/graphql/beta.ts';
import { importPlugins, writeConfig, writePlugin } from '../fixtures/plugins/plugin-root.ts';
import { articleGate, releaseCap } from '../fixtures/plugins/validator-plugins.ts';
import { serverEnvKeys, useServerEnv } from '../fixtures/server-env.ts';

// Boot step 5 reads the migration records of the in-repo modules as nm_app, so the server needs a
// migrated database.
const db = useTestDatabase();
const env = useServerEnv({ database: db });

// Collects the lines boot writes.
function recordingLog() {
  return { info: vi.fn<(line: string) => void>(), error: vi.fn<(line: string) => void>() };
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

    app = await boot({ env, exit, log });
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

  it('E02-S01 a catalog BootError exits 1 with its message', async () => {
    const log = recordingLog();
    const exit = vi.fn<(code: number) => void>();

    app = await boot({
      env,
      modules: [alpha, { ...beta, dependsOn: ['alpha', 'quality'] }],
      exit,
      log,
    });

    expect(app).toBeUndefined();
    expect(exit.mock.calls).toEqual([[1]]);
    expect(log.error.mock.calls).toEqual([
      ['refused to start (1 problem)\n- Module beta depends on "quality", which is not installed'],
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

    app = await boot({ env, modules: [dispatch, strayRules], exit, log });

    expect(app).toBeUndefined();
    expect(exit.mock.calls).toEqual([[1]]);
    expect(log.error.mock.calls).toEqual([
      [
        'refused to start (1 problem)\n- Validator quantity-cap of module stray-rules is on dispatch.releaseJob of module dispatch, which is not in the dependsOn of stray-rules',
      ],
    ]);
  });
});

describe('boot with the in-repo modules as plain Nest modules', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'northmes-plugins-'));
    // ConfigModule writes NORTHMES_CONFIG into process.env; unstubAllEnvs takes it out again.
    vi.stubEnv('NORTHMES_CONFIG', undefined);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('E02-S01 boot imports no manifest for core and planning and boots them in dependency order', async () => {
    const log = recordingLog();
    const exit = vi.fn<(code: number) => void>();
    const importManifest = vi.fn<NonNullable<BootOptions['importManifest']>>(async (specifier) => {
      throw new Error(`boot imported ${specifier}`);
    });

    app = await boot({ env, importManifest, exit, log });

    expect(exit).not.toHaveBeenCalled();
    expect(importManifest).not.toHaveBeenCalled();
    expect(log.info.mock.calls[0]).toEqual(['Modules in boot order: core, planning']);
  });

  it("E02-S04 a plugin's manifest still loads after the in-repo modules", async () => {
    const log = recordingLog();
    const exit = vi.fn<(code: number) => void>();
    const audit = writePlugin(dir, {
      id: 'acme-audit',
      version: '1.2.0',
      northmes: '>=0.0.0-0 <0.1.0-0',
      dependsOn: ['core'],
    });

    app = await boot({
      env: { ...env, NORTHMES_CONFIG: writeConfig(dir, [audit]) },
      importManifest: importPlugins(audit),
      exit,
      log,
    });

    expect(exit).not.toHaveBeenCalled();
    expect(log.info.mock.calls[0]).toEqual(['Modules in boot order: core, planning, acme-audit']);
  });

  it("E02-S04 a plugin's manifest is still checked: a range without the image's version exits 1", async () => {
    const log = recordingLog();
    const exit = vi.fn<(code: number) => void>();
    const audit = writePlugin(dir, {
      id: 'acme-audit',
      version: '1.2.0',
      northmes: '>=9.0.0',
      dependsOn: ['core', 'quality'],
    });

    app = await boot({
      env: { ...env, NORTHMES_CONFIG: writeConfig(dir, [audit]) },
      importManifest: importPlugins(audit),
      exit,
      log,
    });

    expect(app).toBeUndefined();
    expect(exit.mock.calls).toEqual([[1]]);
    expect(log.error.mock.calls).toEqual([
      [
        [
          'refused to start (2 problems)',
          `- Module acme-audit 1.2.0 runs on NorthMES >=9.0.0, and this image is ${imageVersion()}`,
          '- Module acme-audit depends on "quality", which is not installed',
        ].join('\n'),
      ],
    ]);
  });

  it("E02-S04 a plugin validator on planning.releaseProductionOrder boots, because planning's contract says it is validatable", async () => {
    const log = recordingLog();
    const exit = vi.fn<(code: number) => void>();
    const plugin = writePlugin(dir, releaseCap);

    app = await boot({
      env: { ...env, NORTHMES_CONFIG: writeConfig(dir, [plugin]) },
      importManifest: importPlugins(plugin),
      exit,
      log,
    });

    expect(log.error).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
    expect(log.info.mock.calls[0]).toEqual(['Modules in boot order: core, planning, release-cap']);
  });

  it("E02-S04 a plugin validator on core.createArticle exits 1, because core's contract does not say it is validatable", async () => {
    const log = recordingLog();
    const exit = vi.fn<(code: number) => void>();
    const plugin = writePlugin(dir, articleGate);

    app = await boot({
      env: { ...env, NORTHMES_CONFIG: writeConfig(dir, [plugin]) },
      importManifest: importPlugins(plugin),
      exit,
      log,
    });

    expect(app).toBeUndefined();
    expect(exit.mock.calls).toEqual([[1]]);
    expect(log.error.mock.calls).toEqual([
      [
        'refused to start (1 problem)\n- Validator article-gate of module article-gate is on core.createArticle, which no module declares validatable',
      ],
    ]);
  });
});
