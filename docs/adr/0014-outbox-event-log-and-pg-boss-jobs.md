---
status: "accepted"
date: 2026-10-08
decision-makers: Krister Johansson
consulted: internal research notes 06, 07, 15, 20, 22 and 32
informed: module and plugin authors, pilot IT
release: "1"
needs-confirmation: ""
---

# Outbox, event log and pg-boss jobs

## Context and problem statement

Modules need side effects after a commit: Pyramid write-back after a planner saves, live board updates for other planners, an availability refresh after a calendar change, closing the sockets of a revoked credential. They also need scheduled and singleton jobs: the Pyramid poll, the audit partition cron, retention, and one autoplan run per plant. Three properties are hard. An event must exist exactly when its command commits. A reader that pages by an id or identity value assigned at insert skips a transaction that commits late. And a transaction that runs `NOTIFY` takes a global lock at commit, which serializes busy writers.

The pilot runs one host with Docker Compose and no extra broker, and release 1 uses plain Postgres 18 with no TimescaleDB feature ([ADR 0005](0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md)). This ADR decides the event table, how positions are assigned, how consumers and subscriptions read events, the job queue, the rules that keep the code safe behind PgBouncer, and the release 1 event catalog. It covers `core.event`, `core.event_sequencer`, `core.inbox`, `@northmes/sdk/jobs` and the event contracts in module contracts packages.

## Decision drivers

* An event is published if and only if its command commits.
* Every reader sees every committed event once, in commit order.
* Per-entity order for write-back, with at-least-once delivery handled.
* No broker container on-prem; Postgres covers pilot volume.
* No session state across transactions, so PgBouncer can be added later.
* Replicas never migrate on their own.
* After an image rollback, older code meets payloads written by newer code ([ADR 0045](0045-backups-restore-drills-upgrades-and-rollback.md)).

## Considered options

* One plain `core.event` table as outbox and event log, a single sequencer that assigns commit-ordered positions, and pg-boss for jobs
* An event table read by insertion order (identity or uuidv7), without a sequencer
* Publishers serialized on a counter row (a gapless sequence), as the earlier attempt did
* An event hypertable in TimescaleDB with a retention policy
* Graphile Worker or BullMQ instead of pg-boss

## Decision outcome

Chosen option: "One plain `core.event` table, a single sequencer and pg-boss", because only a position stamped after commit by one lock holder gives a cursor that never skips a late commit without holding every writer behind a lock, and pg-boss enqueues inside the same Postgres transaction without another service.

```sql
create table core.event (
  seq            bigint generated always as identity, -- insertion order, internal
  id             uuid primary key,                    -- uuidv7, public event id
  event          text not null,                       -- 'planning.plan.revised'
  schema_version int not null default 1,
  entity_type    text not null,
  entity_id      uuid not null,
  entity_version bigint not null,                     -- the row's version after the change
  scope_id       uuid not null,                       -- company or plant node, for filtering
  data           jsonb not null,
  context        jsonb not null,                      -- actor, acting_for, correlation_id, causation_id
  created_at     timestamptz not null default now(),
  position       bigint                               -- null until the sequencer publishes it
);
create unique index event_position_uq on core.event (position) where position is not null;
create index event_outbox_idx on core.event (seq) where position is null;
create table core.event_sequencer (id boolean primary key default true check (id), last_position bigint not null);
create table core.inbox (consumer text not null, event_id uuid not null,
  processed_at timestamptz not null default now(), primary key (consumer, event_id));
```

