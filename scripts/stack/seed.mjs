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

const articles = [
  { code: 'BR-140', name: 'Wall bracket' },
  { code: 'PN-305', name: 'Side panel' },
  { code: 'CW-220', name: 'Caster wheel' },
];

const orders = [
  { number: 'DEV-1001', article: 'BR-140', quantity: '500' },
  { number: 'DEV-1002', article: 'PN-305', quantity: '80' },
  { number: 'DEV-1003', article: 'CW-220', quantity: '1200' },
  { number: 'DEV-1004', article: 'BR-140', quantity: '150' },
];

/**
 * Writes the seed in one transaction as the role appUrl logs in as, nm_app, with the seed plant as
 * its read and write scope, so the row-level security policies apply as they do in the server
 * (ADR 0008).
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
    /** @type {Map<string, string>} */
    const articleIds = new Map();
    for (const { code, name } of articles) {
      const { rows } = await client.query(
        'insert into core.article (scope_id, code, name) values ($1, $2, $3) returning id',
        [seedScopes.plant, code, name],
      );
      articleIds.set(code, rows[0].id);
    }
    for (const { number, article, quantity } of orders) {
      await client.query(
        `insert into planning.production_order (scope_id, number, article_id, quantity)
         values ($1, $2, $3, $4)`,
        [seedScopes.plant, number, articleIds.get(article), quantity],
      );
    }
    await client.query('commit');
  } finally {
    await client.end();
  }
}
