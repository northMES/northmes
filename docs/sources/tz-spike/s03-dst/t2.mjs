import pg from 'pg';
const port = process.argv[2];
const id = (v) => v;
for (const oid of [1082, 1083, 1114, 1184]) pg.types.setTypeParser(oid, id); // the four OIDs internal research note 11 lists
const base = { host: '127.0.0.1', port: +port, database: 'postgres' };
const q = `select array[timestamptz '2026-10-25 01:30+00'] as tstz_arr,
  array[timestamp '2027-03-28 02:30', timestamp '2026-10-25 02:30'] as ts_arr,
  array[date '2026-03-29'] as date_arr,
  array[time '02:30'] as time_arr,
  tstzrange('2026-10-24 20:00+00','2026-10-25 05:00+00') as tstz_range,
  timestamp '2027-03-28 02:30' as ts_scalar,
  current_setting('TimeZone') as session_tz`;
const c1 = new pg.Client({ ...base, user: 'postgres', password: 'pw' });
await c1.connect();
const r = (await c1.query(q)).rows[0];
for (const [k, v] of Object.entries(r)) console.log('superuser', k, Array.isArray(v) ? v.map((x) => (x instanceof Date ? 'Date ' + x.toISOString() : JSON.stringify(x))).join(', ') : (v instanceof Date ? 'Date ' + v.toISOString() : JSON.stringify(v)));
await c1.end();
const c2 = new pg.Client({ ...base, user: 'postgres', password: 'pw', options: '-c TimeZone=UTC' });
await c2.connect();
console.log('options -c TimeZone=UTC ->', (await c2.query(`select current_setting('TimeZone') tz, timestamptz '2026-10-25 01:30+00'::text as txt`)).rows[0]);
await c2.end();
const c3 = new pg.Client({ ...base, user: 'nm_app', password: 'pw' });
await c3.connect();
console.log('nm_app role default ->', (await c3.query(`select current_setting('TimeZone') tz`)).rows[0]);
await c3.end();
