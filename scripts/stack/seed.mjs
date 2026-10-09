// The seed of the stack script (E02-S08, E05-S05): the scope tree of one company and one plant, a
// dev admin who signs in with a dev-only password, and fictional articles and production orders at
// the plant, so the board has orders to list and the article list has pages. Every code, name,
// number and quantity here is made up.
// The planner and the operator join the seed with their roles (E05-S05); core.plant, the company
// as a Better Auth organization and a second plant arrive with the plant switcher.

import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import pg from 'pg';

/**
 * The scope ids of the seed: the company, the root of the scope tree, and its one plant, where the
 * seed writes every record.
 */
export const seedScopes = {
  company: '019a0000-0000-7000-8000-00000000c001',
  plant: '019a0000-0000-7000-8000-00000000a001',
};

/**
 * The dev admin, who holds every permission at the seed company. The password is for development
 * only, it is no secret, and it never reaches production: the stack script seeds only the database
 * of pnpm dev, pnpm demo and the end-to-end tests.
 */
export const devAdmin = {
  id: '019a0000-0000-7000-8000-0000000d0001',
  username: 'admin',
  password: 'northmes-dev-admin',
  name: 'Dev admin',
  email: 'admin@users.northmes.invalid',
};

/** The fixed id of the dev admin's role, which holds every installed permission. */
const adminRoleId = '019a0000-0000-7000-8000-0000000d0002';

const scryptAsync = promisify(scrypt);

/**
 * A password hash in the format of Better Auth's scrypt hasher: a 16-byte salt in hex, a colon,
 * and the 64-byte key in hex, with N 16384, r 16 and p 1 over the NFKC form of the password.
 * seed.int.test.ts signs the dev admin in through Better Auth, so a change of the format fails it.
 * @param {string} password
 */
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = /** @type {Buffer} */ (
    await scryptAsync(password.normalize('NFKC'), salt, 64, {
      N: 16384,
      r: 16,
      p: 1,
      maxmem: 128 * 16384 * 16 * 2,
    })
  );
  return `${salt}:${key.toString('hex')}`;
}

/** The fixed id of seed article number `n`, so a second run finds it and writes nothing. */
function articleId(n) {
  return `019a0000-0000-7000-8000-0000000a${n.toString(16).padStart(4, '0')}`;
}

/** The three articles the orders make. */
const orderArticles = [
  { id: articleId(1), code: 'BR-140', name: 'Wall bracket' },
  { id: articleId(2), code: 'PN-305', name: 'Side panel' },
  { id: articleId(3), code: 'CW-220', name: 'Caster wheel' },
];

/** Families of further articles, three sizes each, so the article list has pages to walk. */
const families = [
  ['AX', 'Axle', ['20 mm', '25 mm', '30 mm']],
  ['BL', 'Hex bolt', ['M6', 'M8', 'M10']],
  ['CB', 'Corner block', ['small', 'medium', 'large']],
  ['CL', 'Clamp', ['40 mm', '60 mm', '80 mm']],
  ['DF', 'Drawer front', ['300 mm', '450 mm', '600 mm']],
  ['DS', 'Drawer slide', ['350 mm', '450 mm', '550 mm']],
  ['FT', 'Levelling foot', ['M6', 'M8', 'M10']],
  ['GS', 'Gas spring', ['60 N', '100 N', '150 N']],
  ['HD', 'Bow handle', ['96 mm', '128 mm', '160 mm']],
  ['HG', 'Cabinet hinge', ['90 degrees', '110 degrees', '165 degrees']],
  ['KN', 'Round knob', ['25 mm', '30 mm', '35 mm']],
  ['LG', 'Table leg', ['400 mm', '720 mm', '900 mm']],
  ['NT', 'Lock nut', ['M6', 'M8', 'M10']],
  ['RL', 'Hanging rail', ['600 mm', '800 mm', '1000 mm']],
  ['SB', 'Shelf board', ['600 mm', '800 mm', '1000 mm']],
  ['SC', 'Wood screw', ['3.5 x 16', '4 x 30', '5 x 50']],
  ['SP', 'Spacer', ['5 mm', '10 mm', '15 mm']],
  ['TT', 'Tabletop', ['800 mm', '1200 mm', '1600 mm']],
  ['WS', 'Washer', ['M6', 'M8', 'M10']],
];

const articles = [
  ...orderArticles,
  ...families.flatMap(([prefix, name, sizes], family) =>
    sizes.map((size, index) => ({
      id: articleId(4 + family * sizes.length + index),
      code: `${prefix}-${500 + index * 10}`,
      name: `${name} ${size}`,
    })),
  ),
];