* A command inserts its events in its own transaction, after the row update that returned the new version; the SDK accepts only that version, so an entity's events are inserted while its row lock is held. A rolled-back command publishes nothing. The causation id is the audit command id ([ADR 0013](0013-audit-trail-written-in-the-command-transaction.md)).
* The sequencer runs in the `worker` and `all` roles. Per batch of up to 500 rows it takes `pg_try_advisory_xact_lock`, assigns positions in `seq` order to rows with `position is null`, enqueues one pg-boss job per consumer whose manifest lists the event type and version under `consumes` ([ADR 0068](0068-extension-points-declared-by-their-owners-contributions-as-manifest-data-with-code-by-id-and-a-plugin-inventory.md)), and sends one `NOTIFY` carrying only the last position, all in one transaction. Positions may have gaps after a failed batch but are never assigned out of commit order. The proposed idle poll interval is 100 to 250 ms.
* `position` is the cursor everywhere. Each `api` process keeps one direct `LISTEN` connection (`DATABASE_LISTEN_URL`), treats a notification as a wake-up, reads `position > last_seen` and polls as a fallback. Subscriptions filter per event ([ADR 0018](0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md)).
* A consumer that writes to Postgres inserts `(consumer, event_id)` into `core.inbox` with `on conflict do nothing` in its transaction and skips the work when no row was inserted. Calls to outside systems are idempotent by state transfer: Pyramid write-back runs on a `stately` queue with `singletonKey` set to the production order id and sends the current committed state ([ADR 0031](0031-erp-integration-connector-modules-field-ownership-and-pending-changes.md)).
* Events carry `entity_version` and `schema_version`; every job payload carries `schema_version`. A handler parks an unknown version in a dead-letter state instead of retrying.
* Retention: a nightly cron deletes events older than an installation setting in batches, and inbox rows of the same age. The default period is not decided. pg-boss cleans its own tables.
* Working default for row-level security and audit on these tables, confirmed in the outbox task: `core.event`, `core.event_sequencer` and `core.inbox` carry allowlist entries with a reason in both catalog checks ([ADR 0008](0008-row-level-security-with-transaction-local-scopes.md), [ADR 0013](0013-audit-trail-written-in-the-command-transaction.md)) and no `audit.require_context()` trigger, because the sequencer, the tail and retention read or change them across all scopes outside a command.

pg-boss:

* Pinned to an exact version (12.36.0, or the version current when the jobs task starts) and wrapped by `@northmes/sdk/jobs` (`defineJob`, `schedule`, `onEvent`, queue policies). pg-boss types never appear in the SDK's public API.
* Every role starts pg-boss with `migrate: false`. Its schema migration and queue creation run inside `northmes migrate`; no queue uses `partition: true`. `northmes migrate` grants `MAINTAIN` on the pg-boss tables to `nm_app`, or pg-boss runs with `reindex: false`.
* Role `api` only sends jobs (`supervise: false`, `schedule: false`, no workers). Roles `worker` and `all` run workers, supervision and cron.
* pg-boss start retries with backoff, like the database pool. An in-process watchdog exits 1 when readiness stays false for more than 120 seconds after the first success, or 300 seconds after start, so the restart policy recovers the process ([ADR 0043](0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md)).
* A job writes only through commands ([ADR 0012](0012-commands-as-the-single-write-path.md)); a job that writes without one fails on the audit trigger.

PgBouncer-safe rules: the pilot runs no PgBouncer, but code uses only transaction-level advisory locks, keeps no session state across transactions, holds `LISTEN` on one direct connection, and schedules through pg-boss cron and singleton jobs, never an advisory-lock leader.

Release 1 events:

| Event | Consumers |
|---|---|
| `planning.production_order.soft_lock_changed` | board only |
| `planning.draft.changed` | board only |
| `planning.job_order.lock_changed` | Pyramid write-back |
| `planning.job_order.scheduled` | Pyramid write-back |
| `planning.plan.revised` | board; one per apply, `changedJobOrderIds` capped at 200, or null meaning "refetch the range" |
| `planning.autoplan.finished` | the requester's subscription |
| `core.calendar.availability_changed` | board; `{ plantId, equipmentIds or all, fromLocal, toLocal }` |
| `core.credential.revoked` | closes the credential's sockets |

The name `batch_row` from earlier designs is removed from event, error and test names before they become public contracts. Deferred: the notifications module, the Events API (it will page on `position` and resolve a public event id to its position), webhooks, actions, and Redis (Valkey, if a broker is ever needed).

### Consequences

* Good, because a late commit gets a higher position in the next batch, so no reader skips it, and no business transaction takes the `NOTIFY` commit lock.
* Good, because the stack stays one database and one app process, with no broker to operate on-prem.
* Bad, because a subscriber sees an event up to one poll interval after commit.
* Bad, because one sequencer is a serialization point; its throughput in batches of 500 is estimated, not measured.
* Bad, because pg-boss changes fast (36 minor releases from 12.0.0 to 12.36.0) and has one publisher; the exact pin and integration tests on every feature NorthMES uses limit the risk.
* Bad, because delivery is at least once, so every handler needs the inbox or state transfer.
* Bad, because pg-boss with `migrate: false` refuses to start when its schema version differs in either direction, so a pg-boss schema change makes a release roll back by restore, not by image ([ADR 0045](0045-backups-restore-drills-upgrades-and-rollback.md)).

