// SPDX-License-Identifier: AGPL-3.0-or-later
import { fileURLToPath } from 'node:url';
import { apiPath } from '@northmes/contracts';
import { hostFactoryWithWebFiles } from '@northmes/server/testing';
import { createTestApp, type TestApp } from '@northmes/testing';
import { afterEach, describe, expect, it } from 'vitest';

// Built web files in the layout hostFactoryWithWebFiles reads: each module's remote in modules/<id>/.
const webFiles = fileURLToPath(new URL('../fixtures/web/', import.meta.url));

let testApp: TestApp | undefined;

afterEach(async () => {
  await testApp?.app.close();
  testApp = undefined;
});

/** Boots the in-repo modules that `modules` names with the fixture web files, and returns its URL. */
async function serve(modules: readonly string[]): Promise<string> {
  testApp = await createTestApp({ modules, hostFactory: hostFactoryWithWebFiles(webFiles) });
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
});
