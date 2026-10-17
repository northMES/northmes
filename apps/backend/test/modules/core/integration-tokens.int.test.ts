// SPDX-License-Identifier: AGPL-3.0-or-later
// SPDX-FileCopyrightText: 2026 Krister Johansson trading as Flexmatic
import { randomUUIDv7 } from 'node:crypto';
import {
  givenAssignment,
  givenCompany,
  hostFactory,
  queryAsCore,
  signIn,
} from '@northmes/backend/testing';
import {
  createTestApp,
  type GqlClient,
  gqlClient,
  query,
  type TestApp,
  useTestDatabase,
} from '@northmes/testing';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { can } from '../../../src/modules/core/core/access/access.ts';
import { AuthService } from '../../../src/modules/core/core/access/auth.service.ts';
import { IntegrationCredentialService } from '../../../src/modules/core/core/access/integration-credential.service.ts';

const createMutation = `mutation ($input: CoreCreateIntegrationTokenInput!) {
  coreCreateIntegrationToken(input: $input) {
    secret
    token {
      id name version createdAt expiresAt revokedAt lastUsedAt
      scope { id kind name }
      roles { id name }
      createdBy { id username }
    }
  }
}`;

const revokeMutation = `mutation ($input: CoreRevokeIntegrationTokenInput!) {
  coreRevokeIntegrationToken(input: $input) { id version revokedAt }
}`;

const listQuery = `query ($companyId: ID) {
  coreIntegrationTokens(companyId: $companyId) {
    id name version createdAt expiresAt revokedAt lastUsedAt
    scope { id kind name }
    roles { id name }
    createdBy { id username }
  }
}`;

interface TokenAnswer {
  id: string;
  name: string;
  version: number;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  scope: { id: string; kind: string; name: string };
  roles: { id: string; name: string }[];
  createdBy: { id: string; username: string };
}

interface CreateAnswer {
  coreCreateIntegrationToken: { secret: string; token: TokenAnswer };
}

interface ListAnswer {
  coreIntegrationTokens: TokenAnswer[];
}

const day = 24 * 60 * 60 * 1000;

/** The errorCode of each error of an answer. */
function errorCodes(answer: { readonly errors?: readonly { extensions?: unknown }[] }) {
  return answer.errors?.map(({ extensions }) => (extensions as { errorCode?: string }).errorCode);
}

