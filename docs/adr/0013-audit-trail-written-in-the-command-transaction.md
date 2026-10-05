---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: internal research notes 01, 04, 06, 10, 12, 22, 23, 24 and 32
informed: product owner, module and plugin authors, the lawyer reviewing retention
release: "1"
needs-confirmation: "maintainer (lifecycle classes; tool results as exports); lawyer (retention, erasure)"
---

# Audit trail written in the command transaction

## Context and problem statement

Krister Johansson decided that NorthMES audits every change, every security event and every export; that reads and page views are not audited; and that audit is a core module written in the same transaction as the change, not a separate service fed by events. Writes come from the web, the station, the connector, jobs, the CLI, MCP and the in-app assistant, and plugins run in the same process with the same database role. A regulated customer later asks for old and new values, the person and role behind each change, a reason where required, and a trail no user can edit ([ADR 0051](0051-regulated-readiness-no-regret-rules.md)).

This ADR decides how the trail is written and protected, which tables get which treatment, how principals (including the agent) appear in it, how security events are written, who may read it, and the groundwork for retention and personal data. It covers the `audit` schema, `audit.begin_command`, the capture trigger, the catalog checks at migrate and boot, the manifest's audit declarations, `core.system_principal` and the History and audit screens.

## Decision drivers

* A change and its audit record commit together, so the trail has no gaps and no lag.
* Capture must not depend on module or plugin authors remembering to call it.
* The runtime role and in-process plugins must not be able to alter or drop audit data.
* Command rows record who, acting for whom, with which credential and roles, through which surface, at which scope, and why.
* Bulk planning writes stay cheap enough: a 500-row autoplan apply costs about 18 ms extra (measured on Postgres 18).
* A missing partition must be caught months before it stops writes.
* Personal data is stored as ids, so a later erasure request can be met by pseudonymization.

## Considered options

* A core audit module written in the command transaction: one command row per transaction plus field diffs captured by a trigger
* A separate audit service fed by outbox events
* Field diffs computed in application code, without a trigger
* Database-level logging with pgaudit or logical decoding

## Decision outcome

Chosen option: "A core audit module written in the command transaction", because it is the only option that is atomic with the change, captures every write to an audited table whatever code made it, and still records the intent (command, principal, reason) that a trigger alone cannot know.

Write path:

* `audit.begin_command(...)` is `SECURITY DEFINER` with a pinned `search_path`. The pipeline calls it once per transaction ([ADR 0012](0012-commands-as-the-single-write-path.md)); a second call fails. It sets the transaction-local audit id and inserts one `audit.command` row: principal and principal type (`user`, `system`, `station`, `agent`), `acting_for`, credential, surface (`web`, `mcp`, `assistant`, `station`, `connector`, `job`, `cli`, `sql`), the target entity's scope, the roles held at that scope, command, entity, reason, proposal id, correlation and causation ids, input digest, NorthMES version, image digest and configuration revision.
* The generic `AFTER` row trigger `audit.capture_row` on every module and plugin table writes `audit.change` rows with field diffs (`U`: `{column: [old, new]}`, `I`: new values, `D`: old values). It raises when no audit context is open. The context is valid only when a command row exists with that id, `occurred_at = now()` and `tx = pg_current_xact_id()`, so a forged or replayed id fails (about 6 microseconds per row).
* No-op updates write nothing; `updated_at`, `updated_by` and `version` are skipped by default. The capture functions declare `set timezone = 'UTC'`.
* Rows hold ids, never names. Manifests declare secret fields (written as "redacted"), redact fields (the diff records that they changed, not the value), personal fields and free-text fields.
* `nm_app` has no write grant on audit tables. `UPDATE`, `DELETE` and `TRUNCATE` are blocked by triggers set `ENABLE ALWAYS`. The audit schema is owned by the audit module's NOLOGIN role, and the owner password never reaches the app container ([ADR 0047](0047-secrets-and-the-installation-key.md)).

Partitions: `audit.command`, `audit.change` and `audit.security_event` have monthly partitions with bounds written as explicit UTC values and no default partition. `audit.ensure_partitions(months_ahead int)` is `SECURITY DEFINER`, owned by the audit owner role, with a pinned `search_path`, on the definer allowlist and idempotent under a transaction advisory lock. `northmes migrate` calls it on every run, a monthly cron calls it, and install creates 24 months ahead. Each partition it creates gets row-level security enabled, the parent's policies and no grants of its own, so rows are reached only through the parent ([ADR 0008](0008-row-level-security-with-transaction-local-scopes.md)). Health reports degraded below 3 months ahead and readiness fails below 1 month ([ADR 0043](0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md)).

Checks at the end of `northmes migrate` and at boot: every table in every installed module and plugin schema has the capture trigger set `ENABLE ALWAYS`, or an allowlist entry with a reason; each trigger's arguments match the manifest's skip and redact declarations; every audited table has a uuid `id` column; command-only and allowlisted tables have a statement-level `audit.require_context()` trigger. Classification fails closed: a `bytea` column, or a column whose name contains `secret`, `ciphertext`, `password`, `token` or `key`, must be declared secret or allowed with a reason. Offenders are listed in one message. A grep lint fails on the setting name `northmes.audit_id` outside the audit module.

