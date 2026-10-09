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

/** A company and its plants in the scope tree, as givenCompany writes them. */
export interface GivenCompany {
  readonly company: string;
  /** The plants' scope ids, plant number 1 first. */
  readonly plants: readonly string[];
}

export interface GivenCompanyOptions {
  /** How many plants the company gets, with fresh ids. It defaults to one. */
  readonly plants?: number;
  /** The ids of the plants, such as ids from given.plant(), instead of fresh ones. */
  readonly plantIds?: readonly string[];
}

/**
 * Writes a company and its plants into core.scope as core's owner role, with fresh uuidv7 ids
 * unless plantIds names them, and the spans of ADR 0007: the company's is unbounded, plant number
 * k's is [k << 32, (k + 1) << 32).
 */
export function givenCompany(
  ownerUrl: string,
  { plants = 1, plantIds }: GivenCompanyOptions = {},
): Promise<GivenCompany> {
  const wanted = plantIds ?? Array.from({ length: plants }, () => randomUUIDv7());
  return asCoreOwner(ownerUrl, async (client) => {
    const company = randomUUIDv7();
    await client.query(
      `insert into core.scope (id, company_id, parent_id, kind, span)
       values ($1, $1, null, 'company', '(,)')`,
      [company],
    );
    const ids: string[] = [];
    for (const [index, plant] of wanted.entries()) {
      const k = index + 1;
      await client.query(
        `insert into core.scope (id, company_id, parent_id, kind, span)
         values ($1, $2, $2, 'plant', int8range($3::int8 << 32, ($3::int8 + 1) << 32))`,
        [plant, company, k],
      );
      ids.push(plant);
    }
    return { company, plants: ids };
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
        'insert into core.role_assignment (user_id, scope_id, role_id) values ($1, $2, $3)',
        [userId, scopeId, roleId],
      );
    }
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
  const { token: jwt } = (await token.json()) as { token: string };
  return { userId: user.id, username, password, authorization: `Bearer ${jwt}` };
}

/**
 * Signs in a user who holds every installed permission at `plant`, which becomes the one plant of
 * a fresh company unless core.scope holds it already, and returns the headers of a request at that plant: the JWT and
 * x-northmes-plant. The user reads the plant and the company above it and writes the plant, as a
 * plant planner does (ADR 0008). The app must listen.
 */
export async function signInAt(
  app: INestApplication,
  ownerUrl: string,
  plant: string,
): Promise<Record<string, string>> {
  const { exists, permissions } = await asCoreOwner(ownerUrl, async (client) => {
    const scope = await client.query('select 1 from core.scope where id = $1', [plant]);
    const { rows } = await client.query<{ key: string }>(
      'select key from core.permission where installed order by key',
    );
    return { exists: scope.rowCount !== 0, permissions: rows.map(({ key }) => key) };
  });
  if (!exists) await givenCompany(ownerUrl, { plantIds: [plant] });
  const { authorization } = await signIn(app, ownerUrl, [{ scopeId: plant, permissions }]);
  return { authorization, [PLANT_HEADER]: plant };
}
