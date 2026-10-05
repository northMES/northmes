---
status: "proposed"
date: 2026-10-05
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: internal research notes 06, 15, 17, 20, 22, 30, 32, 33 and 37
informed: module and plugin authors, coding agents that write migrations
release: "1"
needs-confirmation: ""
---

# Row-level security with transaction-local scopes

## Context and problem statement

One NorthMES installation can hold several plants of one company. Every row in a module or plugin table belongs to one scope node, the company or one plant ([ADR 0007](0007-tenancy-company-plants-and-the-scope-tree.md)), and every request works on exactly one plant. All modules and in-process plugins reach Postgres through one runtime role, `nm_app` ([ADR 0006](0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md)). The command pipeline checks permissions, but one forgotten scope filter in a list query, a plugin repository or a report would show one plant's rows to a user of another plant.

This ADR decides how the database itself limits what a transaction reads and writes: the settings the SDK's transaction helper sets, the policy shape the migration template generates, the catalog checks that keep every table covered, and whether tables force row-level security. It covers every table in every module and plugin schema, the SDK transaction helper, the migration template and the catalog lint in `@northmes/testing`.

## Decision drivers

* Fail closed: a query that runs without scopes reads nothing and writes nothing.
* In-process plugins use the same `nm_app` role, so isolation cannot depend on every author writing the right filter.
* The write set must never widen what a transaction can read.
* A plant planner reads company master data but does not change it; a company role writes company rows and the active plant's rows.
* The Pyramid connector writes company rows and plant rows in one transaction.
* No session state may outlive a transaction, so the code stays safe behind PgBouncer in transaction mode ([ADR 0014](0014-outbox-event-log-and-pg-boss-jobs.md)).
* Data migrations that run as a module's owner role must see and change all rows.
* Indexes stay usable under the policies.

## Considered options

* Split policies per command type on transaction-local read and write scopes, without `FORCE ROW LEVEL SECURITY`
* One `FOR SELECT` policy on the read scopes plus one `FOR ALL` policy on the write scopes
* The split policies plus `FORCE ROW LEVEL SECURITY` on every table
* The split policies plus a scope value signed with an HMAC that the policies verify
* Scope filters in application code only, without row-level security

## Decision outcome

Chosen option: "Split policies per command type on transaction-local read and write scopes, without `FORCE ROW LEVEL SECURITY`", because it is the only tested shape that keeps the write set inside the read set, fails closed and leaves data migrations working.

The transaction helper sends one statement before any other:

```sql
select set_config('northmes.read_scopes',  $1, true),
       set_config('northmes.write_scopes', $2, true);
```

* `read_scopes` holds the company node and the request's plant. Jobs and the connector set scopes from the job's principal.
* `write_scopes` is `read_scopes` intersected with the scope nodes where the ancestor walk finds a role with any write permission ([ADR 0010](0010-identity-with-better-auth-roles-and-permissions-in-core-tables.md)). A company role yields `{company, active plant}`, a plant planner yields `{active plant}`, a viewer yields an empty set.
* `write_scopes` is never derived from a scope that a command declares in its manifest, because the connector writes company and plant rows in one transaction.
* `set_config` with bind parameters is used because `SET LOCAL` takes no parameters.

The migration template writes this shape inline into each module's SQL file:

```sql
alter table core.equipment_group enable row level security;
create policy scope_select on core.equipment_group for select to nm_app
  using (scope_id = any ((select nullif(current_setting('northmes.read_scopes', true), ''))::uuid[]));
create policy scope_insert on core.equipment_group for insert to nm_app
  with check (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));
create policy scope_update on core.equipment_group for update to nm_app
  using      (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]))
  with check (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));
create policy scope_delete on core.equipment_group for delete to nm_app
  using (scope_id = any ((select nullif(current_setting('northmes.write_scopes', true), ''))::uuid[]));
```

Rules that go with the shape:

