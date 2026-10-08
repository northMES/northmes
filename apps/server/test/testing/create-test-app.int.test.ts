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
