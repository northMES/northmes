---
name: db-test
description: NorthMES recipe for tests against Postgres. Use when writing a *.int.test.ts, a fixture through db.command, a test with useTestDatabase, createTestApp or configForTest, a migration or row-level security test, or when a migrate, grant or row-level security error needs its meaning.
---

# Database tests

`@northmes/testing` (MIT) holds the harness (ADR 0041). Each integration run starts one Postgres container, and each test file gets a database of its own, cloned from a template that already holds the migrations of the in-repo modules. Tests log in as `nm_app` or `nm_owner`, never as the superuser, which bypasses row-level security.

## Files

- `vitest.config.ts`: the `integration` project runs `*.int.test.ts` with two global setups, in this order.
- `packages/testing/src/global-setup.ts`: starts the container from the image in `infra/pg-image.json` (`startPostgres` in `postgres-server.ts`), creates the empty template `nm_template` (`emptyTemplateDatabase`), and reads the server's time zone, data directory and mounts as the superuser into `inject('pgServer')`.
- `apps/server/test/global-setup.ts`: bootstraps `nm_owner`, `nm_app`, `nm_auth` and `nm_ext` with passwords of this run, then migrates the in-repo modules into `nm_template_<16 hex>`, named after a hash of their migration files. An unchanged set of files reuses the template; a new or changed file gives a new name.
- `packages/testing/src/database.ts`: `useTestDatabase()`, which clones the migrated template for the calling file, or the template that `useTestDatabase({ template })` names.
- `packages/testing/src/db-command.ts`: `db.command`, the fixture writer.
- `packages/testing/src/given.ts`: `given.plant()` and `given.company()`.
- `packages/testing/src/config-for-test.ts`: `configForTest(overrides, secrets)`, the ConfigModule of a test app.
- `packages/testing/src/create-test-app.ts` and `apps/server/src/testing.ts`: `createTestApp` and the host factory it calls. `apps/server/src/testing.ts` also holds `statementsDuring`, the statement counter on the app's pool.
- `apps/server/src/db/database.module.ts`: the app's one `nm_app` pool (the `Pool` provider) and the `ScopedDatabase` under `DATABASE` from `@northmes/sdk/data`. `apps/server/src/principal.ts`: `runAs(principal, fn)`, which names the principal whose scope sets each transaction in `fn` sets.
- `packages/testing/src/boot-built.ts`: `bootBuilt`, which starts the built server in a child process.
- `scripts/templates/table.sql`, rendered by `scripts/gen-migration.mjs`: the table template with its four policies.
- `apps/server/src/migrate/runner.ts`: `migrate`, which the template setup and `pnpm northmes migrate` run.
- `scripts/lint/no-truncate.mjs`, run by `test/meta/no-truncate.test.ts`: refuses a migration that grants TRUNCATE.

## Commands

- `pnpm exec vitest run --project integration <file>`: one integration file. Docker must be running.
- `pnpm test:int`: every integration file.
- `pnpm gen:migration <module> <slug>`: writes `modules/<module>/migrations/<UTC yyyymmddHHMMss>_<slug>.sql` from the table template.
- `pnpm northmes db bootstrap` and `pnpm northmes migrate`: the same role setup and migrate run against a real database.
- `pnpm check`: the gate before the work is handed over.

## Writing a test

1. Name the file `*.int.test.ts`. Only the integration project runs the global setups.
2. Call `const db = useTestDatabase()` in the body of a `describe`, outside any hook. It registers the `beforeAll` that creates the file's database and the `afterAll` that drops it.
3. Isolate each test in scopes of its own: `const plant = given.plant()`. The id is a fresh uuidv7 and no row exists for it.
4. Write fixtures with `db.command({ principal, scopes: [plant], reason }, async (tx) => ...)`. It runs `fn` in one transaction as `nm_app`, with `northmes.read_scopes` and `northmes.write_scopes` both set to the scopes, and commits.
5. Read through the same path: `db.command` with the scopes of the rows you expect, so the policies apply as they do in the server. Use `db.ownerUrl` only for tests at the database seam, such as migrate. A test of migrate itself calls `useTestDatabase({ template: emptyTemplateDatabase })`, so its database holds only what the test applies.
6. For a test through the host app, call `createTestApp({ modules: ['core', 'planning'], hostFactory, database: db })` with `hostFactory` from `@northmes/server/testing`, and close `testApp.app` in `afterEach` or `afterAll`, before `useTestDatabase` drops the database. `database` points the app's `nm_app` pool at the file's database. It takes in-repo modules only; a test of a built plugin uses `bootBuilt` (ADR 0037). A test that builds a Nest app of its own imports `await configForTest({ KEY: 'value' })`, which never reads or writes `process.env`; its second argument holds the secret values by name, such as `NORTHMES_DB_APP_PASSWORD`, in place of the files the server reads.
7. To query the host app through the gateway, call `await testApp.app.listen(0, '127.0.0.1')` and send with `gqlClient(await testApp.app.getUrl(), { headers: { 'x-northmes-plant': plant } })`. The app builds a subgraph from the server entry of each module it boots, and a request reads at the plant its header names, as a tracer principal with every permission, until sign-in arrives (E05).
8. To count what a request costs in SQL, wrap it in `statementsDuring(testApp.app, () => client.send(query))` from `@northmes/server/testing`. It returns `{ result, statements }`, where `statements` holds the SQL text of every statement the app's `nm_app` pool sent while the request ran, so a test can show that a list reads the rows it references in one query.
9. For server-wide state (the database roles, a server setting, the server log) or code that needs the superuser, start a server of the file's own: `server = await startPostgres({ settings: { log_statement: 'all' } })` in `beforeAll`, `await server.stop()` in `afterAll`. `server.connection` logs in as that server's superuser. `server.logs()` returns the log so far, which lags: run a probe statement and wait for it with `vi.waitFor` before checking what the log lacks.
10. Make a new table with `pnpm gen:migration` and keep its four policies, one per command. Add the table's own columns after `version`. A table that other modules may point at by foreign key also gets `grant references (id) on <schema>.<table> to nm_ext` (ADR 0006). migrate gives `nm_ext` USAGE on every module schema, so that grant alone decides whether a key may point at the table.
11. Start each test name with the story id, such as `E02-S02`.

