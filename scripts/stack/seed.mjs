// The seed of the stack script (E02-S08, E05-S03, E05-S05): one company with two plants, a dev
// admin who signs in with a dev-only password, and fictional articles and production orders at
// the plants, so the board has orders to list, the article list has pages and the plant switcher
// has two plants. Every code, name, number and quantity here is made up.
// Beside the dev admin, a Plant admin, a planner, an operator and a viewer at plant A sign in with
// dev-only passwords, so each role can be tried in the app (E05-S08).

import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import pg from 'pg';

/**
 * The seed's company: a Better Auth organization, whose slug is the company's id (ADR 0066), and
 * the root of the scope tree.
 */
export const seedCompany = {
  id: '019a0000-0000-7000-8000-00000000c001',
  organizationId: '019a0000-0000-7000-8000-00000000c002',
  name: 'Demo Works',
};

/** The seed's plants, plant number 1 first: each one's scope id, URL slug and name. */
export const seedPlants = [
  { id: '019a0000-0000-7000-8000-00000000a001', slug: 'plant-a', name: 'Plant A' },
  { id: '019a0000-0000-7000-8000-00000000a002', slug: 'plant-b', name: 'Plant B' },
];

const [plantA, plantB] = seedPlants.map(({ id }) => id);

/**
 * The dev admin, the seed company's Company admin, who holds every permission there, and who signs
 * in with the email under the reserved .test domain (RFC 2606). The password is for development
 * only, it is no secret, and it never reaches production: the stack script seeds only the database
 * of pnpm dev, pnpm demo and the end-to-end tests.
 */
export const devAdmin = {
  id: '019a0000-0000-7000-8000-0000000d0001',
  username: 'admin',
  password: 'northmes-dev-admin',
  name: 'Dev admin',
  email: 'admin@northmes.test',
};

/**
 * The custom role Operator of the seed company: no module declares an operator default role yet,
 * so the seed writes one that reads articles and production orders.
 */
const operatorRole = {
  id: '019a0000-0000-7000-8000-0000000e0001',
  key: 'custom-019a0000-0000-7000-8000-0000000e0001',
  name: 'Operator',
  permissions: ['core.article:read', 'planning.productionOrder:read'],
};

/**
 * The dev users beside the dev admin, each holding one role at plant A, so the maintainer can sign
 * in as each and see what the role allows: core's Plant admin, planning's Planner and Viewer, and
 * the seed's custom Operator. Like the dev admin's, each email is under the reserved .test domain
 * and each password is for development only, no secret, and never reaches production. Every name
 * is fictional.
 */
export const devUsers = {
  plantAdmin: {
    id: '019a0000-0000-7000-8000-0000000d0002',
    username: 'jonas.holm',
    password: 'northmes-dev-plant-admin',
    name: 'Jonas Holm',
    email: 'jonas.holm@northmes.test',
    roleKey: 'core-plant-admin',
  },
  planner: {
    id: '019a0000-0000-7000-8000-0000000d0003',
    username: 'alex.lund',
    password: 'northmes-dev-planner',
    name: 'Alex Lund',
    email: 'alex.lund@northmes.test',
    roleKey: 'planning-planner',
  },
  operator: {
    id: '019a0000-0000-7000-8000-0000000d0004',
    username: 'anna.berg',
    password: 'northmes-dev-operator',
    name: 'Anna Berg',
    email: 'anna.berg@northmes.test',
    roleKey: operatorRole.key,
  },
  viewer: {
    id: '019a0000-0000-7000-8000-0000000d0005',
    username: 'sara.nyberg',
    password: 'northmes-dev-viewer',
    name: 'Sara Nyberg',
    email: 'sara.nyberg@northmes.test',
    roleKey: 'planning-viewer',
  },
};

/** The dev admin's address before it signed in with an email, which no mail reaches. */
const earlierDevAdminEmail = 'admin@users.northmes.invalid';

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

