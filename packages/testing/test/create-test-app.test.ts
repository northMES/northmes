// SPDX-License-Identifier: MIT
import { NestFactory } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { createTestApp, type HostFactory } from '../src/create-test-app.ts';

describe('createTestApp', () => {
  it('E02-S02 createTestApp closes the app when its init fails and rejects with the cause', async () => {
    let shutDown = false;
    // A host whose only provider fails in onModuleInit, which app.init() runs, and records the
    // shutdown hook that app.close() runs.
    const hostFactory: HostFactory = async ({ config }) => {
      const app = await NestFactory.create(
        {
          module: class InitFails {},
          imports: [config],
          providers: [
            {
              provide: 'init-fails',
              useValue: {
                onModuleInit() {
                  throw new Error('init failed');
                },
                onApplicationShutdown() {
                  shutDown = true;
                },
              },
            },
          ],
        },
        { logger: false, abortOnError: false },
      );
      return { app, modules: [] };
    };

    await expect(createTestApp({ modules: [], hostFactory })).rejects.toThrow('init failed');
    expect(shutDown).toBe(true);
  });
});
