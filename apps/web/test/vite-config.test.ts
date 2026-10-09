// SPDX-License-Identifier: AGPL-3.0-or-later
import { afterEach, describe, expect, it, vi } from 'vitest';
import config from '../vite.config.ts';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("the web's dev server", () => {
  it('E02-S08 the web dev server proxies /graphql and /api to NORTHMES_API_ORIGIN, WebSockets included', () => {
    // What pnpm dev hands the web's dev server: the origin of the backend on the stack's PORT.
    vi.stubEnv('NORTHMES_API_ORIGIN', 'http://127.0.0.1:41001');

    const { server } = config({ command: 'serve', mode: 'development' });

    expect(server?.proxy).toEqual({
      '/graphql': { target: 'http://127.0.0.1:41001', ws: true },
      '/api': { target: 'http://127.0.0.1:41001', ws: true },
    });
  });

  it('E02-S08 the web dev server proxies nothing without NORTHMES_API_ORIGIN', () => {
    vi.stubEnv('NORTHMES_API_ORIGIN', undefined);

    const { server } = config({ command: 'serve', mode: 'development' });

    expect(server?.proxy).toEqual({});
  });
});
