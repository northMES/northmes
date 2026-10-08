// SPDX-License-Identifier: AGPL-3.0-or-later
import type { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ModulesContainer } from '@nestjs/core';
import { secretsConfig } from '@northmes/sdk/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../src/app.module.ts';
import { boot } from '../../src/boot/boot.ts';

// A valid server environment. PORT 0 lets the operating system pick a free port.
const env = { NODE_ENV: 'test', PORT: '0', NORTHMES_PUBLIC_ORIGIN: 'http://127.0.0.1:4100' };

// Collects the lines boot writes.
function recordingLog() {
  return { info: vi.fn<(line: string) => void>(), error: vi.fn<(line: string) => void>() };
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
    expect(first?.metatype).toBe(ConfigModule);
    expect(first?.isGlobal).toBe(true);
    const config = app?.get(ConfigService);
    // serverEnvSchema reads PORT as a number and defaults NORTHMES_ROLE to all.
    expect(config?.get('PORT')).toBe(0);
    expect(config?.get('NORTHMES_ROLE')).toBe('all');
    // The server environment has no secret file keys yet, so the secrets namespace is empty.
    expect(app?.get(secretsConfig.KEY)).toEqual({});
  });
});
