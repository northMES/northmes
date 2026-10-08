---
status: "accepted"
date: 2026-10-08
decision-makers: Krister Johansson
consulted: internal research notes 06, 16, 17, 20, 22, 24 and 32
informed: contributors and coding agents
release: "1"
needs-confirmation: ""
---

# Kysely, SQL-first migrations and the NorthMES migration runner

## Context and problem statement

Every module and plugin owns one Postgres schema ([ADR 0002](0002-modular-monolith-with-module-owned-schemas-and-process-roles.md)). The rules that keep data safe are SQL: row-level security policies ([ADR 0008](0008-row-level-security-with-transaction-local-scopes.md)), exclusion constraints ([ADR 0009](0009-code-uniqueness-per-scope-with-an-exclusion-constraint.md)), stored generated columns, grants, `security_invoker` views and audit triggers ([ADR 0013](0013-audit-trail-written-in-the-command-transaction.md)). Modules and drop-in plugins bring their own migrations, which must run in dependency order and must not touch another module's tables. Plugin server code runs inside the app process, so the app's database login must not be able to change the schema or the audit trail. Coding agents write most migrations.

This ADR decides the data access library, the migration file format, the migration runner, the database roles and grants, and the key, version and archive rules that every table follows. It covers the runner in `apps/server`, `@northmes/sdk/data`, every module's `migrations/` folder and the `migrate` Compose service.

## Decision drivers

* One source of schema truth that a reviewer can read, including the SQL an ORM does not model.
* Postgres, not convention, stops a module's migration from touching another module's schema.
* The app login cannot alter the schema, truncate tables, bypass row-level security or read password hashes.
* Two concurrent runs apply each file once, and an edited applied file is caught.
* A migration that would remove another module's foreign key fails before it commits.
* An upgrade that will not compose fails before any file is applied.
* Agents and CI run migrations without interactive prompts.

## Considered options

