// SPDX-License-Identifier: AGPL-3.0-or-later
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiPath } from '@northmes/contracts';
import planning from '@northmes/module-planning/manifest';
import { API_CONTROLLER_METADATA } from '@northmes/sdk/rest';
import { hostFactoryWithWebFiles } from '@northmes/server/testing';
import { createTestApp, type TestApp } from '@northmes/testing';
import { afterEach, describe, expect, it, onTestFinished } from 'vitest';
import serverPackage from '../../package.json' with { type: 'json' };
import { GatewayService } from '../../src/gateway/gateway.module.ts';
import { WebModulesController } from '../../src/web/web-modules.controller.ts';

// Built web files in the layout hostFactoryWithWebFiles reads: the shell in shell/ and each module's
// remote in modules/<id>/. example-widget is not an in-repo module, so no catalog loads it.
const webFiles = fileURLToPath(new URL('../fixtures/web/', import.meta.url));

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

/**
 * Boots the in-repo modules that `modules` names with the web files under `files`, the fixture web
 * files by default, and returns its URL.
 */
async function serve(modules: readonly string[], files = webFiles): Promise<string> {
  testApp = await createTestApp({ modules, hostFactory: hostFactoryWithWebFiles(files) });
  await testApp.app.listen(0, '127.0.0.1');
  return testApp.app.getUrl();
}

describe('the web module list', () => {
  it('E02-S05 a disabled module is not listed', async () => {
    // The catalog loads core alone, so planning is disabled although its remote files are on disk.
    const url = await serve(['core']);

    const response = await fetch(`${url}${apiPath('web', 'modules')}`);

    expect(response.status).toBe(200);
    expect((await response.json()).modules).toEqual([]);
  });

  it('E02-S05 the module list answers at apiPath(web, modules) from a controller declared with ApiController', async () => {
    const url = await serve(['core', 'planning']);

    const response = await fetch(`${url}${apiPath('web', 'modules')}`);

    expect(Reflect.getMetadata(API_CONTROLLER_METADATA, WebModulesController)).toEqual({
      module: 'web',
      family: 'first-party',
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      northmes: serverPackage.version,
      supergraph: testApp?.app.get(GatewayService).supergraphHash ?? null,
      modules: [
        {
          id: 'planning',
          version: planning.version,
          remoteName: 'planning',
          label: 'Planning',
          order: 20,
          manifestUrl: `/modules/planning/${planning.version}/mf-manifest.json`,
          // openssl dgst -sha384 -binary mf-manifest.json | openssl base64 -A
          integrity: 'sha384-EOVzBkLaszq+sHkTtzbt+hlKXhDrKH/qCzoxnvfv+PzeUtG7NESQvDS9fEQ7loY8',
        },
      ],
    });
  });

  // The planning fixture's mf-manifest.json lists remoteEntry.js and one chunk of ./module.
  it.each(['remoteEntry.js', 'assets/module-5e8c1f2a.js'])(
    'E02-S05 a remote missing a file its manifest lists (%s) is listed with integrity null',
    async (missing) => {
      const files = mkdtempSync(join(tmpdir(), 'northmes-web-'));
      onTestFinished(() => rmSync(files, { recursive: true, force: true }));
      const remote = join(webFiles, 'modules', 'planning');
      cpSync(remote, join(files, 'modules', 'planning'), {
        recursive: true,
        filter: (source) => relative(remote, source) !== missing,
      });
      const url = await serve(['core', 'planning'], files);

      const response = await fetch(`${url}${apiPath('web', 'modules')}`);

      expect(existsSync(join(files, 'modules', 'planning', 'mf-manifest.json'))).toBe(true);
      expect(existsSync(join(files, 'modules', 'planning', missing))).toBe(false);
      expect((await response.json()).modules).toEqual([
        expect.objectContaining({ id: 'planning', integrity: null }),
      ]);
    },
  );

  it('E02-S05 a remote whose mf-manifest.json does not parse is listed with integrity null', async () => {
    const files = mkdtempSync(join(tmpdir(), 'northmes-web-'));
    onTestFinished(() => rmSync(files, { recursive: true, force: true }));
    const remote = join(files, 'modules', 'planning');
    cpSync(join(webFiles, 'modules', 'planning'), remote, { recursive: true });
    writeFileSync(join(remote, 'mf-manifest.json'), '{ "metaData": ');
    const url = await serve(['core', 'planning'], files);

    const response = await fetch(`${url}${apiPath('web', 'modules')}`);

    expect((await response.json()).modules).toEqual([
      expect.objectContaining({ id: 'planning', integrity: null }),
    ]);
  });
});

describe('the remote files', () => {
  it('E02-S05 hashed remote files are immutable and mf-manifest.json is no-cache', async () => {
    const remote = `${await serve(['core', 'planning'])}/modules/planning/${planning.version}`;

    const hashed = await cachingOf(`${remote}/assets/module-5e8c1f2a.js`);
    const manifest = await cachingOf(`${remote}/mf-manifest.json`);
    const entry = await cachingOf(`${remote}/remoteEntry.js`);
    const stats = await cachingOf(`${remote}/mf-stats.json`);

    expect(hashed).toEqual({ status: 200, cacheControl: 'public, max-age=31536000, immutable' });
    expect(manifest).toEqual({ status: 200, cacheControl: 'no-cache' });
    expect(entry).toEqual({ status: 200, cacheControl: 'no-cache' });
    expect(stats).toEqual({ status: 200, cacheControl: 'no-cache' });
  });

  it('E02-S05 a module outside the catalog gets 404 on its mf-manifest.json although its files are on disk', async () => {
    const url = await serve(['core', 'planning']);

    const response = await fetch(`${url}/modules/example-widget/0.0.0/mf-manifest.json`);

    expect(existsSync(join(webFiles, 'modules', 'example-widget', 'mf-manifest.json'))).toBe(true);
    expect(response.status).toBe(404);
  });

  it("E02-S05 a missing remote file answers 404 without the server's file path", async () => {
    const url = await serve(['core', 'planning']);
    const paths = [`/modules/planning/${planning.version}/assets/missing.js`, '/assets/missing.js'];

    const answers = await Promise.all(
      paths.map(async (path) => {
        const response = await fetch(`${url}${path}`);
        const body = await response.text();
        return { path, status: response.status, namesAFilePath: body.includes(webFiles) };
      }),
    );

    expect(answers).toEqual(paths.map((path) => ({ path, status: 404, namesAFilePath: false })));
  });
});

describe('the shell', () => {
  it('E02-S05 an SPA path answers with the strict self Content-Security-Policy', async () => {
    const url = await serve(['core', 'planning']);
    const index = readFileSync(join(webFiles, 'shell', 'index.html'), 'utf8');
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

  it('E02-S05 a server path such as /api/v1/unknown answers 404 instead of the shell', async () => {
    const url = await serve(['core', 'planning']);
    const index = readFileSync(join(webFiles, 'shell', 'index.html'), 'utf8');
    // Paths under first segments of the server's own routes (ADR 0064) that no route takes. The
    // static mount and the gateway take /assets/ and /graphql before the shell's route.
    const paths = ['/api/v1/unknown', '/health', '/mcp/unknown'];

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
});
