// SPDX-License-Identifier: AGPL-3.0-or-later
import type { INestApplication } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { boot } from '../../src/boot/boot.ts';
import { graphqlLimits } from '../../src/graphql/limits.ts';
import { GRAPHQL_PATH } from '../../src/graphql/server.ts';
import { alpha } from '../fixtures/graphql/alpha.ts';
import { serverEnvKeys, useServerEnv } from '../fixtures/server-env.ts';

// The body cap of #477 through the server's own HTTP stack, where Express parses JSON before Yoga
// and Yoga reads every other content type itself.

const env = useServerEnv();

let app: INestApplication | undefined;

beforeEach(() => {
  for (const key of serverEnvKeys) vi.stubEnv(key, undefined);
});

afterEach(async () => {
  await app?.close();
  app = undefined;
  vi.unstubAllEnvs();
});

describe('the request limits on the HTTP server (B4)', () => {
  it('B4 a body over the cap is refused before parsing, for each content type', async () => {
    const log = { info: vi.fn<(line: string) => void>(), error: vi.fn<(line: string) => void>() };
    app = await boot({ env, modules: [alpha], exit: vi.fn(), log });
    if (!app) throw new Error(`boot exited: ${log.error.mock.calls.join('\n')}`);
    const url = `${await app.getUrl()}${GRAPHQL_PATH}`;
    const padding = 'x'.repeat(graphqlLimits.maxBodyBytes);
    const bodies: Record<string, string> = {
      'application/json': JSON.stringify({
        query: `{ alphaThing(id: "t-1") { id } } # ${padding}`,
      }),
      'application/graphql+json': JSON.stringify({
        query: `{ alphaThing(id: "t-1") { id } } # ${padding}`,
      }),
      'application/graphql': `{ alphaThing(id: "t-1") { id } } # ${padding}`,
    };

    const statuses = Object.fromEntries(
      await Promise.all(
        Object.entries(bodies).map(async ([contentType, body]) => {
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': contentType },
            body,
          });
          return [contentType, response.status] as const;
        }),
      ),
    );

    expect(statuses).toEqual({
      'application/json': 413,
      'application/graphql+json': 413,
      'application/graphql': 413,
    });
  });
});
