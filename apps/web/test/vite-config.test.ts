// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it, vi } from 'vitest';
import config from '../vite.config.ts';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the shell's dev server", () => {
  it('E02-S08 the shell dev server proxies each path of NORTHMES_DEV_PROXY to its origin, WebSockets included', () => {
    // What pnpm dev hands the shell: the planning remote's dev server, then the server.
    vi.stubEnv(
      'NORTHMES_DEV_PROXY',
      JSON.stringify({
        '/modules/planning/': 'http://127.0.0.1:41003',
        '/graphql': 'http://127.0.0.1:41001',
      }),
    );

    const { server } = config({ command: 'serve', mode: 'development' });

    expect(Object.entries(server?.proxy ?? {})).toEqual([
      ['/modules/planning/', { target: 'http://127.0.0.1:41003', ws: true }],
      ['/graphql', { target: 'http://127.0.0.1:41001', ws: true }],
    ]);
  });
});
