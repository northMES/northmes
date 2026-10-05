---
status: "proposed"
date: 2026-10-05
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: internal research notes 06, 16, 20, 32 and 33
informed: product owner, module and plugin authors
release: "1"
needs-confirmation: "product owner (case-insensitive codes, archived codes, level of operation tools)"
---

# Code uniqueness per scope with an exclusion constraint

## Context and problem statement

Master data rows sit at company level or at plant level, as each entity type declares ([ADR 0007](0007-tenancy-company-plants-and-the-scope-tree.md)), and Krister Johansson decided that codes are unique per scope. Two plants may both have tool `T-100`. A plant row may not use a code that a company row of the same type uses, and a plant reads both its own rows and the company's rows. The same holds the other way: a company row may not take a code that any plant already uses, and a plant row may not move to company level while another plant holds its code.

The earlier design enforced this with a trigger and `pg_advisory_xact_lock`. That works only when every write path takes the same lock, and under row-level security ([ADR 0008](0008-row-level-security-with-transaction-local-scopes.md)) a company insert cannot see plant B's rows, so the trigger would need `SECURITY DEFINER` to find the clash.

A second rule shares the same mechanism: a row may reference a row at its own scope or at an ancestor scope, never at a sibling or a descendant. A plant A job order must not point at plant B's equipment, and a company row must not point at a plant row.

This ADR covers every register built with the master-data kit ([ADR 0022](0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md)), every table with a code in a module or plugin schema, `core.scope`, and the four tables that can hold references across scope levels.

## Decision drivers

* The rule must hold for concurrent inserts from any write path, plugins and imports included.
* No row-level security bypass and no definer function in the write path.
* A clash must not reveal another plant's row to a user who cannot read it.
* The rule must cover the move of a plant row to company level.
* Registers get the rule from the migration template, so no author writes it by hand.
* Code lookups stay index-backed under row-level security.
* Areas and lines can join the scope tree later below plants.

## Considered options

* An exclusion constraint over integer scope spans with `btree_gist`
* A trigger with `pg_advisory_xact_lock` that checks for clashes
* A check in application code before the insert
* A unique index on `(company_id, code_key)`, which makes codes unique per company

## Decision outcome

Chosen option: "An exclusion constraint over integer scope spans with `btree_gist`", because it expresses all three clash rules declaratively, serializes concurrent inserts without a lock or a trigger, and needs no row-level security bypass.

Every scope node has an `int8range` span in `core.scope.span`. The company's span is unbounded, `(,)`. Plant number k gets `[k << 32, (k + 1) << 32)`, which leaves room for areas and lines inside a plant. The company span overlaps every plant span, and sibling plants never overlap, so two rows clash exactly when their codes match and their spans overlap. `core.scope` has `unique (id, company_id, span)`.

A table with a code carries the span next to its scope:

```sql
create table core.equipment_group (
  id         uuid primary key default uuidv7(),
  company_id uuid not null,
  scope_id   uuid not null,
  scope_span int8range not null,
  code       text not null check (code = btrim(code) and length(code) between 1 and 32),
  code_key   text generated always as (lower(code)) stored,
  -- fields, version, archived_at, provenance
  foreign key (scope_id, company_id, scope_span)
    references core.scope (id, company_id, span) on update cascade,
  constraint equipment_group_code_excl
    exclude using gist (company_id with =, code_key with =, scope_span with &&)
);
create index equipment_group_scope_code_idx on core.equipment_group (scope_id, code_key);
```

* The composite foreign key rejects a span that does not belong to the row's scope.
* `code_key` is `STORED`. Postgres 18 makes generated columns virtual by default and cannot index a virtual column, and `lower(code)` in a filter loses its index under row-level security, because `lower` is not leakproof.
* The master-data kit's migration scaffold writes the columns, the constraint and the index inline into the module's SQL file. `btree_gist` is a trusted extension, so the migrate login creates it without a superuser.
* SQLSTATE 23P01 on a code constraint, and 23505 on a code key, map to `core.code_taken` ([ADR 0012](0012-commands-as-the-single-write-path.md)). Under row-level security Postgres reports only "Key conflicts with existing key.", so the message names no plant and no row.
* Postgres 18 also accepts `unique (company_id, code_key, scope_span without overlaps)`. The template keeps the explicit `exclude` form, which the tests below cover.

Working defaults until the product owner answers:

* Codes compare case-insensitively through `code_key`.
* An archived row keeps its code, so the constraint covers archived rows.
* Areas and lines follow the same rule: ancestors and descendants clash, siblings do not.

References across scope levels:

