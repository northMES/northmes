// SPDX-License-Identifier: AGPL-3.0-or-later
import { randomBytes, randomUUIDv7 } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { HostFactory } from '@northmes/testing';
import { Client, Pool, type PoolClient } from 'pg';
import { AppModule } from './app.module.ts';
import { importServers, inRepoCatalog } from './boot/boot.ts';
import { AuthService } from './modules/core/core/access/auth.service.ts';
import { PLANT_HEADER } from './principal.ts';
import { builtShellDir } from './web/static-mounts.ts';
import { serveWeb } from './web/web.module.ts';

/**
 * The host factory that createTestApp from @northmes/testing calls (ADR 0041). It runs the boot
 * steps of ADR 0002 that come before listening, in the test process: the catalog of the in-repo
 * modules that `modules` names, then the Nest app with the test's ConfigModule as AppModule's
 * first import and one schema from the Nest modules of those modules. The app
 * listens on nothing. A catalog problem throws one BootError. A provider that fails to build
 * rejects with its error, where Nest would by default abort the process and the Vitest worker with
 * it.
 */
export const hostFactory: HostFactory = createHostFactory();

/** The host factory of hostFactory, whose app serves the web app built into shellDir. */
export function hostFactoryWithShell(shellDir: string): HostFactory {
  return createHostFactory(shellDir);
}

/**
 * Builds the app of hostFactory and serves the web app as boot does: the one apps/web builds, or
 * the one in shellDir when it is given.
 */
function createHostFactory(shellDir = builtShellDir): HostFactory {
  return async ({ modules, config, webOrigins }) => {
    const catalog = inRepoCatalog({ modules });
    const servers = await importServers(catalog);
    const app = await NestFactory.create<NestExpressApplication>(
      AppModule.forRoot(config, servers, { webOrigins }),
      {
        logger: ['error', 'warn'],
        abortOnError: false,
      },
    );
    serveWeb(app, { shellDir });
    return { app, modules: catalog.map(({ manifest }) => manifest.id) };
  };
}

/** What statementsDuring returns. */
export interface StatementsDuring<Result> {
  /** What fn resolved to. */
  readonly result: Result;
  /** The SQL text of each statement the pool sent while fn ran, in the order it sent them. */
  readonly statements: readonly string[];
}

/**
 * The pools a statementsDuring call is recording. Two overlapping recordings of one pool would wrap
 * the same clients, count a statement twice and unwrap each other's clients, so the second refuses.
 */
const recording = new WeakSet<Pool>();

/** The SQL text of the first argument of a pg query call: a string or a query config. */
function statementText(query: unknown): string {
  if (typeof query === 'string') return query;
  const text = (query as { text?: unknown } | null)?.text;
  return typeof text === 'string' ? text : '';
}

/**
 * Runs fn and records every statement that the app's nm_app pool sends until fn settles, such as
 * the reads of one GraphQL request. A test counts them, for example to show that the rows a list
 * references are read in one batch and not once per row. The pool's clients are wrapped only while
 * fn runs.
 */
export async function statementsDuring<Result>(
  app: INestApplication,
  fn: () => Promise<Result>,
): Promise<StatementsDuring<Result>> {
  const pool = app.get(Pool);
  if (recording.has(pool)) {
    throw new Error('statementsDuring is already recording this pool; await the first call first');
  }
  recording.add(pool);
  const statements: string[] = [];
  const wrapped = new Set<PoolClient>();
  // The pool emits acquire before it hands a client out, also an idle one it reuses.
  const wrap = (client: PoolClient) => {
    if (wrapped.has(client)) return;
    wrapped.add(client);
    const query: (...args: unknown[]) => unknown = client.query;
    client.query = ((...args: unknown[]) => {
      statements.push(statementText(args[0]));
      return Reflect.apply(query, client, args);
    }) as PoolClient['query'];
  };
  pool.on('acquire', wrap);
  try {
    return { result: await fn(), statements };
  } finally {
    recording.delete(pool);
    pool.off('acquire', wrap);
    // Each client reads query from pg's Client prototype again.
    for (const client of wrapped) Reflect.deleteProperty(client, 'query');
  }
}

/** Runs fn in one transaction as core's owner role, on a connection that logs in as nm_owner. */
async function asCoreOwner<Result>(
  ownerUrl: string,
  fn: (client: Client) => Promise<Result>,
): Promise<Result> {
  const client = new Client({ connectionString: ownerUrl });
  await client.connect();
  try {
    await client.query('begin');
    await client.query('set local role nm_mod_core');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } finally {
    await client.end();
  }
}

