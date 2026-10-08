// SPDX-License-Identifier: AGPL-3.0-or-later
import type { INestApplication } from '@nestjs/common';
import type { ModuleManifest } from '@northmes/sdk';
import { gqlClient } from '@northmes/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { boot } from '../../src/boot/boot.ts';
import { alpha } from '../fixtures/subgraphs/alpha.ts';
import { beta } from '../fixtures/subgraphs/beta.ts';
import { fixtureCatalog } from '../fixtures/subgraphs/catalog.ts';
import { EarlyQuery, probe } from '../fixtures/subgraphs/probe.ts';

// A valid server environment. PORT 0 lets the operating system pick a free port.
const env = { NODE_ENV: 'test', PORT: '0', NORTHMES_PUBLIC_ORIGIN: 'http://127.0.0.1:4100' };

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

/** Boots the server with the fixture modules in place of the in-repo ones and returns its URL. */
async function bootFixtures(...manifests: readonly ModuleManifest[]) {
  const log = { info: vi.fn<(line: string) => void>(), error: vi.fn<(line: string) => void>() };
  const exit = vi.fn<(code: number) => void>();
  app = await boot({ env, ...fixtureCatalog(...manifests), exit, log });
  if (!app) throw new Error(`boot exited: ${log.error.mock.calls.join('\n')}`);
  return { url: await app.getUrl(), log };
}

describe('the gateway on /graphql', () => {
  it('E02-S03 a query across two fixture subgraphs resolves the entity reference over HTTP', async () => {
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
  });

  it('E02-S03 /graphql answers 503 until the gateway has its schema', async () => {
    const { url } = await bootFixtures(alpha, beta, probe);

    const early = app?.get(EarlyQuery).answers;
    const ready = await gqlClient(url).send('{ __typename }');

    expect(early).toEqual([
      {
        status: 503,
        errors: [expect.objectContaining({ extensions: { code: 'UNAVAILABLE' } })],
      },
    ]);
    expect(ready).toEqual({ status: 200, data: { __typename: 'Query' } });
  });

  it('E02-S03 the boot log shows supergraph= and a 12 hex hash', async () => {
    const { log } = await bootFixtures(alpha, beta);

    const lines = log.info.mock.calls.map(([line]) => line);

    expect(lines).toContainEqual(expect.stringMatching(/\bsupergraph=[0-9a-f]{12}\b/));
  });
});
