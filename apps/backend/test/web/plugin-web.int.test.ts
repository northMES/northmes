// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineModule } from '@northmes/sdk';
import { createTestApp, given, type TestApp, useTestDatabase } from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hostFactoryWithPlugins, type SourcePlugin, signInAt } from '../../src/testing.ts';

const fixture = new URL('../fixtures/plugins/web-hello/', import.meta.url);
const webOrigin = 'https://web.example';

/** A plugin with screens: its manifest's web block and the web/ folder pnpm plugin:build wrote. */
const hello: SourcePlugin = {
  manifest: defineModule({
    id: 'example-hello',
    version: '0.1.0',
    northmes: '>=0.0.0-0 <1.0.0-0',
    dependsOn: ['core'],
    web: {
      label: 'Hello',
      icon: 'Hand',
      order: 50,
      contributes: [],
    },
  }),
  migrationsDir: fileURLToPath(new URL('migrations', fixture)),
  webDir: fileURLToPath(new URL('web', fixture)),
};

/** A plugin without screens, which the plugin list leaves out. */
const serverOnly: SourcePlugin = {
  manifest: defineModule({
    id: 'example-quiet',
    version: '0.1.0',
    northmes: '>=0.0.0-0 <1.0.0-0',
    dependsOn: ['core'],
  }),
  migrationsDir: fileURLToPath(new URL('migrations', fixture)),
};

/**
 * The backend serves each plugin's web part and lists the plugins that have one, so the shell can
 * load their screens at run time (ADR 0075).
 */
describe('plugin web parts', () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;
  let url = '';

  beforeAll(async () => {
    testApp = await createTestApp({
      modules: ['core'],
      hostFactory: hostFactoryWithPlugins([hello, serverOnly]),
      database: db,
      webOrigins: [webOrigin],
    });
    await testApp.app.listen(0, '127.0.0.1');
    url = await testApp.app.getUrl();
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  it('GET /api/v1/web/plugins refuses a request without a session with 401', async () => {
    const response = await fetch(`${url}/api/v1/web/plugins`);

    expect(response.status).toBe(401);
  });

  it('GET /api/v1/web/plugins lists each plugin with a web part, with its entry URL and its manifest web facts, and is no-store', async () => {
    if (!testApp) throw new Error('the test app did not start');
    const headers = await signInAt(testApp.app, db.ownerUrl, given.plant());

    const response = await fetch(`${url}/api/v1/web/plugins`, { headers });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      plugins: [
        {
          id: 'example-hello',
          version: '0.1.0',
          entry: '/api/v1/web/plugins/example-hello/0.1.0/entry.js',
          label: 'Hello',
          icon: 'Hand',
          order: 50,
          contributes: [],
        },
      ],
    });
  });

  it('serves a file of the web part as immutable JavaScript with nosniff, to anyone', async () => {
    const response = await fetch(`${url}/api/v1/web/plugins/example-hello/0.1.0/hello.js`);

    expect({
      status: response.status,
      type: response.headers.get('content-type'),
      nosniff: response.headers.get('x-content-type-options'),
      cacheControl: response.headers.get('cache-control'),
      body: await response.text(),
    }).toEqual({
      status: 200,
      type: 'text/javascript; charset=utf-8',
      nosniff: 'nosniff',
      cacheControl: 'public, max-age=31536000, immutable',
      body: readFileSync(new URL('web/hello.js', fixture), 'utf8'),
    });
  });

  it('answers 404 for another version, another plugin, a missing file and any path out of the web folder', async () => {
    const paths = [
      '/api/v1/web/plugins/example-hello/0.0.9/entry.js',
      '/api/v1/web/plugins/example-quiet/0.1.0/entry.js',
      '/api/v1/web/plugins/example-hello/0.1.0/missing.js',
      '/api/v1/web/plugins/example-hello/0.1.0/../package.json',
      '/api/v1/web/plugins/example-hello/0.1.0/%2e%2e/package.json',
      '/api/v1/web/plugins/example-hello/0.1.0/',
    ];

    const answers = await Promise.all(
      paths.map(async (path) => {
        const response = await fetch(`${url}${path}`);
        return { path, status: response.status, body: await response.text() };
      }),
    );

    expect(answers).toEqual(paths.map((path) => ({ path, status: 404, body: '' })));
  });

  it('lets a web origin load a file as a module script, and refuses any other origin', async () => {
    const file = `${url}/api/v1/web/plugins/example-hello/0.1.0/entry.js`;

    const sameOrigin = await fetch(file);
    const fromWeb = await fetch(file, { headers: { origin: webOrigin } });
    const fromElsewhere = await fetch(file, { headers: { origin: 'https://evil.example' } });

    // Every answer varies by Origin, so a cache never hands the same-origin copy to a web origin.
    expect(sameOrigin.headers.get('vary')).toBe('Origin');
    expect(fromWeb.status).toBe(200);
    expect(fromWeb.headers.get('access-control-allow-origin')).toBe(webOrigin);
    expect(fromElsewhere.status).toBe(403);
    expect(fromElsewhere.headers.get('access-control-allow-origin')).toBeNull();
  });
});