### Confirmation

* `event-order.int.test.ts`: first a failing test that shows a naive `id > cursor` reader missing a late commit; then a property test where 20 concurrent writers sleep randomly inside their transactions while a reader pages by `position` and sees every committed event exactly once, in position order.
* Two sequencers running at once produce unique, increasing positions.
* A publish inside a rolled-back transaction leaves no event and no job.
* Two worker instances: a cron slot runs once (pg-boss `TestClock`), and a forced redelivery is skipped by the inbox.
* Ten moves of one order produce at most two write-back calls, and the last call carries the final state.
* Two `api` instances: an event committed through one reaches a subscriber on the other; after `pg_terminate_backend` on the listener, later events still arrive after the reconnect.
* A job payload with an unknown `schema_version` ends in the dead-letter state without retries.
* Contract test: the connector manifest subscribes to no `planning.draft.*` and no `*.soft_lock_changed` event, and a soft lock enqueues zero write-back jobs.
* Lint in the gate command: the string `batch_row` fails in any contracts package.
* Unit test on the jobs wrapper: every role constructs pg-boss with `migrate: false`, and role `api` starts no workers and no cron.
* Ops tests: with the database paused at start and resumed after 40 seconds, `/health/ready` returns 200 within 60 seconds; with `LISTEN` reconnects blocked for 150 seconds, the process exits non-zero and a restarted process becomes ready.

## Pros and cons of the options

### Plain event table, single sequencer, pg-boss

* Good, because positions follow commit order and the cursor is safe for subscriptions, consumers and the later Events API.
* Good, because enqueueing joins the sequencer's Postgres transaction.
* Bad, because it adds a sequencer loop and a poll interval of latency.

### Read by insertion order, no sequencer

* Good, because nothing runs between commit and read.
* Bad, because identity and uuidv7 values are assigned at insert: if transaction A takes 10, B takes 11 and commits first, a reader at 11 never sees 10.

### Counter row serializing publishers

* Good, because positions are gapless and simple.
* Bad, because every publishing command waits for every other one until commit.

### TimescaleDB hypertable with a retention policy

* Good, because chunks drop cheaply by time.
* Bad, because a hypertable's unique indexes must include the time column, so `id` and `position` cannot be unique on their own.
* Bad, because retention policies are under the Timescale License, and release 1 uses no TimescaleDB feature.

### Graphile Worker or BullMQ

* Good, because both are MIT licensed, and Graphile Worker documents about 184 000 jobs per second.
* Bad, because Graphile Worker's open source edition leaves a crashed worker's jobs locked for 4 hours and its `LISTEN` cannot be turned off.
* Bad, because BullMQ needs Redis or Valkey, and its enqueue cannot join the Postgres transaction, so an outbox would still be needed.

## More information

* Related ADRs: [0005](0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md), [0006](0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md) (migrate runs pg-boss's migration), [0012](0012-commands-as-the-single-write-path.md), [0013](0013-audit-trail-written-in-the-command-transaction.md), [0018](0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md), [0028](0028-autoplan-as-a-pure-deterministic-function.md) (autoplan queue policy), [0031](0031-erp-integration-connector-modules-field-ownership-and-pending-changes.md), [0032](0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md), [0043](0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md), [0045](0045-backups-restore-drills-upgrades-and-rollback.md), [0068](0068-extension-points-declared-by-their-owners-contributions-as-manifest-data-with-code-by-id-and-a-plugin-inventory.md) (the manifest field `consumes`).
* Plan: [04 data and platform, outbox, event log and jobs](../plan/04-data-and-platform.md#outbox-event-log-and-jobs), [02 architecture](../plan/02-architecture.md#outbox-event-log-and-jobs), [07 production planning](../plan/07-production-planning.md).
* Postgres `NOTIFY`: https://www.postgresql.org/docs/18/sql-notify.html. The commit lock under load: https://www.recall.ai/blog/postgres-listen-notify-does-not-scale.
* Revisit when a second replica or PgBouncer arrives, when the Events API or webhooks get a consumer, when event volume calls for partitioning by month, and at every pg-boss upgrade.