describe('integration tokens: coreCreateIntegrationToken, coreRevokeIntegrationToken, coreIntegrationTokens and the credential resolver', () => {
  const db = useTestDatabase();
  let testApp: TestApp | undefined;

  beforeAll(async () => {
    testApp = await createTestApp({ modules: ['core'], hostFactory, database: db });
    await testApp.app.listen(0, '127.0.0.1');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await testApp?.app.close();
  });

  function app() {
    if (!testApp) throw new Error('the test app did not start');
    return testApp.app;
  }

  /** The id of the role with this key in the company. */
  async function roleOf(company: string, key: string): Promise<string> {
    const [row] = await queryAsCore<{ id: string }>(
      db.ownerUrl,
      'select id from core.role where company_id = $1 and key = $2',
      [company, key],
    );
    if (!row) throw new Error(`no role ${key} in company ${company}`);
    return row.id;
  }

  /** A custom role of the company that holds these permissions. */
  async function customRole(company: string, name: string, permissions: readonly string[]) {
    const [row] = await queryAsCore<{ id: string }>(
      db.ownerUrl,
      `insert into core.role (company_id, key, name, permissions, origin)
       values ($1, $2, $3, $4, 'custom') returning id`,
      [company, `test-${randomUUIDv7().slice(-12)}`, name, permissions],
    );
    if (!row) throw new Error('no role was written');
    return row.id;
  }

  /**
   * A user signed in with the default role `roleKey` at `scopeId`, a member of the company's Better
   * Auth organization as every user that coreCreateUser creates is, and a client of theirs: at the
   * plant whose slug is `plant`, or in company settings without one.
   */
  async function admin(
    company: string,
    roleKey: string,
    scopeId: string,
    plant?: string,
  ): Promise<{ client: GqlClient; inSettings: GqlClient; userId: string; username: string }> {
    const { authorization, userId, username } = await signIn(app(), db.ownerUrl, []);
    await givenAssignment(db.ownerUrl, { userId, roleId: await roleOf(company, roleKey), scopeId });
    const [org] = await queryAsCore<{ organization_id: string }>(
      db.ownerUrl,
      'select organization_id from core.company where id = $1',
      [company],
    );
    await app()
      .get(AuthService)
      .addToOrganization(userId, org?.organization_id ?? '');
    const headers: Record<string, string> = { authorization };
    if (plant !== undefined) headers['x-northmes-plant'] = plant;
    const url = await app().getUrl();
    return {
      client: gqlClient(url, { headers }),
      inSettings: gqlClient(url, { headers: { authorization } }),
      userId,
      username,
    };
  }

  /**
   * Acme with plants Hel and Sto, its Company admin in company settings, a Plant admin at Hel and
   * the custom role Article reader.
   */
  async function acme() {
    const given = await givenCompany(db.ownerUrl, { name: 'Acme', plantNames: ['Hel', 'Sto'] });
    const [hel = '', sto = ''] = given.plants;
    const [helSlug = ''] = given.slugs;
    const companyAdmin = await admin(given.company, 'core-company-admin', given.company);
    const plantAdmin = await admin(given.company, 'core-plant-admin', hel, helSlug);
    const reader = await customRole(given.company, 'Article reader', ['core.article:read']);
    return { ...given, hel, sto, helSlug, companyAdmin, plantAdmin, reader };
  }

  /** Creates a token as the Company admin of `company` and returns the answer. */
  function create(client: GqlClient, input: Record<string, unknown>) {
    return client.send<CreateAnswer>(createMutation, { input: { id: randomUUIDv7(), ...input } });
  }

  /** The integration token rows of a company, read as nm_app with the company in its scopes. */
  function credentialRows(company: string) {
    return db.command(
      { principal: { type: 'user', id: 'adr0073-w4' }, scopes: [company], reason: 'probe' },
      async (tx) =>
        (await tx.query<Record<string, unknown>>('select * from core.credential order by id')).rows,
    );
  }

  it('ADR0073-W4 a Company admin creates a token bound to a plant with a role it holds there, and only the answer holds the secret', async () => {
    const { company, hel, reader, companyAdmin } = await acme();

    const answer = await create(companyAdmin.client, {
      companyId: company,
      name: 'ERP import',
      scopeId: hel,
      roleIds: [reader],
      expiresInDays: 30,
    });

    expect(answer.errors).toBeUndefined();
    const created = answer.data?.coreCreateIntegrationToken;
    expect(created?.secret).toMatch(/^nms_int_[A-Za-z]{64}$/);
    expect(created?.token).toMatchObject({
      name: 'ERP import',
      version: 1,
      revokedAt: null,
      lastUsedAt: null,
      scope: { id: hel, kind: 'PLANT', name: 'Hel' },
      roles: [{ id: reader, name: 'Article reader' }],
      createdBy: { id: companyAdmin.userId, username: companyAdmin.username },
    });
    const lifetime =
      Date.parse(created?.token.expiresAt ?? '') - Date.parse(created?.token.createdAt ?? '');
    expect(Math.round(lifetime / day)).toBe(30);
  });

  it('ADR0073-W4 a token expires after 90 days unless the input names its expiry', async () => {
    const { company, reader, companyAdmin } = await acme();

    const answer = await create(companyAdmin.client, {
      companyId: company,
      name: 'Default expiry',
      scopeId: company,
      roleIds: [reader],
    });

    const token = answer.data?.coreCreateIntegrationToken.token;
    const lifetime = Date.parse(token?.expiresAt ?? '') - Date.parse(token?.createdAt ?? '');
    expect(Math.round(lifetime / day)).toBe(90);
  });

  it('ADR0073-W4 an expiry above 365 days is refused with BAD_USER_INPUT, and no token is created', async () => {
    const { company, reader, companyAdmin } = await acme();

    const answer = await create(companyAdmin.client, {
      companyId: company,
      name: 'Too long',
      scopeId: company,
      roleIds: [reader],
      expiresInDays: 366,
    });

    expect(answer.errors?.[0]?.extensions?.code).toBe('BAD_USER_INPUT');
    expect(await credentialRows(company)).toEqual([]);
  });

  it('ADR0073-W4 a Plant admin gets core.forbidden creating a token, at its plant or in company settings, and no token is created', async () => {
    const { company, hel, reader, plantAdmin } = await acme();

    const atPlant = await create(plantAdmin.client, {
      name: 'Plant token',
      scopeId: hel,
      roleIds: [reader],
    });
    const inSettings = await create(plantAdmin.inSettings, {
      companyId: company,
      name: 'Plant token',
      scopeId: hel,
      roleIds: [reader],
    });

    expect(errorCodes(atPlant)).toEqual(['core.forbidden']);
    expect(inSettings.data).toBeNull();
    expect(await credentialRows(company)).toEqual([]);
  });

  it('ADR0073-W4 a Plant admin gets core.forbidden revoking a token, and the token keeps working', async () => {
    const { company, hel, reader, companyAdmin, plantAdmin } = await acme();
    const created = await create(companyAdmin.client, {
      companyId: company,
      name: 'ERP import',
      scopeId: hel,
      roleIds: [reader],
    });
    const { secret = '', token } = created.data?.coreCreateIntegrationToken ?? {};

    const answer = await plantAdmin.client.send(revokeMutation, {
      input: { id: token?.id, expectedVersion: token?.version },
    });

    expect(errorCodes(answer)).toEqual(['core.forbidden']);
    expect(await app().get(IntegrationCredentialService).resolve(secret)).not.toBeNull();
  });

  it('ADR0073-W4 an admin gets core.role_not_held giving a token a role with a permission it does not hold at the binding', async () => {
    const { company, hel, reader, companyAdmin } = await acme();
    const narrowAdmin = await admin(
      company,
      (
        await queryAsCore<{ key: string }>(
          db.ownerUrl,
          `insert into core.role (company_id, key, name, permissions, origin)
         values ($1, 'token-admin', 'Token admin', '{core.integration:manage}', 'custom')
         returning key`,
          [company],
        )
      )[0]?.key ?? '',
      company,
    );
    const companyAdminRole = await roleOf(company, 'core-company-admin');

    const unheld = await create(narrowAdmin.client, {
      companyId: company,
      name: 'Reader token',
      scopeId: hel,
      roleIds: [reader],
    });
    const allHeld = await create(companyAdmin.client, {
      companyId: company,
      name: 'Admin token',
      scopeId: company,
      roleIds: [reader, companyAdminRole],
    });

    expect(errorCodes(unheld)).toEqual(['core.role_not_held']);
    expect(unheld.errors?.[0]?.extensions).toMatchObject({
      details: { scopeId: hel, missingPermissions: ['core.article:read'] },
    });
    expect(allHeld.errors).toBeUndefined();
    expect(await credentialRows(company)).toHaveLength(1);
  });

  it('ADR0073-W4 the resolver answers a token with its credential and a principal of type integration that holds its roles at its binding only', async () => {
    const { company, hel, sto, reader, companyAdmin } = await acme();
    const created = await create(companyAdmin.client, {
      companyId: company,
      name: 'ERP import',
      scopeId: hel,
      roleIds: [reader],
    });
    const { secret = '', token } = created.data?.coreCreateIntegrationToken ?? {};

    const resolved = await app().get(IntegrationCredentialService).resolve(secret);

    expect(resolved?.credential).toMatchObject({
      id: token?.id,
      name: 'ERP import',
      companyId: company,
      scopeId: hel,
    });
    expect(resolved?.principal).toMatchObject({
      type: 'integration',
      credentialId: token?.id,
      surface: 'api',
      companyId: company,
      plantId: undefined,
    });
    const principal = resolved?.principal ?? { scopes: new Map() };
    expect(can(principal, 'core.article:read', hel)).toBe(true);
    expect(can(principal, 'core.article:read', sto)).toBe(false);
    expect(can(principal, 'core.article:read', company)).toBe(false);
    expect(can(principal, 'core.integration:manage', hel)).toBe(false);
  });

  it('ADR0073-W4 the resolver refuses a secret that is not a live integration token', async () => {
    const credentials = app().get(IntegrationCredentialService);

    expect(await credentials.resolve('')).toBeNull();
    expect(await credentials.resolve(`nms_int_${'a'.repeat(64)}`)).toBeNull();
    expect(await credentials.resolve(`nms_pat_${'a'.repeat(64)}`)).toBeNull();
  });

  it('ADR0073-W4 a token is refused after its expiry', async () => {
    const { company, reader, companyAdmin } = await acme();
    const created = await create(companyAdmin.client, {
      companyId: company,
      name: 'Short lived',
      scopeId: company,
      roleIds: [reader],
      expiresInDays: 1,
    });
    const secret = created.data?.coreCreateIntegrationToken.secret ?? '';
    const credentials = app().get(IntegrationCredentialService);
    expect(await credentials.resolve(secret)).not.toBeNull();

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 2 * day);

    expect(await credentials.resolve(secret)).toBeNull();
  });

  it('ADR0073-W4 a token whose credential row has expired is refused even while Better Auth still holds its key', async () => {
    const { company, reader, companyAdmin } = await acme();
    const created = await create(companyAdmin.client, {
      companyId: company,
      name: 'Expired row',
      scopeId: company,
      roleIds: [reader],
    });
    const { secret = '', token } = created.data?.coreCreateIntegrationToken ?? {};
    await queryAsCore(
      db.ownerUrl,
      `update core.credential
          set created_at = now() - interval '10 days', expires_at = now() - interval '1 day'
        where id = $1`,
      [token?.id],
    );

    expect(await app().get(IntegrationCredentialService).resolve(secret)).toBeNull();
  });

  it('ADR0073-W4 coreRevokeIntegrationToken refuses the token at once, deletes its Better Auth key and keeps its credential row', async () => {
    const { company, reader, companyAdmin } = await acme();
    const created = await create(companyAdmin.client, {
      companyId: company,
      name: 'ERP import',
      scopeId: company,
      roleIds: [reader],
    });
    const { secret = '', token } = created.data?.coreCreateIntegrationToken ?? {};
    const credentials = app().get(IntegrationCredentialService);
    expect(await credentials.resolve(secret)).not.toBeNull();

    const answer = await companyAdmin.client.send<{
      coreRevokeIntegrationToken: { id: string; version: number; revokedAt: string | null };
    }>(revokeMutation, { input: { id: token?.id, expectedVersion: token?.version } });

    expect(answer.errors).toBeUndefined();
    expect(answer.data?.coreRevokeIntegrationToken.revokedAt).not.toBeNull();
    expect(await credentials.resolve(secret)).toBeNull();
    const [org] = await queryAsCore<{ organization_id: string }>(
      db.ownerUrl,
      'select organization_id from core.company where id = $1',
      [company],
    );
    const keys = await query(
      db.authUrl,
      `select id from auth.apikey where "referenceId" = '${org?.organization_id}'`,
    );
    expect(keys).toEqual([]);
    const listed = await companyAdmin.client.send<ListAnswer>(listQuery, { companyId: company });
    expect(listed.data?.coreIntegrationTokens).toEqual([
      expect.objectContaining({ id: token?.id, name: 'ERP import', revokedAt: expect.any(String) }),
    ]);
  });

  it('ADR0073-W4 the resolver writes lastUsedAt at most once a minute', async () => {
    const { company, reader, companyAdmin } = await acme();
    const created = await create(companyAdmin.client, {
      companyId: company,
      name: 'ERP import',
      scopeId: company,
      roleIds: [reader],
    });
    const { secret = '', token } = created.data?.coreCreateIntegrationToken ?? {};
    const credentials = app().get(IntegrationCredentialService);
    const lastUsed = async () =>
      (
        await queryAsCore<{ last_used_at: Date | null }>(
          db.ownerUrl,
          'select last_used_at from core.credential where id = $1',
          [token?.id],
        )
      )[0]?.last_used_at;

    await credentials.resolve(secret);
    const first = await lastUsed();
    await credentials.resolve(secret);
    const second = await lastUsed();
    await queryAsCore(
      db.ownerUrl,
      `update core.credential set last_used_at = now() - interval '61 seconds' where id = $1`,
      [token?.id],
    );
    await credentials.resolve(secret);
    const third = await lastUsed();

    expect(first).toBeInstanceOf(Date);
    expect(second).toEqual(first);
    expect(third?.getTime()).toBeGreaterThan(Date.now() - 30_000);
  });

  it('ADR0073-W4 the secret appears in no log line, no table row and no list answer', async () => {
    const written: string[] = [];
    const record = (...parts: unknown[]) => {
      written.push(
        parts.map((part) => (part instanceof Error ? part.stack : String(part))).join(' '),
      );
    };
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      vi.spyOn(console, method).mockImplementation(record);
    }
    const stdout = process.stdout.write.bind(process.stdout);
    const stderr = process.stderr.write.bind(process.stderr);
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk, ...rest) => {
      record(chunk);
      return stdout(chunk, ...(rest as []));
    });
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk, ...rest) => {
      record(chunk);
      return stderr(chunk, ...(rest as []));
    });
    const { company, reader, companyAdmin } = await acme();
    const created = await create(companyAdmin.client, {
      companyId: company,
      name: 'ERP import',
      scopeId: company,
      roleIds: [reader],
      expiresInDays: 1,
    });
    const { secret = '', token } = created.data?.coreCreateIntegrationToken ?? {};
    const credentials = app().get(IntegrationCredentialService);
    await credentials.resolve(secret);
    await credentials.resolve(`${secret.slice(0, -1)}x`);
    const listed = await companyAdmin.client.send(listQuery, { companyId: company });
    await companyAdmin.client.send(revokeMutation, {
      input: { id: token?.id, expectedVersion: token?.version },
    });
    await credentials.resolve(secret);
    const rows = [
      ...(await queryAsCore(db.ownerUrl, 'select t::text as row from core.credential t')),
      ...(await queryAsCore(db.ownerUrl, 'select t::text as row from core.event t')),
      ...(await query(db.authUrl, 'select t::text as row from auth.apikey t')),
    ];

    expect(secret).toMatch(/^nms_int_/);
    expect(written.filter((line) => line.includes(secret.slice('nms_int_'.length)))).toEqual([]);
    expect(rows.filter(({ row }) => String(row).includes(secret))).toEqual([]);
    expect(JSON.stringify(listed)).not.toContain(secret);
  });

  it('ADR0073-W4 coreIntegrationTokens lists the tokens of the company for a Company admin and is core.forbidden for a Plant admin', async () => {
    const { company, hel, reader, companyAdmin, plantAdmin } = await acme();
    const other = await acme();
    await create(companyAdmin.client, {
      companyId: company,
      name: 'ERP import',
      scopeId: hel,
      roleIds: [reader],
    });
    await create(other.companyAdmin.client, {
      companyId: other.company,
      name: 'Other company',
      scopeId: other.company,
      roleIds: [other.reader],
    });

    const listed = await companyAdmin.client.send<ListAnswer>(listQuery, { companyId: company });
    const atPlant = await plantAdmin.client.send(listQuery, {});
    const otherCompany = await companyAdmin.client.send(listQuery, { companyId: other.company });

    expect(listed.errors).toBeUndefined();
    expect(listed.data?.coreIntegrationTokens.map(({ name }) => name)).toEqual(['ERP import']);
    expect(errorCodes(atPlant)).toEqual(['core.forbidden']);
    expect(errorCodes(otherCompany)).toEqual(['core.forbidden']);
  });

  it('ADR0073-W4 core.integration:manage held at a plant only reaches neither the list nor the commands, which need it at the company', async () => {
    const { company, hel, helSlug, reader, companyAdmin } = await acme();
    const [plantRole] = await queryAsCore<{ key: string }>(
      db.ownerUrl,
      `insert into core.role (company_id, key, name, permissions, origin)
       values ($1, 'plant-tokens', 'Plant tokens', '{core.integration:manage,core.article:read}', 'custom')
       returning key`,
      [company],
    );
    const plantManager = await admin(company, plantRole?.key ?? '', hel, helSlug);
    const created = await create(companyAdmin.client, {
      companyId: company,
      name: 'ERP import',
      scopeId: hel,
      roleIds: [reader],
    });
    const token = created.data?.coreCreateIntegrationToken.token;

    const listed = await plantManager.client.send(listQuery, {});
    const createdAtPlant = await create(plantManager.client, {
      name: 'Plant token',
      scopeId: hel,
      roleIds: [reader],
    });
    const revoked = await plantManager.client.send(revokeMutation, {
      input: { id: token?.id, expectedVersion: token?.version },
    });

    expect(errorCodes(listed)).toEqual(['core.forbidden']);
    expect(errorCodes(createdAtPlant)).toEqual(['core.forbidden']);
    expect(errorCodes(revoked)).toEqual(['core.forbidden']);
  });

  it('ADR0073-W4 an editor gets core.role_not_held adding a permission to a role that a token holds where the editor does not hold it', async () => {
    const { company, reader, companyAdmin } = await acme();
    const [editorRole] = await queryAsCore<{ key: string }>(
      db.ownerUrl,
      `insert into core.role (company_id, key, name, permissions, origin)
       values ($1, 'role-editor', 'Role editor', '{core.role:manage,core.role:read}', 'custom')
       returning key`,
      [company],
    );
    const editor = await admin(company, editorRole?.key ?? '', company);
    await create(companyAdmin.client, {
      companyId: company,
      name: 'ERP import',
      scopeId: company,
      roleIds: [reader],
    });

    const answer = await editor.inSettings.send(
      `mutation ($input: CoreUpdateRoleInput!) { coreUpdateRole(input: $input) { id } }`,
      {
        input: {
          id: reader,
          expectedVersion: 1,
          name: 'Article reader',
          permissions: ['core.article:read', 'core.article:update'],
        },
      },
    );

    expect(errorCodes(answer)).toEqual(['core.role_not_held']);
  });

  it('ADR0073-W4 a retry with the id of a created token is refused with core.integration_token_secret_shown and creates no second token', async () => {
    const { company, reader, companyAdmin } = await acme();
    const input = {
      id: randomUUIDv7(),
      companyId: company,
      name: 'ERP import',
      scopeId: company,
      roleIds: [reader],
    };

    const first = await companyAdmin.client.send<CreateAnswer>(createMutation, { input });
    const retry = await companyAdmin.client.send<CreateAnswer>(createMutation, { input });

    expect(first.errors).toBeUndefined();
    expect(errorCodes(retry)).toEqual(['core.integration_token_secret_shown']);
    expect(await credentialRows(company)).toHaveLength(1);
  });

  it("ADR0073-W4 a create with the id of another company's token is NOT_FOUND and leaves no Better Auth key", async () => {
    const other = await acme();
    const id = randomUUIDv7();
    await other.companyAdmin.client.send<CreateAnswer>(createMutation, {
      input: {
        id,
        companyId: other.company,
        name: 'ERP import',
        scopeId: other.company,
        roleIds: [other.reader],
      },
    });
    const { company, reader, companyAdmin } = await acme();
    const [org] = await queryAsCore<{ organization_id: string }>(
      db.ownerUrl,
      'select organization_id from core.company where id = $1',
      [company],
    );

    const answer = await companyAdmin.client.send<CreateAnswer>(createMutation, {
      input: { id, companyId: company, name: 'ERP import', scopeId: company, roleIds: [reader] },
    });

    expect(answer.errors?.map(({ extensions }) => extensions)).toEqual([
      expect.objectContaining({ code: 'NOT_FOUND' }),
    ]);
    expect(
      await query(
        db.authUrl,
        `select id from auth.apikey where "referenceId" = '${org?.organization_id}'`,
      ),
    ).toEqual([]);
  });

  it('ADR0073-W4 a role that a live token holds cannot be deleted, and the message says to revoke the token', async () => {
    const { company, reader, companyAdmin } = await acme();
    await create(companyAdmin.client, {
      companyId: company,
      name: 'ERP import',
      scopeId: company,
      roleIds: [reader],
    });

    const answer = await companyAdmin.client.send(
      `mutation ($input: CoreDeleteRoleInput!) { coreDeleteRole(input: $input) { id } }`,
      { input: { id: reader, expectedVersion: 1 } },
    );

    expect(errorCodes(answer)).toEqual(['core.role_in_use']);
    expect(answer.errors?.[0]?.message).toBe(
      'Article reader is held by an integration token, so it cannot be deleted. Revoke the tokens that hold it first.',
    );
  });

  it('ADR0073-W4 nm_app reads and writes core.credential only with the company in its scopes', async () => {
    const { company, hel, reader, companyAdmin } = await acme();
    await create(companyAdmin.client, {
      companyId: company,
      name: 'ERP import',
      scopeId: company,
      roleIds: [reader],
    });
    const asApp = (scopes: readonly string[], sql: string) =>
      db.command(
        { principal: { type: 'user', id: 'adr0073-w4' }, scopes, reason: 'probe' },
        async (tx) => (await tx.query(sql)).rowCount,
      );

    const readAtPlant = await asApp([hel], 'select id from core.credential');
    const updateAtPlant = await asApp([hel], `update core.credential set name = 'Renamed'`);
    const readWithoutScopes = await query(db.appUrl, 'select id from core.credential');
    const readAtCompany = await asApp([company], 'select id from core.credential');

    expect(readAtPlant).toBe(0);
    expect(updateAtPlant).toBe(0);
    expect(readWithoutScopes).toEqual([]);
    expect(readAtCompany).toBe(1);
  });
});
