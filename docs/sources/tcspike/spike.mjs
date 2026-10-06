import { PostgreSqlContainer } from "@testcontainers/postgresql";
import pg from "pg";

const images = process.argv.slice(2);
for (const image of images) {
  const t0 = Date.now();
  try {
    const c = await new PostgreSqlContainer(image)
      .withDatabase("northmes")
      .withCommand(["postgres", "-c", "timescaledb.telemetry_level=off", "-c", "archive_mode=on", "-c", "archive_command=/bin/true", "-c", "archive_timeout=60"])
      .start();
    const client = new pg.Client({ connectionString: c.getConnectionUri() });
    await client.connect();
    await client.query("create extension if not exists timescaledb");
    const r = await client.query("select version() as v, (select extversion from pg_extension where extname='timescaledb') as ts, current_setting('timescaledb.telemetry_level') as tel, current_setting('archive_mode') as am, current_setting('data_directory') as dd, current_user as u");
    console.log(image, JSON.stringify(r.rows[0]), `${Date.now() - t0}ms`);
    await client.end();
    const pb = await c.exec(["sh", "-c", "command -v pgbackrest && pgbackrest version || echo no-pgbackrest"]);
    console.log("  pgbackrest:", pb.output.trim().replace(/\n/g, " | "));
    await c.snapshot();
    await c.restoreSnapshot();
    console.log("  snapshot/restore ok");
    await c.stop();
  } catch (e) {
    console.log(image, "FAILED", e.message);
  }
}
