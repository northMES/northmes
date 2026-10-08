// SPDX-License-Identifier: AGPL-3.0-or-later
import type { INestApplication } from '@nestjs/common';
import type { ModuleManifest } from '@northmes/sdk';
import { type GqlEvent, given, gqlClient } from '@northmes/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { boot } from '../../src/boot/boot.ts';
import { serverEnvKeys, useServerEnv } from '../fixtures/server-env.ts';
import { alpha } from '../fixtures/subgraphs/alpha.ts';
import { beta } from '../fixtures/subgraphs/beta.ts';
import { fixtureCatalog } from '../fixtures/subgraphs/catalog.ts';

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
async function bootFixtures(...manifests: readonly ModuleManifest[]): Promise<string> {
  const log = { info: vi.fn<(line: string) => void>(), error: vi.fn<(line: string) => void>() };
  const exit = vi.fn<(code: number) => void>();
  app = await boot({ env, ...fixtureCatalog(...manifests), exit, log });
  if (!app) throw new Error(`boot exited: ${log.error.mock.calls.join('\n')}`);
  return app.getUrl();
}

/** The first event of a subscription, after which the subscription ends. */
async function firstEvent<TData>(events: AsyncGenerator<GqlEvent<TData>, void>) {
  try {
    const { value } = await events.next();
    return value;
  } finally {
    await events.return();
  }
}

/** beta's subscription, with a field of alpha's Thing that the gateway joins through _entities. */
const crateArrived = `subscription ($plantId: ID!) {
  betaCrateArrived(plantId: $plantId) { plantId crate { label thing { name } } }
}`;

describe('subscriptions on /graphql', () => {
  it('E02-S03 a subscription delivers one event over graphql-ws', async () => {
    const url = await bootFixtures(alpha, beta);
    const plantId = given.plant();

    const event = await firstEvent(
      gqlClient(url).subscribe(crateArrived, { plantId }, { transport: 'graphql-ws' }),
    );

    expect(event).toEqual({
      data: {
        betaCrateArrived: { plantId, crate: { label: 'Crate one', thing: { name: 'Spindle' } } },
      },
    });
  });
});
