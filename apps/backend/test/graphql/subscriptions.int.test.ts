// SPDX-License-Identifier: AGPL-3.0-or-later
import { connect } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import type { ModuleManifest } from '@northmes/sdk';
import { type GqlEvent, given, gqlClient } from '@northmes/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { boot } from '../../src/boot/boot.ts';
import { alpha } from '../fixtures/graphql/alpha.ts';
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

/**
 * Sends a WebSocket upgrade request to the path and returns what the server writes before it
 * closes the socket. A server that has not closed the socket after two seconds gets it destroyed,
 * and the answer is then what it wrote until that moment.
 */
function upgradeAnswer(url: string, path: string): Promise<string> {
  const { hostname, port } = new URL(url);
  return new Promise((resolve, reject) => {
    const socket = connect({ host: hostname, port: Number(port) });
    let answer = '';
    socket.setEncoding('utf8');
    socket.setTimeout(2000, () => socket.destroy());
    socket.on('data', (chunk: string) => {
      answer += chunk;
    });
    socket.on('close', () => resolve(answer));
    socket.on('error', reject);
    socket.write(
      [
        `GET ${path} HTTP/1.1`,
        `Host: ${hostname}:${port}`,
        'Connection: Upgrade',
        'Upgrade: websocket',
        'Sec-WebSocket-Version: 13',
        'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
        '',
        '',
      ].join('\r\n'),
    );
  });
}

/** beta's subscription, with alpha's Thing, which beta's thing field reads through alpha's API. */
const crateArrived = `subscription ($plantId: ID!) {
  betaCrateArrived(plantId: $plantId) { plantId crate { label thing { name } } }
}`;

/** The one event of betaCrateArrived at a plant. */
function crateOneArrived(plantId: string): GqlEvent {
  return {
    data: {
      betaCrateArrived: { plantId, crate: { label: 'Crate one', thing: { name: 'Spindle' } } },
    },
  };
}

describe('subscriptions on /graphql', () => {
  it('E02-S03 a subscription delivers one event over graphql-ws', async () => {
    const url = await bootFixtures(alpha, beta);
    const plantId = given.plant();
    const client = gqlClient(url);
    // A screen loads its data over HTTP before it subscribes.
    await client.send('{ betaCrates { label } }');

    const event = await firstEvent(
      client.subscribe(crateArrived, { plantId }, { transport: 'graphql-ws' }),
    );

    expect(event).toEqual(crateOneArrived(plantId));
  });

  it('E02-S03 a subscription delivers one event over SSE', async () => {
    const url = await bootFixtures(alpha, beta);
    const plantId = given.plant();

    const event = await firstEvent(
      gqlClient(url).subscribe(crateArrived, { plantId }, { transport: 'sse' }),
    );

    expect(event).toEqual(crateOneArrived(plantId));
  });

  it('E02-S03 a subscription sent before the first HTTP request works', async () => {
    const url = await bootFixtures(alpha, beta);
    const plantId = given.plant();

    const event = await firstEvent(
      gqlClient(url).subscribe(crateArrived, { plantId }, { transport: 'graphql-ws' }),
    );

    expect(event).toEqual(crateOneArrived(plantId));
  });

  it('E02-S03 an upgrade request to another path gets 404 and its socket closes', async () => {
    const url = await bootFixtures(alpha, beta);

    const answer = await upgradeAnswer(url, '/api/v1/web/modules');

    expect(answer).toMatch(/^HTTP\/1\.1 404 Not Found\r\n/);
  });
});
