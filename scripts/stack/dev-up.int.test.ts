import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadEnv, serverEnvSchema } from '@northmes/sdk/config';
import { bootBuilt } from '@northmes/testing';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedCompany, seedPlants } from './seed.mjs';
import { prepareDatabase, startStack } from './stack.mjs';

/** Runs a pnpm northmes command on the built server, which the test run builds once. */
function northmes(args: readonly string[], env: Readonly<Record<string, string>>) {
  return bootBuilt({ args, env });
}

// The stack creates the database roles, which belong to the server, so it starts a container of
// its own instead of using the run's server (ADR 0005).
let stateDir: string;
let stack: Awaited<ReturnType<typeof startStack>> | undefined;

beforeAll(async () => {
  stateDir = mkdtempSync(join(tmpdir(), 'northmes-stack-'));
  // No opt-in to container reuse, so a NORTHMES_STACK_REUSE=1 in the shell leaves no container
  // running after the test.
  stack = await startStack({ stateDir, env: {}, northmes });
}, 240_000);

afterAll(async () => {
  await stack?.stop();
  rmSync(stateDir, { recursive: true, force: true });
});

/** The stack's environment, once beforeAll has started it. */
function stackEnv(): Readonly<Record<string, string>> {
  if (!stack) throw new Error('the stack did not start');
  return stack.env;
}

/** A URL to the stack's database that logs in as role with the password in the file at key. */
function loginAs(role: string, key: string): string {
  const env = stackEnv();
  const path = env[key];
  if (!path) throw new Error(`the stack's environment has no ${key}`);
  const url = new URL(env.DATABASE_URL ?? '');
  url.username = role;
  url.password = encodeURIComponent(readFileSync(path, 'utf8').replace(/\n$/, ''));
  return url.href;
}

/** Runs sql as nm_app with both seed plants as its read scopes. */
async function readAtSeedPlants(sql: string): Promise<Record<string, unknown>[]> {
  const client = new pg.Client({
    connectionString: loginAs('nm_app', 'NORTHMES_DB_APP_PASSWORD_FILE'),
  });
  await client.connect();
  try {
    await client.query('begin');
    // Articles sit at the company's node (ADR 0073), which a request at a plant reads too.
    await client.query("select set_config('northmes.read_scopes', $1::uuid[]::text, true)", [
      [seedCompany.id, ...seedPlants.map(({ id }) => id)],
    ]);
    const { rows } = await client.query(sql);
    await client.query('commit');
    return rows;
  } finally {
    await client.end();
  }
}

/**
 * What the database steps leave behind: the migration records, read as nm_owner, and the ids of the
 * seed plants' articles and orders.
 */
async function databaseState() {
  const owner = new pg.Client({
    connectionString: loginAs('nm_owner', 'NORTHMES_DB_OWNER_PASSWORD_FILE'),
  });
  await owner.connect();
  try {
    const migrations = await owner.query(
      'select module, name, applied_at from northmes_meta.migration order by module, name',
    );
    return {
      migrations: migrations.rows,
      articles: await readAtSeedPlants('select id from core.article order by id'),
      orders: await readAtSeedPlants('select id from planning.production_order order by id'),
    };
  } finally {
    await owner.end();
  }
}

describe('the stack script', () => {
  it('E02-S08 the stack bootstraps the roles, migrates and seeds fictional production orders with their articles at the seed plants', async () => {
    const orders = await readAtSeedPlants(
      `select o.number, o.quantity::text, o.status, a.code, a.name
         from planning.production_order o
         join core.article a on a.id = o.article_id
        order by o.number`,
    );

    expect(orders).toEqual([
      {
        number: 'DEV-1001',
        quantity: '500.000000',
        status: 'planned',
        code: 'BR-140',
        name: 'Wall bracket',
      },
      {
        number: 'DEV-1002',
        quantity: '80.000000',
        status: 'planned',
        code: 'PN-305',
        name: 'Side panel',
      },
      {
        number: 'DEV-1003',
        quantity: '1200.000000',
        status: 'planned',
        code: 'CW-220',
        name: 'Caster wheel',
      },
      {
        number: 'DEV-1004',
        quantity: '150.000000',
        status: 'planned',
        code: 'BR-140',
        name: 'Wall bracket',
      },
    ]);
  });

  it('E06-S02 the seed holds 60 articles with distinct codes at the seed plants, so the article list pages', async () => {
    const [counts] = await readAtSeedPlants(
      'select count(*)::int as articles, count(distinct code_key)::int as codes from core.article',
    );

    expect(counts).toEqual({ articles: 60, codes: 60 });
  });

  it('E02-S08 a second run applies no migration and adds no seed rows', {
    timeout: 120_000,
  }, async () => {
    const before = await databaseState();

    await prepareDatabase(stackEnv(), { northmes });

    expect(await databaseState()).toEqual(before);
  });

  it('E02-S08 the stack hands the server an environment it accepts, with a free PORT and its origin', async () => {
    const env = stackEnv();
    const { PORT, NORTHMES_PUBLIC_ORIGIN } = loadEnv(serverEnvSchema)(env);

    expect(NORTHMES_PUBLIC_ORIGIN).toBe(`http://127.0.0.1:${PORT}`);
    // The server listens on PORT at 127.0.0.1, so the port must be free there.
    const server = createServer();
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(PORT, '127.0.0.1', resolve);
    });
    await new Promise((resolve) => server.close(resolve));
    expect(PORT).toBeGreaterThan(0);
  });
});