Each manifest declares a lifecycle class per table:

| Class | Examples | Treatment |
|---|---|---|
| `record` | production orders, job orders, master data | full field diffs; archive replaces delete; `DELETE` and `TRUNCATE` revoked from `nm_app` |
| `working` | planner drafts, soft locks | command row only plus the context guard; hard delete allowed |
| `operational` | connector run log, echo and write-back state, raw payloads, import inbox | command row only |
| `reference` | stock snapshot | command row only |

The History tab reads only record tables. Working default until the maintainer confirms: job orders are record class whether or not they carry reports, so autoplan never deletes or recreates them.

Principals:

* `core.system_principal(id, module_id, key, display_name)` is seeded by migration per connector and per system job. Only job names a manifest registers as system jobs run as the system principal.
* Each Pyramid poll opens a run command (surface `connector`, `detail` with the payload hash and counts). Each changed order's transaction opens its own command with `correlation_id` set to the run id and `causation_id` set to the run command id. Unchanged orders and runs write no order commands.
* The agent principal: principal type `agent` and surface `assistant` exist from the first audit migration, before partitions hold data. The in-app assistant is a fixed system principal per feature (`planning.assistant`) with `acting_for` the user, `credential_id` the session credential and `client { feature, aiRunId, providerConfigId, model }`. MCP calls run as the user, with the personal access token as credential and surface `mcp`.
* A command with surface `sql` requires an active support user and a reason.

What is audited: changes, security events and exports. Read tools from MCP and the assistant run in `SET TRANSACTION READ ONLY` with no audit context; only a tool with the effect `proposal` opens one and writes exactly one command. Assistant reads appear in `ai.ai_call` (tool names, plant, row counts) and MCP reads in the structured log with the correlation id. Working default until the maintainer decides: tool results sent to a model are not exports; if they are, one `ai.toolResultsSent` command per run is written.

Security events: `audit.record_security_events(events jsonb)`, `SECURITY DEFINER` with a pinned `search_path`, runs on a separate pool connection after the business transaction ends, so a rollback keeps the event. A request-scoped denial collector writes one row per `(permission, scope)` with `detail.count`. Kinds include sign-in, failed sign-in, sign-out, `permission.denied`, station sign-in and sign-out, lockouts and restores. IP addresses and user agents are stored on security events only. Every security event is also a JSON log line `{type: 'security_event', kind, principal, scope, correlationId}`.

Reading and exports: audit tables use the split policy shape of [ADR 0008](0008-row-level-security-with-transaction-local-scopes.md). A command row is visible when its scope is readable or a visible change row shares its command id; role-assignment commands sit at the assignment's scope; History diffs are filtered by field permissions. `core.audit:read` grants the admin audit list at a scope. An export is a command whose `detail` holds filters, row count and format version, written before streaming. The format is JSON Lines plus a manifest with field labels, an id-to-label dictionary and plant zones; instants carry their UTC offset and the plant's IANA zone. A migration that renames an audited column records the mapping.

Configuration revision: the installed catalog (module ids, versions, manifest hashes, supergraph hash) is folded into the configuration revision, and one boot command is written only when the catalog changes. The build identity sits in OCI labels and `/app/build.json`.

Retention and personal data: security event partitions are dropped after a default period held in an audited settings row, through a definer drop function. `ai.ai_call` has monthly partitions with a 13-month default. Command and change rows have no limit by default; the customer may set one. The lawyer confirms the periods. Erasure means pseudonymization: a later `core.pseudonymizeUser` command, built when the first erasure request arrives, updates `auth.user`, deletes accounts and sessions, revokes credentials, ends role and badge assignments and writes `user.pseudonymized`. The `auth` schema has no capture trigger, so old names never enter the trail. Each pseudonymization is also a log line kept outside the database, and the restore runbook replays erasures newer than the restore point ([ADR 0045](0045-backups-restore-drills-upgrades-and-rollback.md)). Raw ERP payloads, the import inbox and run logs are command-only, and a background erasure search scans diffs and reasons. Manifests declare personal-data fields, and the docs generate a register of what NorthMES stores and why. Seals over per-field digests, `audit.redact` and an `audit.redaction` table come later; redaction will be allowed with a reason in the standard profile and refused in a regulated one.

Seeds and test fixtures write through `db.command({ principal, scopes, reason }, fn)` from `@northmes/testing` with surface `cli`. The trigger's error names the fix: "in tests use db.command(...), in code use the command pipeline".

### Consequences

* Good, because the History tab shows a save as soon as it commits, and a write that bypasses the pipeline fails instead of escaping the trail.
* Good, because the runtime role and in-process plugins can neither edit nor drop audit rows or partitions.
* Bad, because each changed row costs about 25 to 37 microseconds in the trigger; later high-volume data collection must stay off it.
* Bad, because fail-closed contexts break untested paths (a job, a seed, a plugin); every job and the connector run against a migrated database with triggers on.
* Bad, because a superuser or the audit owner can still alter the trail until seals exist.
* Bad, because an append-only trail and erasure requests pull against each other; ids, pseudonymization and command-only payload tables limit the conflict, and the lawyer confirms the rest.
* Neutral, because old diffs keep old column names; the export manifest maps renames.