* Kysely with SQL-first migrations and a NorthMES migration runner
* Drizzle ORM with drizzle-kit migrations
* Kysely with an existing runner (Kysely's `Migrator`, node-pg-migrate or graphile-migrate)

## Decision outcome

Chosen option: "Kysely with SQL-first migrations and a NorthMES migration runner", because the migrated database is then the only schema truth, generated per-module types keep each module's queries inside its own schema, and the runner does what no existing tool does: per-module owner roles, module order and the inbound foreign key guard.

### Data access and files

* Kysely 0.29 with `pg` 8.23. Drizzle and Prisma are not used.
* `kysely-codegen` generates one `DB` type per module (`--include-pattern "planning.*"`) from a migrated database. Module code imports only its own type, so a query on another module's table is a type error. `pnpm db:types --verify` fails on drift; the time type mapping is in [ADR 0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md).
* Migrations are SQL files named `migrations/<UTC yyyymmddHHMMss>_<slug>.sql` next to the module manifest. They are forward-only and use schema-qualified names. Each file carries an `expand` or `contract` marker ([ADR 0045](0045-backups-restore-drills-upgrades-and-rollback.md)).
* `pnpm gen:migration <module> <slug>` writes a new file from the table template ([ADR 0022](0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md)). The template writes policies and triggers as inline SQL and never calls a shared SQL helper, because a helper replaced in a later core migration would make a fresh database and an upgraded one differ.

### What `northmes migrate` does

1. Runs boot steps 1 to 10 of [ADR 0002](0002-modular-monolith-with-module-owned-schemas-and-process-roles.md) without listening. In this mode the migration check of step 5 lists pending files instead of failing on them. `migrate --check` stops here, before the first file.
2. Takes `pg_advisory_lock` on a dedicated direct connection with a `lock_timeout`.
3. Orders modules topologically by `dependsOn`, core first.
4. Reads each module's files in lexical order and refuses two files with the same timestamp prefix in one module.
5. Tracks applied files in `northmes_meta.migration(module, name, sha256, applied_at)` and exits 1 on a changed checksum.
6. Before a module's pending files, records the foreign keys that point into its schema from other schemas, disabled plugins included. After each file it compares and raises when one has disappeared.
7. Runs each file in its own transaction with `SET LOCAL ROLE nm_mod_<sql>`.
8. Re-applies repeatable files (views, SQL functions) whose hash changed, after the versioned files.
9. Runs pg-boss's schema migration, creates the queues (never with `partition: true`, which runs DDL) and grants `MAINTAIN` on the pg-boss tables to `nm_app`, or pg-boss runs with `reindex: false`. Every role starts pg-boss with `migrate: false`.
10. Syncs the permission catalog and default roles from the manifests. Boot does not.
11. Calls `audit.ensure_partitions(...)` and runs the trigger and classification checks of [ADR 0013](0013-audit-trail-written-in-the-command-transaction.md). When a check fails, it lists every offender in one message and exits 1.

Data migrations and the permission sync run inside an audit context that migrate opens. Seeds use surface `cli`. Tests write fixtures through `db.command({ principal, scopes, reason }, fn)` from `@northmes/testing`, and the audit trigger's error names the fix: "in tests use db.command(...), in code use the command pipeline".

### Roles and grants

| Role | Login | Rights |
|---|---|---|
| `nm_owner` | yes, used only by the `migrate` service | `CREATEROLE` and `CREATE` on the database; creates the module roles and grants itself `SET TRUE, INHERIT FALSE` on each; the only login that may `SET ROLE` to a module owner role |
| `nm_mod_<sql>` | no | owns exactly one module or plugin schema; member of `nm_ext` |
| `nm_ext` | no | receives `grant references (id) on <table> to nm_ext` from owners that allow foreign keys into a table |
| `nm_app` | yes | `SELECT`, `INSERT`, `UPDATE`, `DELETE` only; no ownership, no `BYPASSRLS`, no `TRUNCATE` |
| `nm_auth` | yes | Better Auth's pool; rights on the `auth` schema only |
| audit owner | no | owns the `audit` schema and its definer functions |

* `nm_owner` grants itself `SET` explicitly, because a `CREATEROLE` creator gets `ADMIN` but neither `SET` nor `INHERIT` on the roles it creates.
* A plugin foreign key to a table whose owner granted no `REFERENCES` fails with SQLSTATE 42501 and the message "core does not allow references to core.customer; store the id without a foreign key or ask core to declare it". Plugin foreign keys into other modules use `ON DELETE CASCADE` or `ON DELETE SET NULL`, as the owner's grant policy states.
* `nm_app` reads user names only through the `security_invoker` view `core.user_directory(id, name, username, banned)`, never from `auth.account` or `auth.session`.
* The `app` container never receives the owner password ([ADR 0047](0047-secrets-and-the-installation-key.md)).
* Every role gets `ALTER ROLE ... SET timezone = 'UTC'`. The zone is pinned per role, not with `ALTER DATABASE`, because a database cloned from a template loses database settings.
* The migration lint rejects `cascade`, `drop table`, dropping a constraint on a referenced table and changing a key column's type unless the file carries the `contract` marker. It also fails on any `TRUNCATE` grant.

### Keys, versions and archive

* Primary keys are `uuid primary key default uuidv7()` and are never reused.
* Every mutable row has `version integer not null default 1`. A `BEFORE UPDATE` trigger bumps it, so SQL-level imports cannot forget it. Commands take `expectedVersion`. `xmin` is not used.
* Business records are archived (`archived_at`), never hard-deleted. Lists hide archived rows unless `includeArchived: true`.
* Rows carry provenance ids (`created_by`, `updated_by`), never names.
* Article and business quantities are `numeric(18,6)`.
* Imports write only rows whose own columns differ (`update ... where (columns) is distinct from (new values)`), so an ERP note does not bump every job order's version and turn planners' draft rows stale.

### Consequences

* Good, because every constraint, policy, grant and trigger is plain SQL in one reviewed file.
* Good, because the spike's runner applied core, planning and a plugin in order as their own roles, and Postgres refused every plugin attempt to alter, read into or create in another schema (internal research note 20).
* Good, because the inbound foreign key guard stops a `drop table ... cascade` from silently dropping a plugin's key, which the stress test reproduced on Postgres 18.4 (internal research note 32).
* Bad, because NorthMES owns about 200 lines of runner code and its tests.
* Bad, because Kysely has no relational query API, so nested reads use joins, `jsonArrayFrom` or DataLoader.
* Bad, because `pnpm db:types` needs a migrated database, so type generation starts a Testcontainers database.

### Confirmation

* `migrate.test.ts` (Testcontainers): modules apply in the order core, planning, plugin; a second run is a no-op; schemas are owned by NOLOGIN roles; as a plugin owner, `ALTER TABLE core.article` fails with "must be owner of table article", `CREATE TABLE ... AS SELECT * FROM planning.production_order` fails with "permission denied for table production_order" and `CREATE TABLE core.x` fails with "permission denied for schema core"; an edited applied file exits 1 naming the file; boot refuses a pending migration; two concurrent runs apply each file once; two files with the same timestamp prefix in one module exit 1.
* `migrate-guards.test.ts`: a planning fixture file with `drop table ... cascade`, while the example validator's foreign key exists, raises a migration error naming `example_validator.rejection_production_order_id_fkey`, and `pg_constraint` still holds the key.
* `migrate --check` test: a planning fixture with `quantity: Float!` plus the example validator build (`@external quantity: Int!`) exits 1 naming `example-validator`, `EXTERNAL_TYPE_MISMATCH` and `ProductionOrder.quantity`, and `northmes_meta.migration` is unchanged.
* Template test: a table generated by `pnpm gen:migration` passes the row-level security and audit catalog lints with no edits; a fixture plugin with a foreign key to an ungranted core table fails with the message above.
* Role tests: as `nm_app`, `SET ROLE` to the audit owner fails, `DROP TABLE` on an audit partition fails with "must be owner", and `select` from `auth.account` fails while `core.user_directory` works.
* Zone pin test: against a container started with `-c timezone=Pacific/Chatham`, every pool reports `current_setting('TimeZone') = 'UTC'`.
* Fixture test: a raw insert outside `db.command` fails with SQLSTATE P0001 naming `db.command`.
* Version tests: the trigger bumps `version` on a plain SQL update; a stale `expectedVersion` returns `core.version_conflict` and leaves the row unchanged; an import of an unchanged order writes no row update.
* CI runs the migration lint and `pnpm db:types --verify`.

## Pros and cons of the options

### Kysely, SQL-first migrations, NorthMES runner

* Good, because Kysely has no schema DSL, so nothing competes with the SQL files.
* Good, because the runner knows the module catalog, the owner roles and the boot checks.
* Bad, because NorthMES writes and maintains the runner.

### Drizzle ORM with drizzle-kit

* Good, because the schema lives in TypeScript with relational queries, and RLS policies can be declared there.
* Bad, because triggers, functions and other unmodelled SQL go into custom files that drizzle-kit's snapshot cannot see, which gives two sources of truth.
* Bad, because exclusion constraints are not supported (drizzle-orm issue #3388), `migrate()` takes no lock so concurrent runs apply migrations twice (#874), and `drizzle-kit generate` asks interactive rename questions (#5307).
* Bad, because 0.45 is the stable line and 1.0 was still a release candidate when checked, so starting now means a major migration later.

### Kysely with an existing runner

* Good, because less runner code is NorthMES's own.
* Bad, because Kysely's `Migrator` runs one folder per instance and all pending migrations in one transaction by default, node-pg-migrate would have to run once per module, and graphile-migrate assumes one migration stream per database.
* Bad, because none of them switches to a per-module owner role, orders modules by `dependsOn`, guards inbound foreign keys or runs the boot checks first, so a wrapper would remain.

## More information

* Related ADRs: [0002](0002-modular-monolith-with-module-owned-schemas-and-process-roles.md) module ownership and boot steps, [0005](0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md) image and bootstrap, [0008](0008-row-level-security-with-transaction-local-scopes.md) row-level security, [0009](0009-code-uniqueness-per-scope-with-an-exclusion-constraint.md) code uniqueness, [0013](0013-audit-trail-written-in-the-command-transaction.md) audit, [0014](0014-outbox-event-log-and-pg-boss-jobs.md) pg-boss, [0022](0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md) generators, [0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md) driver parsers, [0045](0045-backups-restore-drills-upgrades-and-rollback.md) upgrade compatibility, [0047](0047-secrets-and-the-installation-key.md) secrets.
* Plan: [04 data and platform](../plan/04-data-and-platform.md) (roles, data access, migrations, keys and versions), [02 architecture](../plan/02-architecture.md).
* Kysely: https://kysely.dev/
* PostgreSQL role attributes: https://www.postgresql.org/docs/18/role-attributes.html
* Revisit when a customer's database policy forbids `CREATEROLE` for `nm_owner` (then `northmes db bootstrap` creates the module roles), or when per-module runtime roles replace the single `nm_app`.
