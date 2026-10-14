// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomBytes } from 'node:crypto';
import { createTestApp, type TestApp, useTestDatabase } from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthService } from '../../src/modules/core/core/access/auth.service.ts';
import { hostFactory, queryAsCore } from '../../src/testing.ts';
import { runCli } from '../fixtures/cli-run.ts';
import { useServerEnv } from '../fixtures/server-env.ts';

describe('northmes admin reset-password', () => {
  const db = useTestDatabase();
  const env = useServerEnv({ database: db });
  let testApp: TestApp;
  let url: string;

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
    url = await testApp.app.getUrl();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  /** A user who signs in with a password of their own. */
  async function givenSignedUpUser() {
    const username = `user_${randomBytes(5).toString('hex')}`;
    const email = `${username}@example.test`;
    const password = 'the password the user chose';
    const { user } = await testApp.app
      .get(AuthService)
      .createUser({ username, email, password });
    return { id: user.id, username, email, password };
  }

  /** The status of a sign-in with email and password. */
  async function signInStatus(email: string, password: string) {
    const response = await fetch(`${url}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return response.status;
  }

  it('E05-S05 reset-password prints a temporary password once, which signs the user in and must be replaced, and the old one stops working', {
    timeout: 60_000,
  }, async () => {
    const user = await givenSignedUpUser();

    const run = await runCli(
      ['admin', 'reset-password', '--username', user.username, '--reason', 'Locked out'],
      env,
    );
    const password = /Temporary password: (\S+)/.exec(run.out)?.[1] ?? '';
    const [marked] = await queryAsCore<{ mustChangePassword: boolean }>(
      db.ownerUrl,
      'select "mustChangePassword" from auth."user" where id = $1',
      [user.id],
    );

    expect(run.code).toBe(0);
    expect(password).toMatch(/^\S{12,}$/);
    expect(run.log.join('\n')).not.toContain(password);
    expect(await signInStatus(user.email, password)).toBe(200);
    expect(await signInStatus(user.email, user.password)).toBe(401);
    expect(marked?.mustChangePassword).toBe(true);
  });

  it('E05-S05 reset-password --json prints one object', { timeout: 60_000 }, async () => {
    const user = await givenSignedUpUser();

    const run = await runCli(
      ['admin', 'reset-password', '--username', user.username, '--reason', 'Locked out', '--json'],
      env,
    );

    expect(run.code).toBe(0);
    expect(JSON.parse(run.out)).toEqual({
      userId: user.id,
      username: user.username,
      temporaryPassword: expect.stringMatching(/^\S{12,}$/),
    });
  });

  it('E05-S05 an unknown username exits 4', { timeout: 60_000 }, async () => {
    const run = await runCli(
      ['admin', 'reset-password', '--username', 'nobody_here', '--reason', 'Locked out'],
      env,
    );

    expect(run.code).toBe(4);
    expect(run.out).toBe('');
  });

  it('E05-S05 a blocked user exits 3 and keeps their password', { timeout: 60_000 }, async () => {
    const user = await givenSignedUpUser();
    await testApp.app.get(AuthService).block(user.id, undefined);

    const run = await runCli(
      ['admin', 'reset-password', '--username', user.username, '--reason', 'Locked out'],
      env,
    );

    expect(run.code).toBe(3);
    expect(run.out).toBe('');
  });
});
