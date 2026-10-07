import pg from 'pg';
const { Temporal } = await import('temporal-polyfill/implementation');
const c = new pg.Client({ host: '127.0.0.1', port: +process.argv[2], user: 'nm_app', password: 'pw', database: 'postgres' });
await c.connect();
const tries = [
  ['Temporal.Instant -> timestamptz', 'select $1::timestamptz as v', [Temporal.Instant.from('2026-10-25T00:30:00Z')]],
  ['Temporal.PlainDateTime -> timestamp', 'select $1::timestamp as v', [Temporal.PlainDateTime.from('2027-03-28T02:30')]],
  ['Temporal.PlainDate -> date', 'select $1::date as v', [Temporal.PlainDate.from('2026-10-25')]],
  ['instant.toString() -> timestamptz', 'select $1::timestamptz::text as v', [Temporal.Instant.from('2026-10-25T00:30:00Z').toString()]],
  ['JS Date -> timestamp (local column)', 'select $1::timestamp::text as v', [new Date('2026-10-25T00:30:00Z')]],
];
for (const [k, q, p] of tries) { try { console.log(k, '->', JSON.stringify((await c.query(q, p)).rows[0].v)); } catch (e) { console.log(k, '-> ERROR', e.message); } }
await c.end();
