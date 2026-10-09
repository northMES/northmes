// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, vi } from 'vitest';
import { loadWebConfig, ServerUnavailable } from '../src/config.ts';

const pageOrigin = 'https://web.northmes.test';

/** A fetch that answers every request with this response and records the URLs. */
function answering(response: () => Response) {
  return vi.fn(async (_url: string) => response());
}

describe('loadWebConfig', () => {
  it('E02-S05 the web reads the API URL from /config.json', async () => {
    const fetch = answering(() => Response.json({ apiUrl: 'https://api.northmes.test/mes' }));

    expect(await loadWebConfig(fetch, pageOrigin)).toEqual({
      apiUrl: 'https://api.northmes.test/mes',
    });
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(['/config.json']);
  });

  it("E02-S05 without a config.json the web uses the page's origin as the API URL", async () => {
    // A static host answers 404, and one with a fallback to the app answers index.html.
    const missing = answering(() => new Response('Not found', { status: 404 }));
    const fallback = answering(
      () => new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } }),
    );

    expect(await loadWebConfig(missing, pageOrigin)).toEqual({ apiUrl: pageOrigin });
    expect(await loadWebConfig(fallback, pageOrigin)).toEqual({ apiUrl: pageOrigin });
  });

  it("E02-S05 a config.json without an apiUrl leaves the API on the page's origin", async () => {
    const fetch = answering(() => Response.json({}));

    expect(await loadWebConfig(fetch, pageOrigin)).toEqual({ apiUrl: pageOrigin });
  });

  it('E02-S05 a config.json that is not a JSON object stops the web with the reason', async () => {
    const values = [null, [], 'https://api.northmes.test', 42];

    const reasons = await Promise.all(
      values.map((value) =>
        loadWebConfig(
          answering(() => Response.json(value)),
          pageOrigin,
        ).catch((error: unknown) => (error instanceof Error ? error.message : String(error))),
      ),
    );

    expect(reasons).toEqual(values.map(() => 'config.json: the file must hold a JSON object'));
  });

  it('E02-S05 a config.json whose apiUrl is no absolute http URL stops the web with the reason', async () => {
    const fetch = answering(() => Response.json({ apiUrl: '/api' }));

    await expect(loadWebConfig(fetch, pageOrigin)).rejects.toThrow(
      'config.json: apiUrl must be an absolute http or https URL, got /api',
    );
  });

  it('E04-S02 a config.json that answers 502, 503 or 504 is no answer: NorthMES may be restarting (shell-306 BO6)', async () => {
    for (const status of [502, 503, 504]) {
      await expect(
        loadWebConfig(
          answering(() => new Response('', { status })),
          pageOrigin,
        ),
      ).rejects.toBeInstanceOf(ServerUnavailable);
    }
  });

  it('E04-S02 a config.json that answers with a server error stops the web (shell-306 BO3)', async () => {
    await expect(
      loadWebConfig(
        answering(() => new Response('', { status: 500 })),
        pageOrigin,
      ),
    ).rejects.toThrow('config.json: the server answered 500');
  });
});
