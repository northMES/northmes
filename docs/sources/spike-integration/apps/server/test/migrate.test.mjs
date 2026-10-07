import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { cpSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import pg from "pg";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { checkCatalog, loadCatalog } from "../dist/catalog.js";
import { migrate, pendingMigrations } from "../dist/migrate.js";
import { bootProcess, configWith, fixture, here, MODULES } from "./helpers.mjs";

let container, admin;
const urlFor = (db, user, pw) => `postgres://${user}:${pw}@${container.getHost()}:${container.getPort()}/${db}`;
let dbCount = 0;
async function freshDb() {
  const name = `t${++dbCount}`;
  await admin.query(`create database ${name}`);
  await admin.query(`grant create on database ${name} to nm_owner`);
  return { name, owner: urlFor(name, "nm_owner", "owner"), app: urlFor(name, "nm_app", "app") };
}
async function catalogOf(plugins) {
  const cfg = JSON.parse((await import("node:fs")).readFileSync(configWith(plugins), "utf8"));
  const mods = await loadCatalog({ ...cfg, baseDir: here });
  return checkCatalog(mods, "0.1.0").ordered;
}
const validator = resolve(here, "plugins/example-validator");

beforeAll(async () => {
  container = await new PostgreSqlContainer("postgres:18.4-alpine").withDatabase("bootstrap").start();
  admin = new pg.Client({ connectionString: container.getConnectionUri() });
  await admin.connect();
  // One-time installation bootstrap as superuser: the migration role and the runtime role.
  await admin.query(`create role nm_owner login password 'owner' createrole`);
  await admin.query(`create role nm_app login password 'app' nosuperuser nobypassrls`);
});
afterAll(async () => {
  await admin?.end();
  await container?.stop();
});

describe("northmes migrate with per-module owner roles", () => {
  let db;
  beforeAll(async () => { db = await freshDb(); });

  test("applies core, planning, then the plugin; second run is a no-op", async () => {
    const mods = await catalogOf([validator]);
    const first = await migrate(db.owner, mods);
    expect(first.applied).toEqual(["core/0001_article.sql", "planning/0001_production_order.sql", "example-validator/0001_rejection.sql"]);
    expect((await migrate(db.owner, mods)).applied).toEqual([]);
  });

  test("each schema is owned by its module's NOLOGIN role", async () => {
    const c = new pg.Client({ connectionString: db.owner }); await c.connect();
    const { rows } = await c.query(`select n.nspname, r.rolname, r.rolcanlogin from pg_namespace n join pg_roles r on r.oid = n.nspowner where n.nspname in ('core','planning','example_validator') order by 1`);
    await c.end();
    expect(rows).toEqual([
      { nspname: "core", rolname: "nm_mod_core", rolcanlogin: false },
      { nspname: "example_validator", rolname: "nm_mod_example_validator", rolcanlogin: false },
      { nspname: "planning", rolname: "nm_mod_planning", rolcanlogin: false },
    ]);
  });

  test("the app role writes across modules through foreign keys but cannot change schemas", async () => {
    const c = new pg.Client({ connectionString: db.app }); await c.connect();
    const a = await c.query(`insert into core.article (code, name) values ('TT-100', 'Table top') returning id`);
    const po = await c.query(`insert into planning.production_order (number, article_id, quantity) values ('4103', $1, 1500) returning id`, [a.rows[0].id]);
    await c.query(`insert into example_validator.rejection (production_order_id, reason) values ($1, 'too large')`, [po.rows[0].id]);
    await expect(c.query(`create table core.x (id int)`)).rejects.toThrow(/permission denied for schema core/);
    await expect(c.query(`alter table planning.production_order add column x int`)).rejects.toThrow(/must be owner of table production_order/);
    await c.end();
  });

  test("boot check passes when everything is applied", async () => {
    expect(await pendingMigrations(db.app, await catalogOf([validator]))).toEqual({ pending: [], unknown: [] });
  });
});

describe("Postgres refuses plugin migrations that touch other modules", () => {
  const cases = [
    ["bad-migration", /bad-migration\/0001.sql failed: must be owner of table article/],
    ["reads-other", /reads-other\/0001.sql failed: permission denied for table production_order/],
    ["sneaky-schema", /sneaky-schema\/0001.sql failed: permission denied for schema core/],
  ];
  for (const [id, pattern] of cases) {
    test(id, async () => {
      const db = await freshDb();
      await expect(migrate(db.owner, await catalogOf([fixture(id)]))).rejects.toThrow(pattern);
      // Superuser view of the result; nm_owner has no USAGE on module schemas, only SET ROLE.
      const c = new pg.Client({ connectionString: urlFor(db.name, "test", "test") }); await c.connect();
      const { rows } = await c.query(`select module from northmes_meta.migration order by module`);
      const cols = await c.query(`select attname as column_name from pg_attribute where attrelid = 'core.article'::regclass and attnum > 0 and not attisdropped order by attnum`);
      await c.end();
      expect(rows.map((r) => r.module)).not.toContain(id);
      expect(cols.rows.map((r) => r.column_name)).toEqual(["id", "code", "name"]);
    });
  }
});

describe("drift and ordering guards", () => {
  test("an applied migration that changed fails on its checksum", async () => {
    const db = await freshDb();
    const copy = mkdtempSync(join(here, "plugins", "tmp-"));
    cpSync(validator, copy, { recursive: true });
    await migrate(db.owner, await catalogOf([copy]));
    writeFileSync(join(copy, "migrations/0001_rejection.sql"), "create table example_validator.rejection (id int);\n");
    await expect(migrate(db.owner, await catalogOf([copy]))).rejects.toThrow(/example-validator\/0001_rejection.sql: changed after it was applied/);
  });

  test("boot refuses to start while a plugin's migration is pending", async () => {
    const db = await freshDb();
    await migrate(db.owner, await catalogOf([]));
    const r = bootProcess(configWith([validator]), { DATABASE_URL: db.app });
    expect(r.status).toBe(1);
    expect(r.out).toMatch(/migration example-validator\/0001_rejection.sql is not applied; run northmes migrate/);
  });

  test("two migrate runs at once apply each file once", async () => {
    const db = await freshDb();
    const mods = await catalogOf([validator]);
    const [a, b] = await Promise.all([migrate(db.owner, mods), migrate(db.owner, mods)]);
    expect([a.applied.length, b.applied.length].sort()).toEqual([0, 3]);
  });
});
