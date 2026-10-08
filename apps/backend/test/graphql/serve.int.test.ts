// SPDX-License-Identifier: AGPL-3.0-or-later
import type { INestApplication } from '@nestjs/common';
import type { ModuleManifest } from '@northmes/sdk';
import { gqlClient } from '@northmes/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { boot } from '../../src/boot/boot.ts';
import { AlphaThings, alpha } from '../fixtures/graphql/alpha.ts';
import { beta } from '../fixtures/graphql/beta.ts';
import { fixtureCatalog } from '../fixtures/graphql/catalog.ts';
import { serverEnvKeys, useServerEnv } from '../fixtures/server-env.ts';

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

/** Boots the server with the fixture modules in place of the in-repo ones and returns its URL. */
async function bootFixtures(...manifests: readonly ModuleManifest[]) {
  const log = { info: vi.fn<(line: string) => void>(), error: vi.fn<(line: string) => void>() };
  const exit = vi.fn<(code: number) => void>();
  app = await boot({ env, ...fixtureCatalog(...manifests), exit, log });
  if (!app) throw new Error(`boot exited: ${log.error.mock.calls.join('\n')}`);
  return { url: await app.getUrl(), log };
}

describe('the one schema on /graphql', () => {
  it("E02-S03 a query resolves a field that one module adds with another module's API over HTTP", async () => {
    const { url } = await bootFixtures(alpha, beta);

    const answer = await gqlClient(url).send('{ betaCrates { label thing { id name } } }');

    expect(answer).toEqual({
      status: 200,
      data: {
        betaCrates: [
          { label: 'Crate one', thing: { id: 't-1', name: 'Spindle' } },
          { label: 'Crate two', thing: { id: 't-2', name: 'Gear wheel' } },
        ],
      },
    });
    // The request's loader read the things of both crates in one call of alpha's API.
    expect(app?.get(AlphaThings).batches).toEqual([['t-1', 't-2']]);
  });

  it('E02-S03 the schema holds the root fields of every booted module', async () => {
    const { url } = await bootFixtures(alpha, beta);

    const answer = await gqlClient(url).send<{
      __schema: { queryType: { fields: { name: string }[] } };
    }>('{ __schema { queryType { fields { name } } } }');

    const names = answer.data?.__schema.queryType.fields.map(({ name }) => name);
    expect(names).toEqual(['alphaThing', 'betaCrates']);
  });
});