* Never `FOR ALL`. A `FOR ALL` policy also applies to `SELECT`, and permissive policies are OR-ed, so rows in the write set would become readable whatever the read set says. With the split shape an `UPDATE` also needs the `SELECT` policy, so a row outside the read set is never updated.
* `nullif(..., '')` is required: after a transaction that set the variable commits, `current_setting(..., true)` returns an empty string on that pooled connection, not NULL.
* The `uuid[]` cast sits outside the scalar subquery. Inside it, Postgres reads `any (subquery)` and fails with `operator does not exist: uuid = uuid[]`.
* The scalar subquery runs once per statement (an InitPlan), so the `scope_id` index stays usable. Every scoped table has an index that leads with `scope_id`.
* Only leakproof functions in a filter run before the policy. `lower()`, `LIKE`, `ILIKE`, enum equality and the jsonb and array containment operators are not leakproof, so normalized search keys are `STORED` generated columns with plain indexes ([ADR 0009](0009-code-uniqueness-per-scope-with-an-exclusion-constraint.md)) and status columns are `text` with a `CHECK`, not Postgres enums.
* Child tables carry `scope_id` copied from their parent row.
* Partitioned tables: the policies sit on the partitioned parent, and every partition also gets `ENABLE ROW LEVEL SECURITY` and the parent's policies in the transaction that creates it. Postgres carries neither over: `ENABLE ROW LEVEL SECURITY` on a parent leaves `relrowsecurity` false on its partitions (tested on Postgres 18.6, internal research note 37). A query that names the parent applies the parent's policies to rows from every partition, and a query that names a partition applies only that partition's own policies, so a partition without them leaks rows to any role that can name it. No partition grants a privilege to `nm_app` or to a BI login role; access goes through the parent, and inserts through the parent need no grant on the partition. When partitions live in a schema of their own, that schema grants those roles no `USAGE`. The audit partitions follow this rule ([ADR 0013](0013-audit-trail-written-in-the-command-transaction.md)), and so do later time-series tables ([ADR 0059](0059-time-series-storage-port-with-an-open-default-backend.md)).
* The table owner is the module's NOLOGIN role `nm_mod_<sql name>`. Release 1 sets `ENABLE` and not `FORCE`, so the owner bypasses the policies and data migrations work. Only the `migrate` login may `SET ROLE` to an owner role, and the owner password never reaches the app container ([ADR 0047](0047-secrets-and-the-installation-key.md)).
* Row-level security is the second line. The command pipeline first checks `can(principal, permission, scope)` at the row's scope ([ADR 0012](0012-commands-as-the-single-write-path.md)).
* Row-level security is not a boundary against SQL injection: SQL that runs as `nm_app` can call `set_config` and widen its own scopes. A lint rejects `sql.raw`, `sql.lit`, and `sql.ref` or `sql.id` with non-literal input. No signed scope value is built.
* Tables outside module schemas (pg-boss tables, Better Auth's `auth` schema) carry no policies. Inside module schemas, a table without policies needs an allowlist entry with a reason; `core.event` and `core.inbox` are settled in [ADR 0014](0014-outbox-event-log-and-pg-boss-jobs.md). The audit tables use the same split shape ([ADR 0013](0013-audit-trail-written-in-the-command-transaction.md)).

The catalog lint runs as an integration test from `@northmes/testing` against a migrated database, and the same checks run at the end of `northmes migrate` and at boot. It fails when a `pg_policies` row in a module or plugin schema has `cmd = 'ALL'`; when a table lacks `relrowsecurity` or has no policy and has no allowlist entry with a reason; when a table is not owned by its module's owner role; when a view lacks `security_invoker = true` and is not allowlisted; when a `SECURITY DEFINER` function is not on the definer allowlist or has no pinned `search_path`; and when `nm_app` owns anything or has `BYPASSRLS`. The lint covers partitioned parents (`relkind = 'p'`) and partitions (`relispartition`) as well as plain tables. For partitions it also fails when a partition lacks `relrowsecurity`, when its policies differ from its parent's in name, command, roles or expressions, when it grants any privilege to `nm_app` or a BI login role, and when a schema that holds partitions grants those roles `USAGE`. The lint checks `relrowsecurity` only and never requires `relforcerowsecurity`. Earlier drafts of the definition of done, the catalog test and the master-data migration scaffold said "enabled and forced" and an owner of `nm_owner`; they follow this ADR.

### Consequences

* Good, because code that forgets the transaction helper reads zero rows and every insert fails.
* Good, because a plugin table without `scope_id` or without policies fails the lint in CI, at migrate and at boot.
* Good, because the settings are transaction-local and hold no session state.
* Bad, because every scoped query pays for policy evaluation, and functions that are not leakproof lose index use; search keys and statuses follow the column rules above.
* Bad, because foreign-key, unique and exclusion checks bypass row-level security by design, so their error messages must hide the conflicting key.
* Bad, because the owner role bypasses the policies; that protection rests on the owner password staying in the `migrate` container.
* Bad, because SQL injection as `nm_app` could widen its scopes; the raw SQL lint is the defence, not row-level security.
* Neutral, because materialized views do not apply row-level security. Time-series data from later modules uses plain partitioned tables under the partition rule above, with policies through a series registry ([ADR 0059](0059-time-series-storage-port-with-an-open-default-backend.md), proposed), so it needs no separate filter scheme.

### Confirmation

* `packages/testing` integration test `rls-isolation.int.test.ts`, connected as `nm_app` with rows at plant A and plant B:
  * A viewer at A who holds an operator role at B, with request plant A, reads B's job order by id and gets `null`; the list returns only A rows.
  * A planner at A who holds an operator role at B moves B's job order: `NOT_FOUND`, and the row keeps its equipment and version.
  * Table-driven over a company planner, a planner with roles at A and B, and a planner with a role only at B, all with request plant B: no A `scope_id` appears in any list, updating a tool at A is refused with the row unchanged, and moving a B job order succeeds for the first two.
  * A transaction opened without the helper returns zero rows and its insert fails.
* Unit test of the write-set function: a company role yields `{company, plant}`, a plant planner `{plant}`, a viewer `{}`.
* Catalog lint `catalog.int.test.ts`: a fixture migration that creates a `FOR ALL` policy fails and names the table; a plugin table without `scope_id` and without an allowlist entry fails; a view without `security_invoker`, a definer function without a pinned `search_path` and an `nm_app` with `BYPASSRLS` each fail. For a partitioned fixture table whose parent has the template's policies, a new partition without row-level security fails and names the partition, a partition missing one of the parent's policies fails, and a partition that grants `SELECT` to `nm_app` fails.
* `northmes migrate` and boot exit 1 and list every offender when the catalog checks fail.
* A harness test asserts that integration tests connect as `nm_app` and that `nm_app` has `rolbypassrls = false`, because the container's default user is a superuser and would pass every isolation test falsely.
* The raw SQL lint in the gate command fails on `sql.raw`, `sql.lit`, and `sql.ref` or `sql.id` with a non-literal argument.
* Review checklist item: a new table has row-level security with the template's policies, or an allowlist entry with a reason.

## Pros and cons of the options

### Split policies on transaction-local scopes, without FORCE

* Good, because the write set stays inside the read set: with this shape, an `UPDATE` of a row outside the read set affects 0 rows (tested on Postgres 18.4).
* Good, because a transaction without scopes reads nothing and writes nothing.
* Good, because data migrations running as the owner role see every row.
* Bad, because each table gets four policies instead of two; the template writes them and the lint checks them.

### One FOR SELECT policy plus one FOR ALL policy

* Good, because each table needs only two policies, and the shape was the first one tested for reads.
* Bad, because it leaks: on Postgres 18.4 a viewer at plant A with a write role at plant B read B's rows under a plant A request, and a planner at A with a role at B updated a B row under header A (`UPDATE 1`).

### Split policies plus FORCE ROW LEVEL SECURITY

* Good, because the owner role would also be bound by the policies.
* Neutral, because it changes nothing for `nm_app`, which owns no table.
* Bad, because data migrations running as the owner role would see zero rows unless every backfill set scopes first.

### Split policies plus an HMAC-signed scope

* Good, because SQL running as `nm_app` could not widen its scope with `set_config`.
* Bad, because it adds key handling and a verification call to every policy evaluation, for a threat that the raw SQL lint and parameterized Kysely queries address at the source.

### Scope filters in application code only

* Good, because queries carry no policy cost and plans are fully under the author's control.
* Bad, because one missing filter in any module or plugin leaks another plant's rows, and nothing fails closed.

## More information

* Related ADRs: [0006](0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md) (roles and grants), [0007](0007-tenancy-company-plants-and-the-scope-tree.md) (scope tree, one plant per request), [0009](0009-code-uniqueness-per-scope-with-an-exclusion-constraint.md), [0010](0010-identity-with-better-auth-roles-and-permissions-in-core-tables.md), [0012](0012-commands-as-the-single-write-path.md), [0013](0013-audit-trail-written-in-the-command-transaction.md), [0014](0014-outbox-event-log-and-pg-boss-jobs.md), [0041](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md), [0047](0047-secrets-and-the-installation-key.md), [0059](0059-time-series-storage-port-with-an-open-default-backend.md) (time-series partitions).
* Plan: [04 data and platform, row-level security](../plan/04-data-and-platform.md#row-level-security) and [11 quality and testing](../plan/11-quality-and-testing.md).
* Postgres row security: https://www.postgresql.org/docs/18/ddl-rowsecurity.html. The InitPlan pattern follows https://supabase.com/docs/guides/database/postgres/row-level-security.
* Revisit `FORCE` when the migration runner gives data migrations a scope context. Revisit the write-set rule when company mode (several plants in one request) arrives.