/**
 * Runs one statement as core's owner role, which the row-level security policies do not bind, and
 * returns its rows: for a test that reads core's tables across companies or without scopes.
 */
export function queryAsCore<Row extends Record<string, unknown> = Record<string, unknown>>(
  ownerUrl: string,
  sql: string,
  params: readonly unknown[] = [],
): Promise<Row[]> {
  return asCoreOwner(ownerUrl, async (client) => (await client.query<Row>(sql, [...params])).rows);
}

/** A company and its plants, as givenCompany writes them. */
export interface GivenCompany {
  /** The company's id: its node in core.scope and its core.company row. */
  readonly company: string;
  /** The plants' scope ids, plant number 1 first. */
  readonly plants: readonly string[];
  /** The plants' slugs, in the order of plants. */
  readonly slugs: readonly string[];
}

export interface GivenCompanyOptions {
  /** The company's name. It defaults to one made of the company's id. */
  readonly name?: string;
  /** How many plants the company gets, with fresh ids. It defaults to one. */
  readonly plants?: number;
  /** The ids of the plants, such as ids from given.plant(), instead of fresh ones. */
  readonly plantIds?: readonly string[];
  /** The plants' names, which also set how many plants the company gets. */
  readonly plantNames?: readonly string[];
}

/**
 * Writes a company and its plants as core's owner role (ADR 0007): the Better Auth organization
 * with the company's id as its slug (ADR 0066), the company's node in core.scope and its
 * core.company row, and for each plant its node, with the span of plant number k,
 * [k << 32, (k + 1) << 32), and its core.plant row with a fresh slug. Ids are fresh uuidv7s
 * unless plantIds names the plants'.
 */
export function givenCompany(
  ownerUrl: string,
  { name, plants, plantIds, plantNames }: GivenCompanyOptions = {},
): Promise<GivenCompany> {
  const count = plantIds?.length ?? plantNames?.length ?? plants ?? 1;
  const ids = plantIds ?? Array.from({ length: count }, () => randomUUIDv7());
  return asCoreOwner(ownerUrl, async (client) => {
    const company = randomUUIDv7();
    const companyName = name ?? `Company ${company}`;
    const { rows } = await client.query<{ id: string }>(
      `insert into auth.organization (name, slug, "createdAt") values ($1, $2, now())
       returning id`,
      [companyName, company],
    );
    await client.query(
      `insert into core.scope (id, company_id, parent_id, kind, span)
       values ($1, $1, null, 'company', '(,)')`,
      [company],
    );
    await client.query('insert into core.company (id, organization_id, name) values ($1, $2, $3)', [
      company,
      rows[0]?.id,
      companyName,
    ]);
    const slugs: string[] = [];
    for (const [index, plant] of ids.entries()) {
      const k = index + 1;
      const slug = `plant-${randomBytes(5).toString('hex')}`;
      await client.query(
        `insert into core.scope (id, company_id, parent_id, kind, span)
         values ($1, $2, $2, 'plant', int8range($3::int8 << 32, ($3::int8 + 1) << 32))`,
        [plant, company, k],
      );
      await client.query(
        'insert into core.plant (id, company_id, slug, name) values ($1, $2, $3, $4)',
        [plant, company, slug, plantNames?.[index] ?? `Plant ${k}`],
      );
      slugs.push(slug);
    }
    return { company, plants: ids, slugs };
  });
}

/** A role a test user holds: the permission keys of a role assigned at one scope node. */
export interface Grant {
  readonly scopeId: string;
  readonly permissions: readonly string[];
}

/**
 * Gives a user, for each grant, a custom role of the grant's company that holds its permissions,
 * assigned at the grant's scope, as core's owner role.
 */
export function grantRoles(
  ownerUrl: string,
  userId: string,
  grants: readonly Grant[],
): Promise<void> {
  return asCoreOwner(ownerUrl, async (client) => {
    for (const { scopeId, permissions } of grants) {
      const key = `test-${randomBytes(6).toString('hex')}`;
      const { rows } = await client.query<{ id: string }>(
        `insert into core.role (company_id, key, name, permissions, origin)
         select company_id, $2, $2, $3, 'custom' from core.scope where id = $1
         returning id`,
        [scopeId, key, permissions],
      );
      const roleId = rows[0]?.id;
      if (!roleId) throw new Error(`grantRoles: no scope ${scopeId} in core.scope`);
      await client.query(
        `insert into core.role_assignment (user_id, company_id, scope_id, role_id)
         select $1, company_id, id, $3 from core.scope where id = $2`,
        [userId, scopeId, roleId],
      );
    }
  });
}