* The SDK reference resolver checks in the command pipeline that every referenced row's scope equals the referencing row's scope or one of its ancestors. This also covers the connector and agent paths, where the request scope can be wider than the row.
* Four tables also get a declarative check: operation tools, operation equipment, job order equipment and production order demand. Each adds a `ref_span` column, a composite foreign key `(ref_id, ref_span)` with `ON UPDATE CASCADE`, and `CHECK (scope_span <@ ref_span)`. The owner of the referenced table adds `unique (id, scope_span)` and grants references on it to `nm_ext`.
* SQLSTATE 23514 on these constraints maps to `core.crossScopeReference`.
* A child production order is always created in its parent's plant.
* Whether operation tools are company-level or plant-level is open for the product owner. A company operation-tool row that points at one plant's tool would give another plant's autoplan a duration without the tool override, so the declarative check applies to that table either way.

### Consequences

* Good, because two concurrent inserts serialize on the constraint: the second waits for the first and then fails. No advisory lock is involved.
* Good, because the move of a plant row to company level is refused while another plant holds the code, with no extra code path.
* Good, because plugin registers get the same rule from the template, and the catalog lint checks it.
* Bad, because every register row repeats its scope span, and the composite foreign key with `ON UPDATE CASCADE` must keep it in step with `core.scope`.
* Bad, because the constraint check bypasses row-level security, so a company user learns that some plant already holds a code, without learning which plant or which row.
* Bad, because a GiST exclusion constraint costs more per insert than a plain unique index; the difference was not measured and does not matter at master-data volumes.
* Neutral, because the case and archive defaults change one generated column and the constraint's scope, not the mechanism.

### Confirmation

* Integration test `code-uniqueness.int.test.ts` on `core.equipment_group`, as `nm_app`:
  * Plants A and B both create `T-100`.
  * A company `t-100` is rejected while a plant holds `T-100` (case-insensitive default).
  * A plant `C-1` is rejected when the company has `C-1`.
  * Moving plant A's `T-100` to company level is rejected while plant B has `T-100`.
  * A row whose span does not match its scope is rejected by the composite foreign key.
  * With two sessions, the company insert waits for the uncommitted plant insert and then fails.
  * The GraphQL error is `core.code_taken`, and its message contains no plant name, code or id from the other plant.
* Insert matrix `cross-scope-reference.int.test.ts` on the four reference tables: company row to plant row fails with 23514; plant to sibling plant fails; plant to the same plant passes; plant to company passes; moving a company tool to plant A while plant B references it fails; moving a job order onto another plant's equipment returns `core.crossScopeReference`; creating a child production order at plant B for a parent at plant A returns `core.crossScopeReference`.
* The catalog lint fails a register table without `scope_span`, without the code exclusion constraint or with a virtual `code_key`, and fails any index on a virtual generated column.
* The master-data kit contract test runs once per register and covers the clash cases above.

## Pros and cons of the options

### Exclusion constraint over scope spans

* Good, because one declarative constraint covers plant against company, company against plant and the move to company (tested on Postgres 18.4).
* Good, because it needs no trigger, no lock and no definer function.
* Bad, because it needs the `btree_gist` extension and a span column on every register.

### Trigger with an advisory lock

* Good, because it needs no span column.
* Bad, because it holds only when every write path takes the same lock.
* Bad, because the trigger must run as `SECURITY DEFINER` to see other plants' rows under row-level security, which adds a reviewed bypass to every write.

### Check in application code

* Good, because the error message can name the clash in domain terms.
* Bad, because a read before the insert races with a concurrent insert, and under row-level security the read cannot see other plants' rows.

### Unique index per company

* Good, because a plain btree unique index is the simplest constraint.
* Bad, because it forbids two plants from using the same code, which contradicts the decision that codes are unique per scope.

## More information

* Related ADRs: [0007](0007-tenancy-company-plants-and-the-scope-tree.md) (where rows live), [0008](0008-row-level-security-with-transaction-local-scopes.md), [0012](0012-commands-as-the-single-write-path.md) (error mapping), [0022](0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md) (master-data kit and migration scaffold), [0006](0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md) (roles and `nm_ext` grants).
* Plan: [04 data and platform, code uniqueness per scope](../plan/04-data-and-platform.md#code-uniqueness-per-scope), [07 production planning](../plan/07-production-planning.md), [16 open questions](../plan/16-open-questions.md).
* Postgres exclusion constraints: https://www.postgresql.org/docs/18/sql-createtable.html and the `btree_gist` module: https://www.postgresql.org/docs/18/btree-gist.html.
* Revisit when the product owner answers the three working defaults, and when areas or lines join the scope tree.
