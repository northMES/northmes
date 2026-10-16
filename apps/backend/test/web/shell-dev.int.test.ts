// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { request } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { useTestDatabase } from '@northmes/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { boot } from '../../src/boot/boot.ts';
import { alpha } from '../fixtures/graphql/alpha.ts';
import { serverEnvKeys, useServerEnv } from '../fixtures/server-env.ts';

// Boot step 5 reads the migration records as nm_app, so the server needs a migrated database.
const db = useTestDatabase();
const env = useServerEnv({ database: db });

// The web app's origin in pnpm dev: Vite's dev server, which pnpm dev passes the server as its
// public origin. The server listens on a port of its own.
const webOrigin = 'http://127.0.0.1:4100';

let app: INestApplication | undefined;

beforeEach(() => {
  for (const key of serverEnvKeys) vi.stubEnv(key, undefined);
});

afterEach(async () => {
  await app?.close();
  app = undefined;
  vi.unstubAllEnvs();
});

/** Boots the server with NODE_ENV, whose public origin is the web app's, and returns its URL. */
async function serve(nodeEnv: string): Promise<URL> {
  app = await boot({
    env: { ...env, NODE_ENV: nodeEnv, NORTHMES_PUBLIC_ORIGIN: webOrigin },
    modules: [alpha],
    exit: () => {},
    log: { info: () => {}, error: () => {} },
  });
  return new URL((await app?.getUrl()) ?? '');
}

/** The status and Location of a GET of path on url, sent with the Host header host. */
function get(url: URL, path: string, host = url.host) {
  return new Promise<{ status: number | undefined; location: string | undefined }>(
    (resolve, reject) => {
      request({ hostname: url.hostname, port: url.port, path, headers: { host } }, (response) => {
        response.resume();
        resolve({ status: response.statusCode, location: response.headers.location });
      })
        .on('error', reject)
        .end();
    },
  );
}

describe('the shell in pnpm dev', () => {
  it("E02-S08 a page opened on the API's address redirects to the same path and query on the web app's origin", async () => {
    const url = await serve('development');

    const answers = await Promise.all(
      ['/', '/plant-a/planning/orders?status=released'].map((path) => get(url, path)),
    );

    expect(answers).toEqual([
      { status: 302, location: `${webOrigin}/` },
      { status: 302, location: `${webOrigin}/plant-a/planning/orders?status=released` },
    ]);
  });

  it("E02-S08 a path that starts with two slashes stays on the web app's origin", async () => {
    const url = await serve('development');

    const answer = await get(url, '//example.com/plant-a');

    expect(answer).toEqual({ status: 302, location: `${webOrigin}//example.com/plant-a` });
  });

  it("E02-S08 a request that carries the web app's host gets the shell, as Vite forwards it", async () => {
    const url = await serve('development');

    const answer = await get(url, '/plant-a/planning', new URL(webOrigin).host);

    expect(answer.status).not.toBe(302);
  });

  it('E02-S05 outside development a page on the API address gets the shell, not a redirect', async () => {
    const url = await serve('test');

    const answer = await get(url, '/plant-a/planning');

    expect(answer.status).not.toBe(302);
  });
});