const [bracket, panel, caster] = orderArticles.map(({ id }) => id);

const orders = [
  {
    id: '019a0000-0000-7000-8000-0000000b0001',
    number: 'DEV-1001',
    articleId: bracket,
    quantity: '500',
  },
  {
    id: '019a0000-0000-7000-8000-0000000b0002',
    number: 'DEV-1002',
    articleId: panel,
    quantity: '80',
  },
  {
    id: '019a0000-0000-7000-8000-0000000b0003',
    number: 'DEV-1003',
    articleId: caster,
    quantity: '1200',
  },
  {
    id: '019a0000-0000-7000-8000-0000000b0004',
    number: 'DEV-1004',
    articleId: bracket,
    quantity: '150',
  },
];

/**
 * Writes the scope tree and the dev admin in one transaction as core's owner role, on a connection
 * that ownerUrl logs in as nm_owner: the company and the plant in core.scope, the admin in
 * auth.user with a password account, a role that holds every installed permission, and its
 * assignment at the company (ADR 0007, ADR 0010).
 * @param {string} ownerUrl
 */
async function seedAccess(ownerUrl) {
  const client = new pg.Client({ connectionString: ownerUrl });
  await client.connect();
  try {
    await client.query('begin');
    await client.query('set local role nm_mod_core');
    await client.query(
      `insert into core.scope (id, company_id, parent_id, kind, span)
       values ($1, $1, null, 'company', '(,)'),
              ($2, $1, $1, 'plant', int8range(1::int8 << 32, 2::int8 << 32))
       on conflict (id) do nothing`,
      [seedScopes.company, seedScopes.plant],
    );
    const { id, username, password, name, email } = devAdmin;
    await client.query(
      `insert into auth."user" (id, name, email, "emailVerified", username, "displayUsername")
       values ($1, $2, $3, true, $4, $4)
       on conflict (id) do nothing`,
      [id, name, email, username],
    );
    await client.query(
      `insert into auth.account ("accountId", "providerId", "userId", password, "updatedAt")
       select $1::text, 'credential', $1::uuid, $2, now()
        where not exists (
          select 1 from auth.account where "userId" = $1::uuid and "providerId" = 'credential'
        )`,
      [id, await hashPassword(password)],
    );
    await client.query(
      `insert into core.role (id, company_id, key, name, permissions, origin)
       select $1, $2, 'admin', 'Admin', coalesce(array_agg(key order by key), '{}'), 'custom'
         from core.permission where installed
       on conflict (id) do update set permissions = excluded.permissions`,
      [adminRoleId, seedScopes.company],
    );
    await client.query(
      `insert into core.role_assignment (user_id, scope_id, role_id) values ($1, $2, $3)
       on conflict (user_id, scope_id, role_id) do nothing`,
      [id, seedScopes.company, adminRoleId],
    );
    await client.query('commit');
  } finally {
    await client.end();
  }
}

/**
 * Writes the seed: first the scope tree and the dev admin as core's owner role (seedAccess), then
 * the articles and orders in one transaction as the role appUrl logs in as, nm_app, with the seed
 * plant as its read and write scope, so the row-level security policies apply as they do in the
 * server (ADR 0008). A record that exists, also one a person changed since, is left as it is, so a
 * second run adds nothing; the admin's role takes up a permission installed since the last run.
 * @param {{ appUrl: string, ownerUrl: string }} urls
 */
export async function seed({ appUrl, ownerUrl }) {
  await seedAccess(ownerUrl);
  const client = new pg.Client({ connectionString: appUrl });
  await client.connect();
  try {
    await client.query('begin');
    await client.query(
      `select set_config('northmes.read_scopes', $1::uuid[]::text, true),
              set_config('northmes.write_scopes', $1::uuid[]::text, true)`,
      [[seedScopes.plant]],
    );
    for (const { id, code, name } of articles) {
      await client.query(
        `insert into core.article (id, scope_id, code, name) values ($1, $2, $3, $4)
         on conflict (id) do nothing`,
        [id, seedScopes.plant, code, name],
      );
    }
    for (const { id, number, articleId, quantity } of orders) {
      await client.query(
        `insert into planning.production_order (id, scope_id, number, article_id, quantity)
         values ($1, $2, $3, $4, $5)
         on conflict (id) do nothing`,
        [id, seedScopes.plant, number, articleId, quantity],
      );
    }
    await client.query('commit');
  } finally {
    await client.end();
  }
}
