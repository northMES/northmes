import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import pg from "pg";
import type { InstalledModule } from "./catalog.js";

const q = (ident: string) => `"${ident.replaceAll('"', '""')}"`;
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const ownerRoleOf = (m: InstalledModule) => `nm_mod_${m.names.sql}`;

export class MigrationError extends Error {}

/**
 * `northmes migrate`: runs as nm_owner on a direct connection. Every module and plugin gets its own
 * NOLOGIN owner role that owns only its schema; its files run under SET LOCAL ROLE, so Postgres
 * itself refuses a plugin migration that alters or reads another module's tables.
 */
export async function migrate(ownerUrl: string, modules: readonly InstalledModule[], appRole = "nm_app") {
  const client = new pg.Client({ connectionString: ownerUrl });
  await client.connect();
  const applied: string[] = [];
  try {
    await client.query("select pg_advisory_lock(hashtextextended('northmes.migrate', 0))");
    await client.query(`create schema if not exists northmes_meta`);
    await client.query(`create table if not exists northmes_meta.migration (
      module text not null, name text not null, sha256 text not null,
      applied_at timestamptz not null default now(), primary key (module, name))`);
    await client.query(`grant usage on schema northmes_meta to ${q(appRole)}; grant select on northmes_meta.migration to ${q(appRole)}`);
    const ext = await client.query(`select 1 from pg_roles where rolname = 'nm_ext'`);
    if (!ext.rowCount) await client.query(`create role nm_ext nologin`);
    for (const m of modules) {
      const role = ownerRoleOf(m);
      const schema = m.names.sql;
      const exists = await client.query(`select 1 from pg_roles where rolname = $1`, [role]);
      if (!exists.rowCount) {
        await client.query(`create role ${q(role)} nologin`);
        // PG 16+: the creator gets ADMIN only; SET is needed for SET ROLE and CREATE SCHEMA ... AUTHORIZATION.
        await client.query(`grant ${q(role)} to current_user with set true, inherit false`);
        await client.query(`grant nm_ext to ${q(role)}`);
      }
      await client.query(`create schema if not exists ${q(schema)} authorization ${q(role)}`);
      await client.query("begin");
      await client.query(`set local role ${q(role)}`);
      await client.query(`grant usage on schema ${q(schema)} to ${q(appRole)}, nm_ext`);
      await client.query(`alter default privileges in schema ${q(schema)} grant select, insert, update, delete on tables to ${q(appRole)}`);
      await client.query(`alter default privileges in schema ${q(schema)} grant usage, select on sequences to ${q(appRole)}`);
      await client.query("commit");

      const done = new Map((await client.query(`select name, sha256 from northmes_meta.migration where module = $1`, [m.manifest.id])).rows.map((r) => [r.name, r.sha256]));
      const known = new Set(m.migrationFiles.map((f) => basename(f)));
      for (const name of done.keys()) {
        if (!known.has(name)) throw new MigrationError(`${m.manifest.id}: database has migration ${name} that this build does not know (database is ahead of the image)`);
      }
      for (const file of m.migrationFiles) {
        const name = basename(file);
        const sql = readFileSync(file, "utf8");
        const hash = sha256(sql);
        if (done.has(name)) {
          if (done.get(name) !== hash) throw new MigrationError(`${m.manifest.id}/${name}: changed after it was applied (checksum mismatch)`);
          continue;
        }
        try {
          await client.query("begin");
          await client.query(`set local role ${q(role)}`);
          await client.query(sql);
          await client.query("reset role");
          await client.query(`insert into northmes_meta.migration (module, name, sha256) values ($1, $2, $3)`, [m.manifest.id, name, hash]);
          await client.query("commit");
          applied.push(`${m.manifest.id}/${name}`);
        } catch (e) {
          await client.query("rollback");
          throw new MigrationError(`${m.manifest.id}/${name} failed: ${(e as Error).message}`);
        }
      }
    }
  } finally {
    await client.query("select pg_advisory_unlock_all()").catch(() => {});
    await client.end();
  }
  return { applied };
}

/** Boot check, read-only, as the app role: every installed migration applied, nothing unknown. */
export async function pendingMigrations(appUrl: string, modules: readonly InstalledModule[]) {
  const client = new pg.Client({ connectionString: appUrl });
  await client.connect();
  try {
    const rows = (await client.query(`select module, name from northmes_meta.migration`)).rows as { module: string; name: string }[];
    const applied = new Set(rows.map((r) => `${r.module}/${r.name}`));
    const pending = modules.flatMap((m) => m.migrationFiles.map((f) => `${m.manifest.id}/${basename(f)}`)).filter((k) => !applied.has(k));
    const installed = new Set(modules.flatMap((m) => m.migrationFiles.map((f) => `${m.manifest.id}/${basename(f)}`)));
    const unknown = [...applied].filter((k) => !installed.has(k) && modules.some((m) => k.startsWith(`${m.manifest.id}/`)));
    return { pending, unknown };
  } finally {
    await client.end();
  }
}
