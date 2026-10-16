// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { randomBytes, randomUUIDv7 } from 'node:crypto';
import { createTestApp, gqlClient, type TestApp, useTestDatabase } from '@northmes/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthService } from '../../src/modules/core/core/access/auth.service.ts';
import { fromNewClient, givenCompany, hostFactory, queryAsCore } from '../../src/testing.ts';
import { runCli } from '../fixtures/cli-run.ts';
import { useServerEnv } from '../fixtures/server-env.ts';

/** A username no other test of the file uses. */
function freshUsername(): string {
  return `admin_${randomBytes(5).toString('hex')}`;
}

describe('northmes company', () => {
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

  /** The status of a sign-in with email and password, and the session token on success. */
  async function signInWith(email: string, password: string) {
    const response = await fetch(`${url}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...fromNewClient() },
      body: JSON.stringify({ email, password }),
    });
    return { status: response.status, sessionToken: response.headers.get('set-auth-token') };
  }

  /** The JWT header of a session token, from /api/auth/token. */
  async function jwtOf(sessionToken: string) {
    const token = await fetch(`${url}/api/auth/token`, {
      headers: { authorization: `Bearer ${sessionToken}` },
    });
    const { token: jwt } = (await token.json()) as { token: string };
    return `Bearer ${jwt}`;
  }

  /** The role keys the user holds at the company node, sorted. */
  async function companyRolesOf(userId: string, companyId: string) {
    const rows = await queryAsCore<{ key: string }>(
      db.ownerUrl,
      `select r.key from core.role_assignment a join core.role r on r.id = a.role_id
        where a.user_id = $1 and a.scope_id = $2 order by r.key`,
      [userId, companyId],
    );
    return rows.map(({ key }) => key);
  }

  /** The Better Auth roles the user holds in the organization of the company. */
  async function membershipsOf(userId: string, companyId: string) {
    const rows = await queryAsCore<{ role: string }>(
      db.ownerUrl,
      `select m.role from auth.member m join core.company c on c.organization_id = m."organizationId"
        where m."userId" = $1 and c.id = $2`,
      [userId, companyId],
    );
    return rows.map(({ role }) => role);
  }

  /** Runs company create for a new admin with --json and returns the parsed answer. */
  async function createCompany(extra: readonly string[] = []) {
    const username = freshUsername();
    const run = await runCli(
      [
        'company',
        'create',
        '--name',
        'Acme AB',
        '--admin-username',
        username,
        '--admin-email',
        `${username}@example.test`,
        '--reason',
        'New customer',
        '--json',
        ...extra,
      ],
      env,
    );
    return { run, username, answer: JSON.parse(run.out || '{}') as Record<string, unknown> };
  }

  it('E05-S14 company create writes the company and its first Company admin, who signs in with the temporary password printed once and must set a new one', {
    timeout: 60_000,
  }, async () => {
    const username = freshUsername();
    const email = `${username}@example.test`;

    const run = await runCli(
      [
        'company',
        'create',
        '--name',
        'Acme AB',
        '--admin-username',
        username,
        '--admin-email',
        email,
        '--admin-name',
        'Ada Admin',
        '--reason',
        'New customer',
      ],
      env,
    );
    const password = /Temporary password: (\S+)/.exec(run.out)?.[1] ?? '';
    const companyId = /Company Acme AB \((\S+)\)/.exec(run.out)?.[1] ?? '';
    const [user] = await queryAsCore<{ id: string; name: string }>(
      db.ownerUrl,
      `select id, name from auth."user" where username = $1`,
      [username],
    );
    const signedIn = await signInWith(email, password);
    const answer = await gqlClient(url, {
      headers: { authorization: await jwtOf(signedIn.sessionToken ?? '') },
    }).send('{ coreCompanies { id } }');

    expect(run.code).toBe(0);
    expect(password).toMatch(/^\S{12,}$/);
    expect(run.out.split(password)).toHaveLength(2);
    expect(run.log.join('\n')).not.toContain(password);
    expect(user?.name).toBe('Ada Admin');
    expect(await companyRolesOf(user?.id ?? '', companyId)).toEqual(['core-company-admin']);
    expect(await membershipsOf(user?.id ?? '', companyId)).toEqual(['owner']);
    expect(signedIn.status).toBe(200);
    expect(answer.errors?.[0]?.extensions).toMatchObject({
      errorCode: 'core.password_change_required',
    });
  });

  it('E05-S14 company create --json prints one object with the company, the admin and the temporary password', {
    timeout: 60_000,
  }, async () => {
    const { run, username, answer } = await createCompany();

    expect(run.code).toBe(0);
    expect(answer).toEqual({
      companyId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      name: 'Acme AB',
      adminUserId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      adminUsername: username,
      replayed: false,
      temporaryPassword: expect.any(String),
    });
  });

  it('E05-S14 a replay with the same id creates nothing, exits 0 with replayed true and prints no password', {
    timeout: 60_000,
  }, async () => {
    const id = randomUUIDv7();
    const username = freshUsername();
    const args = [
      'company',
      'create',
      '--id',
      id,
      '--name',
      'Replay AB',
      '--admin-username',
      username,
      '--admin-email',
      `${username}@example.test`,
      '--reason',
      'New customer',
      '--json',
    ];

    const first = await runCli(args, env);
    const second = await runCli(args, env);
    const companies = await queryAsCore(db.ownerUrl, 'select id from core.company where id = $1', [
      id,
    ]);

    expect(first.code).toBe(0);
    expect(second.code).toBe(0);
    expect(JSON.parse(second.out)).toEqual({
      companyId: id,
      name: 'Replay AB',
      adminUserId: JSON.parse(first.out).adminUserId,
      adminUsername: username,
      replayed: true,
    });
    expect(companies).toHaveLength(1);
  });

  it('E05-S14 the same id with another name exits 3 and changes nothing', {
    timeout: 60_000,
  }, async () => {
    const id = randomUUIDv7();
    const { run } = await createCompany(['--id', id]);

    const again = await runCli(
      [
        'company',
        'create',
        '--id',
        id,
        '--name',
        'Other AB',
        '--admin-username',
        freshUsername(),
        '--admin-email',
        `${freshUsername()}@example.test`,
        '--reason',
        'New customer',
      ],
      env,
    );
    const [company] = await queryAsCore<{ name: string }>(
      db.ownerUrl,
      'select name from core.company where id = $1',
      [id],
    );

    expect(run.code).toBe(0);
    expect(again.code).toBe(3);
    expect(again.log.join('\n')).toContain(`Company ${id} exists with other input`);
    expect(company?.name).toBe('Acme AB');
  });

  it('E05-S14 with the organization and the user written and no core rows, a rerun creates the company once, exits 0 with replayed false and prints no password', {
    timeout: 60_000,
  }, async () => {
    const id = randomUUIDv7();
    const { username } = await createCompany(['--id', id]);
    // A first run that stopped after Better Auth's writes: the core rows are gone.
    await queryAsCore(db.ownerUrl, 'delete from core.role_assignment where company_id = $1', [id]);
    await queryAsCore(db.ownerUrl, 'delete from core.role where company_id = $1', [id]);
    await queryAsCore(db.ownerUrl, 'delete from core.company where id = $1', [id]);
    await queryAsCore(db.ownerUrl, 'delete from core.scope where id = $1', [id]);

    const rerun = await runCli(
      [
        'company',
        'create',
        '--id',
        id,
        '--name',
        'Acme AB',
        '--admin-username',
        username,
        '--admin-email',
        `${username}@example.test`,
        '--reason',
        'New customer',
        '--json',
      ],
      env,
    );
    const answer = JSON.parse(rerun.out) as { adminUserId: string };

    expect(rerun.code).toBe(0);
    expect(answer).toMatchObject({ companyId: id, replayed: false });
    expect(answer).not.toHaveProperty('temporaryPassword');
    expect(await companyRolesOf(answer.adminUserId, id)).toEqual(['core-company-admin']);
  });

  it('E05-S14 with the organization written and no core rows, a rerun naming another admin exits 3 and gives nobody the role', {
    timeout: 60_000,
  }, async () => {
    const id = randomUUIDv7();
    await createCompany(['--id', id]);
    await queryAsCore(db.ownerUrl, 'delete from core.role_assignment where company_id = $1', [id]);
    await queryAsCore(db.ownerUrl, 'delete from core.role where company_id = $1', [id]);
    await queryAsCore(db.ownerUrl, 'delete from core.company where id = $1', [id]);
    await queryAsCore(db.ownerUrl, 'delete from core.scope where id = $1', [id]);
    const other = freshUsername();

    const rerun = await runCli(
      [
        'company',
        'create',
        '--id',
        id,
        '--name',
        'Acme AB',
        '--admin-username',
        other,
        '--admin-email',
        `${other}@example.test`,
        '--reason',
        'New customer',
      ],
      env,
    );

    expect(rerun.code).toBe(3);
    expect(rerun.log.join('\n')).toContain(`An earlier run under ${id} named another admin`);
    expect(
      await queryAsCore(db.ownerUrl, 'select id from core.company where id = $1', [id]),
    ).toEqual([]);
    expect(
      await queryAsCore(db.ownerUrl, 'select id from auth."user" where username = $1', [other]),
    ).toEqual([]);
  });

  it('E05-S14 an existing username gets the Company admin role and no new password', {
    timeout: 60_000,
  }, async () => {
    const username = freshUsername();
    const email = `${username}@example.test`;
    const { user } = await testApp.app
      .get(AuthService)
      .createUser({ username, email, password: 'a password of the existing user' });

    const run = await runCli(
      [
        'company',
        'create',
        '--name',
        'Second AB',
        '--admin-username',
        username,
        '--admin-email',
        email,
        '--reason',
        'New customer',
        '--json',
      ],
      env,
    );
    const answer = JSON.parse(run.out) as { companyId: string };

    expect(run.code).toBe(0);
    expect(answer).not.toHaveProperty('temporaryPassword');
    expect(await companyRolesOf(user.id, answer.companyId)).toEqual(['core-company-admin']);
    expect((await signInWith(email, 'a password of the existing user')).status).toBe(200);
  });

  it('E05-S14 an existing username with another email exits 3 and creates no company', {
    timeout: 60_000,
  }, async () => {
    const username = freshUsername();
    await testApp.app.get(AuthService).createUser({
      username,
      email: `${username}@example.test`,
      password: 'a password of the existing user',
    });
    const id = randomUUIDv7();

    const run = await runCli(
      [
        'company',
        'create',
        '--id',
        id,
        '--name',
        'Third AB',
        '--admin-username',
        username,
        '--admin-email',
        'someone.else@example.test',
        '--reason',
        'New customer',
      ],
      env,
    );

    expect(run.code).toBe(3);
    expect(
      await queryAsCore(db.ownerUrl, 'select id from core.company where id = $1', [id]),
    ).toEqual([]);
  });

  it('E05-S14 add-admin restores a company whose Company admins were all removed', {
    timeout: 60_000,
  }, async () => {
    const { company } = await givenCompany(db.ownerUrl);
    const username = freshUsername();
    const email = `${username}@example.test`;

    const run = await runCli(
      [
        'company',
        'add-admin',
        '--company',
        company,
        '--username',
        username,
        '--email',
        email,
        '--reason',
        'Lost every admin',
        '--json',
      ],
      env,
    );
    const answer = JSON.parse(run.out) as { userId: string; temporaryPassword: string };

    expect(run.code).toBe(0);
    expect(answer).toMatchObject({ companyId: company, username, alreadyAdmin: false });
    expect(await companyRolesOf(answer.userId, company)).toEqual(['core-company-admin']);
    expect(await membershipsOf(answer.userId, company)).toEqual(['member']);
    expect((await signInWith(email, answer.temporaryPassword)).status).toBe(200);
  });

  it('E05-S14 add-admin of a user who already holds the role is a no-op with exit 0', {
    timeout: 60_000,
  }, async () => {
    const { run, answer } = await createCompany();
    const { companyId, adminUsername, adminUserId } = answer as Record<string, string>;

    const again = await runCli(
      [
        'company',
        'add-admin',
        '--company',
        companyId ?? '',
        '--username',
        adminUsername ?? '',
        '--reason',
        'Check',
        '--json',
      ],
      env,
    );

    expect(run.code).toBe(0);
    expect(again.code).toBe(0);
    expect(JSON.parse(again.out)).toEqual({
      companyId,
      userId: adminUserId,
      username: adminUsername,
      alreadyAdmin: true,
    });
    expect(await companyRolesOf(adminUserId ?? '', companyId ?? '')).toEqual([
      'core-company-admin',
    ]);
  });

  it('E05-S14 add-admin of a member without the role, as a failed run leaves, gives the role on the rerun', {
    timeout: 60_000,
  }, async () => {
    const { company } = await givenCompany(db.ownerUrl);
    const [org] = await queryAsCore<{ organization_id: string }>(
      db.ownerUrl,
      'select organization_id from core.company where id = $1',
      [company],
    );
    const username = freshUsername();
    const auth = testApp.app.get(AuthService);
    const { user } = await auth.createUser({
      username,
      email: `${username}@example.test`,
      password: 'a password of the member',
    });
    await auth.addToOrganization(user.id, org?.organization_id ?? '');

    const run = await runCli(
      ['company', 'add-admin', '--company', company, '--username', username, '--reason', 'Rerun'],
      env,
    );

    expect(run.code).toBe(0);
    expect(await companyRolesOf(user.id, company)).toEqual(['core-company-admin']);
    expect(await membershipsOf(user.id, company)).toEqual(['member']);
  });

  it('E05-S14 add-admin of a blocked user exits 3', { timeout: 60_000 }, async () => {
    const { company } = await givenCompany(db.ownerUrl);
    const username = freshUsername();
    const auth = testApp.app.get(AuthService);
    const { user } = await auth.createUser({
      username,
      email: `${username}@example.test`,
      password: 'a password of the blocked user',
    });
    await auth.block(user.id, undefined);

    const run = await runCli(
      ['company', 'add-admin', '--company', company, '--username', username, '--reason', 'Try'],
      env,
    );

    expect(run.code).toBe(3);
    expect(await companyRolesOf(user.id, company)).toEqual([]);
  });

  it('E05-S14 add-admin at a company that does not exist exits 4', {
    timeout: 60_000,
  }, async () => {
    const run = await runCli(
      [
        'company',
        'add-admin',
        '--company',
        randomUUIDv7(),
        '--username',
        freshUsername(),
        '--email',
        'nobody@example.test',
        '--reason',
        'Try',
      ],
      env,
    );

    expect(run.code).toBe(4);
  });

  it('E05-S14 company list --json prints each company with its plant count and the usernames of its Company admins', {
    timeout: 60_000,
  }, async () => {
    const { answer } = await createCompany();
    const { company } = await givenCompany(db.ownerUrl, { name: 'Plants AB', plants: 2 });

    const run = await runCli(['company', 'list', '--json'], env);
    const companies = JSON.parse(run.out) as { id: string }[];

    expect(run.code).toBe(0);
    expect(companies.find(({ id }) => id === answer.companyId)).toEqual({
      id: answer.companyId,
      name: 'Acme AB',
      plants: 0,
      admins: [answer.adminUsername],
    });
    expect(companies.find(({ id }) => id === company)).toEqual({
      id: company,
      name: 'Plants AB',
      plants: 2,
      admins: [],
    });
  });
});