/** The three articles the orders make, each at the plant of its orders. */
const orderArticles = [
  { id: articleId(1), plant: plantA, code: 'BR-140', name: 'Wall bracket' },
  { id: articleId(2), plant: plantA, code: 'PN-305', name: 'Side panel' },
  { id: articleId(3), plant: plantB, code: 'CW-220', name: 'Caster wheel' },
];

/**
 * Families of further articles, three sizes each, so the article list of each plant has pages to
 * walk: the first ten families at plant A, the others at plant B.
 */
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
      plant: family < 10 ? plantA : plantB,
      code: `${prefix}-${500 + index * 10}`,
      name: `${name} ${size}`,
    })),
  ),
];

const [bracket, panel, caster] = orderArticles.map(({ id }) => id);

/** The production orders, each at the plant of its article. */
const orders = [
  {
    id: '019a0000-0000-7000-8000-0000000b0001',
    plant: plantA,
    number: 'DEV-1001',
    articleId: bracket,
    quantity: '500',
  },
  {
    id: '019a0000-0000-7000-8000-0000000b0002',
    plant: plantA,
    number: 'DEV-1002',
    articleId: panel,
    quantity: '80',
  },
  {
    id: '019a0000-0000-7000-8000-0000000b0003',
    plant: plantB,
    number: 'DEV-1003',
    articleId: caster,
    quantity: '1200',
  },
  {
    id: '019a0000-0000-7000-8000-0000000b0004',
    plant: plantA,
    number: 'DEV-1004',
    articleId: bracket,
    quantity: '150',
  },
];

/**
 * Gives a user the seed company's role with this key at a scope, once: a second run, or a role the
 * company lacks, writes nothing.
 * @param {pg.Client} client
 * @param {string} userId
 * @param {string} scopeId
 * @param {string} roleKey
 */
async function assign(client, userId, scopeId, roleKey) {
  await client.query(
    `insert into core.role_assignment (user_id, company_id, scope_id, role_id)
     select $1, r.company_id, $2, r.id
       from core.role r
      where r.company_id = $3 and r.key = $4
        and exists (select 1 from auth."user" where id = $1)
     on conflict (user_id, scope_id, role_id) do nothing`,
    [userId, scopeId, seedCompany.id, roleKey],
  );
}

/**
 * Writes the company, its plants and the dev admin in one transaction as core's owner role, on a
 * connection that ownerUrl logs in as nm_owner: the company's Better Auth organization, its node in
 * core.scope and its core.company row, each plant's node and core.plant row, the admin in
 * auth.user with a password account, and the assignment of core's Company admin at the company,
 * so the last-admin rule keeps the seed company's admin (ADR 0007, ADR 0010, ADR 0066). Then the
 * custom role Operator and the dev users, each with a password account and their role at plant A.
 * None of them must set a new password, since the seed's passwords are not temporary.
 * @param {string} ownerUrl
 */
