import { PostgreSqlContainer } from "@testcontainers/postgresql";
import pg from "pg";
const image = process.argv[2];
for (const extra of [[], ["-c", "timescaledb.max_background_workers=0"]]) {
  const c = await new PostgreSqlContainer(image).withDatabase("northmes")
    .withCommand(["postgres", "-c", "timescaledb.telemetry_level=off", ...extra]).start();
  const client = new pg.Client({ connectionString: c.getConnectionUri() });
  await client.connect();
  await client.query("create extension if not exists timescaledb");
  await client.query("create table m(t timestamptz not null, v int)");
  await client.query("select create_hypertable('m','t')");
  await client.query("insert into m values (now(), 1)");
  const a = await client.query("select datname, backend_type, application_name from pg_stat_activity where datname='northmes' and pid <> pg_backend_pid()");
  console.log(extra.join(" ") || "(default)", "other sessions:", JSON.stringify(a.rows));
  await client.end();
  try { await c.snapshot(); await c.restoreSnapshot(); console.log("  snapshot+restore ok"); }
  catch (e) { console.log("  snapshot failed:", e.message.split("\n")[0]); }
  await c.stop();
}
