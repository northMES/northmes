// SPDX-License-Identifier: AGPL-3.0-or-later
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { hostFactory, hostFactoryWithShell } from '@northmes/backend/testing';
import { SubgraphRegistry } from '@northmes/sdk/graphql';
import { createTestApp, type TestApp } from '@northmes/testing';
import { afterEach, describe, expect, it, onTestFinished } from 'vitest';

let testApp: TestApp | undefined;

afterEach(async () => {
  await testApp?.app.close();
  testApp = undefined;
});

describe('createTestApp', () => {
  it('E02-S02 createTestApp boots the in-repo modules in the test process', async () => {
    testApp = await createTestApp({ modules: ['planning', 'core'], hostFactory });

    // The catalog check put the modules in boot order, core first.
    expect(testApp.modules).toEqual(['core', 'planning']);
    // The app runs in this process with the ConfigModule that configForTest built: serverEnvSchema
    // reads PORT as a number, and process.env has no PORT.
    expect(testApp.app.get(ConfigService).get('PORT')).toBe(0);
  });

  it("E02-S04 createTestApp builds a subgraph from each module's server entry", async () => {
    testApp = await createTestApp({ modules: ['core'], hostFactory });

    const subgraphs = testApp.app.get(SubgraphRegistry).all();

    // The subgraph is named after the module's GraphQL name, as on the real boot.
    expect(subgraphs.map(({ name }) => name)).toEqual(['core']);
  });
});

describe('hostFactory', () => {
  // Nest aborts the process on a provider error by default, which ends the Vitest worker and hides
  // the cause.
  it('E02-S02 hostFactory rejects with the cause when a provider fails to build', async () => {
    const built = hostFactory({
      modules: ['core'],
      config: {
        module: class BrokenConfig {},
        global: true,
        providers: [
          {
            provide: 'broken',
            useFactory: () => {
              throw new Error('broken provider');
            },
          },
        ],
      },
    });

    await expect(built).rejects.toThrow('broken provider');
  });
});

describe('hostFactoryWithShell', () => {
  it('E02-S05 hostFactoryWithShell serves the web app from the folder it is given', async () => {
    const shellDir = mkdtempSync(join(tmpdir(), 'northmes-web-'));
    onTestFinished(() => rmSync(shellDir, { recursive: true, force: true }));
    mkdirSync(join(shellDir, 'assets'), { recursive: true });
    writeFileSync(join(shellDir, 'assets', 'index-0a1b2c3d.js'), 'export const entry = 1;\n');
    testApp = await createTestApp({
      modules: ['core', 'planning'],
      hostFactory: hostFactoryWithShell(shellDir),
    });
    await testApp.app.listen(0, '127.0.0.1');

    const response = await fetch(`${await testApp.app.getUrl()}/assets/index-0a1b2c3d.js`);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('export const entry = 1;\n');
  });
});