async function seedAccess(ownerUrl) {
  const client = new pg.Client({ connectionString: ownerUrl });
  await client.connect();
  try {
    await client.query('begin');
    await client.query('set local role nm_mod_core');
    await client.query(
      `insert into auth.organization (id, name, slug, "createdAt") values ($1, $2, $3, now())
       on conflict (id) do nothing`,
      [seedCompany.organizationId, seedCompany.name, seedCompany.id],
    );
    await client.query(
      `insert into core.scope (id, company_id, parent_id, kind, span)
       values ($1, $1, null, 'company', '(,)')
       on conflict (id) do nothing`,
      [seedCompany.id],
    );
    await client.query(
      `insert into core.company (id, organization_id, name) values ($1, $2, $3)
       on conflict (id) do nothing`,
      [seedCompany.id, seedCompany.organizationId, seedCompany.name],
    );
    for (const [index, { id, slug, name }] of seedPlants.entries()) {
      await client.query(
        `insert into core.scope (id, company_id, parent_id, kind, span)
         values ($1, $2, $2, 'plant', int8range($3::int8 << 32, ($3::int8 + 1) << 32))
         on conflict (id) do nothing`,
        [id, seedCompany.id, index + 1],
      );
      await client.query(
        `insert into core.plant (id, company_id, slug, name) values ($1, $2, $3, $4)
         on conflict (id) do nothing`,
        [id, seedCompany.id, slug, name],
      );
    }
    const { id, username, password, name, email } = devAdmin;
    // A dev admin seeded with the earlier address moves to the one it signs in with.
    await client.query(
      `insert into auth."user" (id, name, email, "emailVerified", username, "displayUsername")
       values ($1, $2, $3, true, $4, $4)
       on conflict (id) do update set email = excluded.email
        where auth."user".email = $5`,
      [id, name, email, username, earlierDevAdminEmail],
    );
    await client.query(
      `insert into auth.account ("accountId", "providerId", "userId", password, "updatedAt")
       select $1::text, 'credential', $1::uuid, $2, now()
        where not exists (
          select 1 from auth.account where "userId" = $1::uuid and "providerId" = 'credential'
        )`,
      [id, await hashPassword(password)],
    );
    // The trigger on core.company gave the company core's Company admin, which northmes migrate
    // keeps holding every installed permission.
    await assign(client, id, seedCompany.id, 'core-company-admin');
    // A custom role named Operator that a person made already stays as it is.
    await client.query(
      `insert into core.role (id, company_id, key, name, permissions, origin)
       values ($1, $2, $3, $4, $5, 'custom')
       on conflict do nothing`,
      [
        operatorRole.id,
        seedCompany.id,
        operatorRole.key,
        operatorRole.name,
        operatorRole.permissions,
      ],
    );
    for (const user of Object.values(devUsers)) {
      await client.query(
        `insert into auth."user" (id, name, email, "emailVerified", username, "displayUsername")
         values ($1, $2, $3, true, $4, $4)
         on conflict do nothing`,
        [user.id, user.name, user.email, user.username],
      );
      await client.query(
        `insert into auth.account ("accountId", "providerId", "userId", password, "updatedAt")
         select $1::text, 'credential', $1::uuid, $2, now()
          where exists (select 1 from auth."user" where id = $1::uuid)
            and not exists (
              select 1 from auth.account where "userId" = $1::uuid and "providerId" = 'credential'
            )`,
        [user.id, await hashPassword(user.password)],
      );
      await assign(client, user.id, plantA, user.roleKey);
    }
    await client.query('commit');
  } finally {
    await client.end();
  }
}

/**
 * Writes the seed: first the company, its plants and the dev admin as core's owner role
 * (seedAccess), then the articles and orders in one transaction as the role appUrl logs in as,
 * nm_app, with the company and both plants as its read and write scopes, so the row-level security
 * policies apply as they do in the server (ADR 0008). A record that exists, also one a person changed since, is
 * left as it is, so a second run adds nothing; northmes migrate gives Company admin a permission
 * installed since the last run.
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
      [[seedCompany.id, plantA, plantB]],
    );
    // Each article belongs to the company and is assigned to its one plant, which is its edit
    // scope (ADR 0073).
    for (const { id, plant, code, name } of articles) {
      const { rowCount } = await client.query(
        `insert into core.article (id, scope_id, company_id, scope_span, edit_scope_id, code, name)
         select $1, s.id, s.company_id, s.span, $3, $4, $5 from core.scope s where s.id = $2
         on conflict (id) do nothing`,
        [id, seedCompany.id, plant, code, name],
      );
      if (rowCount === 0) continue;
      await client.query(
        `insert into core.article_plant (article_id, plant_id, scope_id, edit_scope_id)
         values ($1, $2, $3, $2)`,
        [id, plant, seedCompany.id],
      );
    }
    for (const { id, plant, number, articleId, quantity } of orders) {
      await client.query(
        `insert into planning.production_order (id, scope_id, number, article_id, quantity)
         values ($1, $2, $3, $4, $5)
         on conflict (id) do nothing`,
        [id, plant, number, articleId, quantity],
      );
    }
    await client.query('commit');
  } finally {
    await client.end();
  }
}
