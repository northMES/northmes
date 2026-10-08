// SPDX-License-Identifier: AGPL-3.0-or-later
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hostFactoryWithShell } from '@northmes/backend/testing';
import { createTestApp, type TestApp } from '@northmes/testing';
import { afterEach, describe, expect, it } from 'vitest';

// A built web app in the layout apps/web builds: index.html and the hashed files in assets/.
const shellDir = fileURLToPath(new URL('../fixtures/web/shell/', import.meta.url));

let testApp: TestApp | undefined;

afterEach(async () => {
  await testApp?.app.close();
  testApp = undefined;
});

/** The status and the Cache-Control header of a GET of `url`. */
async function cachingOf(url: string) {
  const response = await fetch(url);
  return { status: response.status, cacheControl: response.headers.get('cache-control') };
}

/** Boots the in-repo modules that `modules` names with the fixture web app and returns its URL. */
async function serve(modules: readonly string[]): Promise<string> {
  testApp = await createTestApp({ modules, hostFactory: hostFactoryWithShell(shellDir) });
  await testApp.app.listen(0, '127.0.0.1');
  return testApp.app.getUrl();
}

describe('the shell', () => {
  it('E02-S05 an SPA path answers with the strict self Content-Security-Policy', async () => {
    const url = await serve(['core', 'planning']);
    const index = readFileSync(join(shellDir, 'index.html'), 'utf8');
    // The root, a module screen under a plant and a station: the SPA paths of ADR 0064.
    const paths = ['/', '/01920000-0000-7000-8000-000000000001/planning', '/station/station-1'];

    const answers = await Promise.all(
      paths.map(async (path) => {
        const response = await fetch(`${url}${path}`);
        return {
          path,
          status: response.status,
          csp: response.headers.get('content-security-policy'),
          cacheControl: response.headers.get('cache-control'),
          body: await response.text(),
        };
      }),
    );

    const csp =
      "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; " +
      "img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'";
    expect(answers).toEqual(
      paths.map((path) => ({ path, status: 200, csp, cacheControl: 'no-cache', body: index })),
    );
  });

  it('E02-S05 a server path such as /api/v1/unknown or a removed remote file answers 404 instead of the shell', async () => {
    const url = await serve(['core', 'planning']);
    const index = readFileSync(join(shellDir, 'index.html'), 'utf8');
    // Paths under first segments of the server's own routes (ADR 0064) that no route takes. The
    // static mount and GraphQL take /assets/ and /graphql before the shell's route. /modules/ held
    // the module remotes, so a stale client that asks for a remote file gets 404, not the shell.
    const paths = [
      '/api/v1/unknown',
      '/health',
      '/mcp/unknown',
      '/modules/planning/0.1.0/remoteEntry.js',
    ];

    const answers = await Promise.all(
      paths.map(async (path) => {
        const response = await fetch(`${url}${path}`);
        return {
          path,
          status: response.status,
          csp: response.headers.get('content-security-policy'),
          isTheShell: (await response.text()) === index,
        };
      }),
    );

    expect(answers).toEqual(
      paths.map((path) => ({ path, status: 404, csp: null, isTheShell: false })),
    );
  });

  it('E02-S05 hashed shell assets are immutable', async () => {
    const url = await serve(['core', 'planning']);

    const asset = await cachingOf(`${url}/assets/index-7b3e9a1c.js`);

    expect(asset).toEqual({ status: 200, cacheControl: 'public, max-age=31536000, immutable' });
  });

  it("E02-S05 a missing asset answers 404 without the server's file path", async () => {
    const url = await serve(['core', 'planning']);

    const response = await fetch(`${url}/assets/missing.js`);

    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain(shellDir);
  });
});