### Confirmation

* Context tests as `nm_app`: `set_config` of a random uuid followed by an insert raises "write to ... without audit context"; reusing a committed command id in a new transaction raises the same; insert, update, delete and truncate on audit tables fail; `SET ROLE` to the audit owner fails; `DROP TABLE` of an audit partition fails with "must be owner".
* Partition tests: `select audit.ensure_partitions(12)` as `nm_app` creates future partitions on all three tables, each with row-level security enabled and no grants, and is a no-op when run twice; with a fixed clock and partitions up to month M, `/health/ready` degrades at M minus 3 and fails at M minus 1; partition maintenance under `SET LOCAL TimeZone = 'Europe/Stockholm'`, then inserts at `2026-10-31T23:30Z` and `2026-11-01T00:30Z`, both succeed.
* Migrate and boot checks: a fixture plugin whose second migration disables its trigger makes `northmes migrate` exit 1 naming the table; an undeclared `secret_ciphertext` column makes it exit 1 naming the column.
* Lifecycle test: an autoplan of 500 rows into a draft followed by a commit writes exactly 500 change rows for the job order table, none for draft and lock tables, and two command rows.
* Connector test: a poll of 50 orders with 3 changed writes one run command and three order commands that share the correlation id.
* Agent tests: a mocked run that calls `planning_propose_changes` writes exactly one command with principal type `agent`, surface `assistant` and `acting_for` the user; a three-step read-only run writes no audit rows; an MCP read writes no command row; a read handler that attempts an insert fails with "cannot execute INSERT in a read-only transaction".
* Security events: a list of 500 rows with one forbidden field writes one `permission.denied` event with `detail.count` 500; a command that fails `can()` inside its transaction leaves no command row and one event; the log line validates against its JSON schema.
* Reading: a `core.audit:read` holder at plant A sees no row about plant B's assignments or denials.
* Export: `detail.rowCount` equals the line count, every instant carries an offset and a zone, and a plain JSON parser reads the file.
* Configuration: a boot without a previously installed plugin writes one command with `details.removed`; a second unchanged boot writes none.
* Personal data: no `audit.change` diff contains a badge HMAC; an insert into a command-only payload table writes no change row; a command with surface `sql` and a principal that is not a support user raises.

## Pros and cons of the options

### Core module in the command transaction

* Good, because the change and its record commit or roll back together.
* Good, because the trigger catches plugin and job writes without extra code.
* Bad, because the trigger adds per-row cost and needs the catalog checks to stay attached.

### Separate audit service fed by events

* Good, because writes pay nothing extra at commit.
* Bad, because the trail lags, and a dead-lettered audit job leaves a hole until someone notices.
* Bad, because events carry the state after the change, not old values, and writes that emit no event never reach it.

### Field diffs in application code

* Good, because the code knows intent and can compute diffs with `RETURNING OLD`.
* Bad, because writes outside the pipeline or the data helpers are invisible.

### pgaudit or logical decoding

* Good, because capture happens outside the application.
* Bad, because pgaudit sees database roles, not NorthMES users, logs statements rather than old and new values, and is not transactional.
* Bad, because logical decoding needs a replication slot and a consumer process on-prem, lags like the event-fed service, and still needs a trigger to carry application context.

## More information

* Related ADRs: [0008](0008-row-level-security-with-transaction-local-scopes.md), [0010](0010-identity-with-better-auth-roles-and-permissions-in-core-tables.md), [0011](0011-principals-credentials-and-same-origin-rules.md), [0012](0012-commands-as-the-single-write-path.md), [0014](0014-outbox-event-log-and-pg-boss-jobs.md) (shared correlation and causation ids), [0032](0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md), [0035](0035-ai-provider-port-with-customer-configured-providers.md), [0036](0036-agent-proposals-as-planning-records-a-person-commits.md), [0043](0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md), [0045](0045-backups-restore-drills-upgrades-and-rollback.md) (restore replays erasures), [0047](0047-secrets-and-the-installation-key.md), [0051](0051-regulated-readiness-no-regret-rules.md).
* Plan: [04 data and platform, audit trail](../plan/04-data-and-platform.md#audit-trail), [10 AI and agents](../plan/10-ai-and-agents.md), [12 operations and security](../plan/12-operations-and-security.md), [15 regulated readiness](../plan/15-regulated-readiness.md).
* 21 CFR 11.10: https://www.law.cornell.edu/cfr/text/21/11.10. EU GMP Annex 11 (2011): https://health.ec.europa.eu/system/files/2016-11/annex11_01-2011_en_0.pdf.
* Revisit when a regulated customer signs (seals, redaction, reason and signature requirements), when the first erasure request arrives, and before any high-volume data collection table is created.
