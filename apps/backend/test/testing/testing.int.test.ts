// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { createTestApp, type TestApp, useTestDatabase } from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { givenCompany, hostFactory, signIn, statementsDuring } from '../../src/testing.ts';

// The fixtures of apps/backend/src/testing.ts, which the behaviour tests build on.
describe('the backend test fixtures', () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  it('E05-S05 signIn fails with the status and body when /api/auth/token refuses the session token', async () => {
    if (!testApp) throw new Error('the test app did not start');
    const { plants } = await givenCompany(db.ownerUrl);
    const [plant = ''] = plants;
    const realFetch = globalThis.fetch;
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation((input, init) =>
        String(input).endsWith('/api/auth/token')
          ? Promise.resolve(new Response('{"message":"refused"}', { status: 401 }))
          : realFetch(input, init),
      );

    try {
      await expect(
        signIn(testApp.app, db.ownerUrl, [{ scopeId: plant, permissions: ['core.article:read'] }]),
      ).rejects.toThrow('signIn: /api/auth/token answered 401: {"message":"refused"}');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('E02-S04 statementsDuring refuses a second recording of the same pool while the first runs', async () => {
    if (!testApp) throw new Error('the test app did not start');
    const { app } = testApp;
    let finishFirst = () => {};
    const first = statementsDuring(
      app,
      () =>
        new Promise<void>((resolve) => {
          finishFirst = resolve;
        }),
    );

    await expect(statementsDuring(app, async () => 'second')).rejects.toThrow(/already recording/);
    finishFirst();
    await first;
    await expect(statementsDuring(app, async () => 'third')).resolves.toMatchObject({
      result: 'third',
    });
  });
});
