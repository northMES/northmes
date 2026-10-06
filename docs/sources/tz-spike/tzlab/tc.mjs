import { PostgreSqlContainer } from '@testcontainers/postgresql';
import pg from 'pg';
const c = await new PostgreSqlContainer('postgres:18').withDatabase('northmes_test').withCommand(['postgres','-c','timezone=Pacific/Chatham']).start();
const client = new pg.Client({ connectionString: c.getConnectionUri() }); await client.connect();
const q = async s => (await client.query(s)).rows;
console.log(await q("SHOW timezone"));
console.log(await q("SELECT (timestamptz '2026-10-25 23:30:00+00')::date ::text AS cast_date, ((timestamptz '2026-10-25 23:30:00+00') AT TIME ZONE 'Europe/Stockholm')::date::text AS plant_date"));
await client.query("SET TIME ZONE 'UTC'");
console.log(await q("SELECT (timestamptz '2026-10-25 23:30:00+00')::date::text AS cast_date_utc"));
console.log(await q(`WITH p(plant, tz) AS (VALUES ('STO','Europe/Stockholm'),('HEL','Europe/Helsinki')),
 e(ts) AS (VALUES (timestamptz '2026-10-25 03:30:00+00'),(timestamptz '2026-10-25 04:30:00+00'),(timestamptz '2026-10-25 05:30:00+00'))
 SELECT plant, ts::text, ((ts AT TIME ZONE tz) - interval '6 hours')::date::text AS production_day FROM p, e ORDER BY plant, ts`));
await client.end(); await c.stop();