/**
 * Gives a user a role at a scope node of the role's company, as core's owner role, and returns the
 * assignment's id.
 */
export function givenAssignment(
  ownerUrl: string,
  { userId, roleId, scopeId }: { userId: string; roleId: string; scopeId: string },
): Promise<string> {
  return asCoreOwner(ownerUrl, async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `insert into core.role_assignment (user_id, company_id, scope_id, role_id)
       select $1, company_id, id, $3 from core.scope where id = $2
       returning id`,
      [userId, scopeId, roleId],
    );
    const id = rows[0]?.id;
    if (!id) throw new Error(`givenAssignment: no scope ${scopeId} in core.scope`);
    return id;
  });
}

/**
 * Writes a user straight into auth.user, without a password, and grants it roles. Such a user
 * cannot sign in; a test of can() or of the principal's scopes reads its principal directly.
 */
export async function givenUser(ownerUrl: string, grants: readonly Grant[]): Promise<string> {
  const userId = randomUUIDv7();
  const username = `user_${randomBytes(6).toString('hex')}`;
  await asCoreOwner(ownerUrl, (client) =>
    client.query(
      `insert into auth."user" (id, name, email, "emailVerified", username)
       values ($1, $2, $3, false, $2)`,
      [userId, username, `${username}@example.invalid`],
    ),
  );
  await grantRoles(ownerUrl, userId, grants);
  return userId;
}

/** A user that signIn created and signed in. */
export interface SignedIn {
  readonly userId: string;
  readonly username: string;
  readonly password: string;
  /** The Authorization header of its requests: Bearer and the JWT for the web. */
  readonly authorization: string;
}

/**
 * Creates a user with a password through Better Auth, grants it roles, and signs it in the way the
 * web does (ADR 0010): POST /api/auth/sign-in/username, then GET /api/auth/token with the session
 * token from set-auth-token as its bearer token, which answers with a JWT. The app must listen.
 */
export async function signIn(
  app: INestApplication,
  ownerUrl: string,
  grants: readonly Grant[],
): Promise<SignedIn> {
  const username = `user_${randomBytes(6).toString('hex')}`;
  const password = randomBytes(16).toString('hex');
  const { user } = await app.get(AuthService).createUser({ username, password });
  await grantRoles(ownerUrl, user.id, grants);
  const url = await app.getUrl();
  const signedIn = await fetch(`${url}/api/auth/sign-in/username`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const sessionToken = signedIn.headers.get('set-auth-token');
  if (!signedIn.ok || !sessionToken) {
    throw new Error(`signIn: sign-in answered ${signedIn.status}: ${await signedIn.text()}`);
  }
  const token = await fetch(`${url}/api/auth/token`, {
    headers: { authorization: `Bearer ${sessionToken}` },
  });
  if (!token.ok) {
    throw new Error(`signIn: /api/auth/token answered ${token.status}: ${await token.text()}`);
  }
  const { token: jwt } = (await token.json()) as { token: string };
  return { userId: user.id, username, password, authorization: `Bearer ${jwt}` };
}

/**
 * Signs in a user who holds every installed permission at `plant`, a plant's scope id, which
 * becomes the one plant of a fresh company unless core.plant holds it already, and returns the
 * headers of a request at that plant: the JWT, and the plant's slug in x-northmes-plant. The user
 * reads the plant and the company above it and writes the plant, as a plant planner does (ADR
 * 0008). The app must listen.
 */
export async function signInAt(
  app: INestApplication,
  ownerUrl: string,
  plant: string,
): Promise<Record<string, string>> {
  const { slug, permissions } = await asCoreOwner(ownerUrl, async (client) => {
    const found = await client.query<{ slug: string }>(
      'select slug from core.plant where id = $1',
      [plant],
    );
    const { rows } = await client.query<{ key: string }>(
      'select key from core.permission where installed order by key',
    );
    return { slug: found.rows[0]?.slug, permissions: rows.map(({ key }) => key) };
  });
  const plantSlug = slug ?? (await givenCompany(ownerUrl, { plantIds: [plant] })).slugs[0] ?? '';
  const { authorization } = await signIn(app, ownerUrl, [{ scopeId: plant, permissions }]);
  return { authorization, [PLANT_HEADER]: plantSlug };
}
