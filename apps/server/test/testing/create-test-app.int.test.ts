// SPDX-License-Identifier: AGPL-3.0-or-later
import { ConfigService } from '@nestjs/config';
import { hostFactory } from '@northmes/server/testing';
import { createTestApp, type TestApp } from '@northmes/testing';
import { afterEach, describe, expect, it } from 'vitest';

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
