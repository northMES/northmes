// SPDX-License-Identifier: AGPL-3.0-or-later
import type { INestApplication } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import type { ModuleManifest } from '@northmes/sdk';
import { DomainErrorFilter } from '@northmes/sdk/errors';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { boot } from '../../src/boot/boot.ts';
import { serverEnvKeys, useServerEnv } from '../fixtures/server-env.ts';
import { alpha } from '../fixtures/subgraphs/alpha.ts';
import { fixtureCatalog } from '../fixtures/subgraphs/catalog.ts';

describe('the exception filter', () => {
  const env = useServerEnv();
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

  /** Boots the server with the fixture modules in place of the in-repo ones. */
  async function bootFixtures(...manifests: readonly ModuleManifest[]): Promise<INestApplication> {
    const log = { info: vi.fn<(line: string) => void>(), error: vi.fn<(line: string) => void>() };
    app = await boot({ env, ...fixtureCatalog(...manifests), exit: vi.fn(), log });
    if (!app) throw new Error(`boot exited: ${log.error.mock.calls.join('\n')}`);
    return app;
  }

  it('E02-S04 the exception filter is registered once as APP_FILTER', async () => {
    const booted = await bootFixtures(alpha);

    // Where an instance of the filter is provided: the module and the provider's token.
    const registrations = [...booted.get(ModulesContainer).values()].flatMap((module) =>
      [...module.providers.values()]
        .filter(({ instance }) => instance instanceof DomainErrorFilter)
        .map(({ token }) => ({ module: module.metatype.name, token: String(token) })),
    );

    // Nest gives each APP_FILTER provider a token of its own that starts with APP_FILTER.
    expect(registrations).toEqual([
      { module: 'AppModule', token: expect.stringMatching(/^APP_FILTER\b/) },
    ]);
  });

  it("E02-S04 a request to a route that does not exist still gets Nest's 404", async () => {
    const booted = await bootFixtures(alpha);

    const response = await fetch(new URL('/no-such-route', await booted.getUrl()), {
      signal: AbortSignal.timeout(2000),
    });

    expect({ status: response.status, body: await response.json() }).toEqual({
      status: 404,
      body: { statusCode: 404, error: 'Not Found', message: 'Cannot GET /no-such-route' },
    });
  });
});