## Errors and their meaning

### Migrate and boot

- `refused to start (N problems)` with `Module planning depends on "core", which is not installed`: a BootError from the catalog check. With `createTestApp`, name every module that the listed ones depend on. The same check reports `Core module <id> must not depend on plugin <id>` and `Module dependency cycle: a -> b -> a`.
- `invalid configuration (N problems)`: a ConfigError. Each line names a key and its rule, never the value. `configForTest` throws it for a bad override, and boot, `pnpm northmes migrate` and `pnpm northmes db bootstrap` exit 1 with it. A secret file line says the file must exist, be a regular file, be readable by this process, not be empty, or not be readable by others.
- `permission denied for schema <schema>` (42501) while migrate applies a file: the file touches a schema its module does not own, such as another module's or `public`. Each file runs under `SET LOCAL ROLE` of its module's owner role, `nm_mod_<module>`, which holds rights in its own schema only. Move the change into the migrations of the module that owns the schema.
- `permission denied for table <table>` (42501) while migrate applies a file with a foreign key into another module's table: that module has not granted `references (id)` on the table to `nm_ext`. Store the id without a foreign key, or add the grant in the migrations of the module that owns the table.
- An SQL error from a file, such as `syntax error at or near "tabel"`: the file's transaction rolls back together with its row in `northmes_meta.migration`, so the file stays pending and the next run applies it again. Files that ran before it stay applied.
- `canceling statement due to lock timeout` (55P03): another migrate run held the migration advisory lock of the database for more than a minute.
- `pnpm gen:migration` exits 1 with `Usage: pnpm gen:migration <module> <slug>`, `No module folder modules/<module>` or `Invalid slug "<slug>"` and writes nothing. It also refuses to replace a file that exists (`EEXIST`).

### Row-level security and grants

- A select returns no rows, or an update or delete changes none, with no error: the transaction set no scopes, or scopes that hold none of the rows. Policies filter rows silently.
- A query through `gqlClient` answers `null` or an empty list with no error: the request named no plant in `x-northmes-plant`, or a plant that holds none of the rows.
- `new row violates row-level security policy for table "<table>"` (42501): an insert or update as `nm_app` wrote a `scope_id` outside `northmes.write_scopes`, or the transaction set no scopes, as a raw insert outside `db.command` does.
- `invalid input syntax for type uuid: "<value>"` (22P02): a scope passed to `db.command` is not a uuid. Use `given.plant()`.
- `permission denied for table <table>` (42501) as `nm_app`: the role holds no grant for that command on the table. A generated migration grants SELECT, INSERT, UPDATE and DELETE. TRUNCATE always gives this error, because `nm_app` never gets TRUNCATE.
- `permission denied for schema <schema>` (42501) as `nm_app`: the role has no USAGE on the schema. migrate grants it on every module schema; a schema that a test creates itself needs `grant usage on schema <schema> to nm_app`.
- `permission denied for schema <module>` (42501) as `nm_owner`: `nm_owner` inherits none of the rights of the module roles. To write rows as the table's owner, which bypasses the policies, run `set local role nm_mod_<module>` inside a transaction as `nm_owner`.
- `permission denied to set role "nm_mod_<module>"` (42501): only `nm_owner` may switch to a module role.

### Harness

- `connect ECONNREFUSED 127.0.0.1:1`: the app's pool reached for the database, but `createTestApp` got no `database`. Pass `database: db`.
- Status 503 with `The GraphQL gateway is not ready.` from `gqlClient`: none of the modules that `createTestApp` boots has a server entry in its manifest, so the gateway has no supergraph to serve.
- `useTestDatabase() needs the global setups of @northmes/testing and apps/server`: the file is not a `*.int.test.ts`. `bootBuilt()` says the same about its global setup.
- `terminating connection due to administrator command`: a client was still connected when `afterAll` dropped the file's database. Close every client the test opens.
