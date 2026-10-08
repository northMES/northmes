// The tracer seed of the stack script (E02-S08): fictional articles and production orders at one
// plant, so the board has orders to list. Every code, name, number and quantity here is made up.
// The planner and the operator, with their dev-only credentials, join the seed with Better Auth
// (E05-S05).

import pg from 'pg';

/**
 * The scope ids of the seed. No company or plant row exists until E05-S03, and the tracer principal
 * reads its plant alone, so the seed writes every record at the plant.
 */
export const seedScopes = {
  company: '019a0000-0000-7000-8000-00000000c001',
  plant: '019a0000-0000-7000-8000-00000000a001',
};

// Each record has a fixed id, so a second run finds it and writes nothing.
const articles = [
  { id: '019a0000-0000-7000-8000-0000000a0001', code: 'BR-140', name: 'Wall bracket' },
  { id: '019a0000-0000-7000-8000-0000000a0002', code: 'PN-305', name: 'Side panel' },
  { id: '019a0000-0000-7000-8000-0000000a0003', code: 'CW-220', name: 'Caster wheel' },
];

const [bracket, panel, caster] = articles.map(({ id }) => id);

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
 * Writes the seed in one transaction as the role appUrl logs in as, nm_app, with the seed plant as
 * its read and write scope, so the row-level security policies apply as they do in the server
 * (ADR 0008). A record that exists, also one a person changed since, is left as it is, so a second
 * run adds nothing.
 * @param {string} appUrl
 */
export async function seed(appUrl) {
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
