---
status: "proposed"
date: 2026-10-09
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: Krister Johansson; the planning session's design study of main at 4cb2429
informed: NorthMES contributors and coding agents
release: "1"
needs-confirmation: ""
---

# Jobs on BullMQ with Valkey and the Postgres outbox as the record

## Context and problem statement

[ADR 0014][adr-0014] makes `core.event` the outbox and event log and runs jobs on pg-boss, chosen because pg-boss enqueues inside the Postgres transaction without another service. On 2026-10-09 Krister Johansson chose BullMQ on Valkey, alongside the one backend of [ADR 0070][adr-0070]. No pg-boss code exists yet, so the change costs documents only. This ADR covers the job runner, the sequencer's hand-off to it, cron, the roles, Bull Board and the Valkey service. The outbox, the sequencer's positions and `core.inbox` stay as ADR 0014 decides.

## Decision drivers

* The outbox in Postgres stays the record of what must happen, so losing the queue store loses no business fact.
* A cron slot runs once across workers, and the autoplan queue keeps at most one active and one waiting run per plant (ADR 0028).
* A maintained Nest integration and a job dashboard.
* The pilot host runs offline under Docker Compose ([ADR 0044][adr-0044]).

## Considered options

* BullMQ on a Valkey container
* BullMQ's PostgreSQL backend
* pg-boss, as ADR 0014 decided

## Decision outcome

Chosen option: "BullMQ on a Valkey container", because with the outbox as the record a lost Valkey costs queue state only: job schedulers re-register at boot, and event jobs can be re-sent from `core.event`.

* BullMQ 6.3.8 through `@nestjs/bullmq` 12.0.0, and Bull Board 9.10.1, all MIT; Valkey is BSD licensed. They arrive with E05-S09. `@northmes/sdk/jobs` keeps `defineJob`, `schedule` and `onEvent`, and no BullMQ type appears in its public API.
* The sequencer assigns positions as ADR 0014 decides and commits, then adds one job per consumer. Each job id is deterministic from the consumer and the event id and contains no colon, which BullMQ ids may not contain.
* BullMQ ignores an add only while a job with that id is still kept, so `core.inbox` stays the duplicate guard.
* A crash between the commit and the adds is repaired by a re-send from `core.event`, for example from a dispatch cursor, which the jobs task builds.
* Code adds a job only after its own transaction commits. Work that must survive a crash is an event with a consumer, so the outbox records it.
* Cron runs through `upsertJobScheduler`, which runs each slot once across workers. Every `worker` and `all` process registers its schedulers at boot.
* ADR 0014's stately queues map to deduplication with `keepLastIfActive`: at most one active and one waiting job per id, such as the autoplan run per plant.
* Role `api` adds jobs and runs no worker or scheduler. Roles `worker` and `all` run both, and worker replicas can run per queue, for example one for `planning.autoplan`.
* Bull Board is reachable only behind a guard of its own, such as Caddy basic auth.

### Parts of accepted ADRs this decision changes

#### Changes to ADR 0002

In the role table BullMQ replaces pg-boss: role `api` adds jobs only, and role `worker` runs workers and job schedulers. The pilot host runs Valkey next to the database, so it is no longer free of a broker.

#### Changes to ADR 0006

Step 9 goes. `northmes migrate` runs no job-runner migration, because BullMQ keeps nothing in Postgres.

#### Changes to ADR 0014

This ADR replaces the pg-boss section and pg-boss in the PgBouncer rule. The sequencer adds jobs after its commit, not inside its batch transaction. The deferred Valkey broker arrives. The `migrate: false` unit test goes, and the cron test runs two workers on one Valkey.

#### Changes to ADR 0022

Module server code imports no `bullmq` or `@nestjs/bullmq`, in place of `pg-boss`; jobs go through `@northmes/sdk/jobs`.

#### Changes to ADR 0041

Job tests start a Valkey container through Testcontainers next to Postgres, and each replica of `createReplicas(2)` gets its own BullMQ connections instead of a pg-boss instance.

#### Changes to ADR 0043

`/health/ready` checks the Valkey connection instead of "pg-boss started", and shutdown closes the BullMQ workers, which drains running jobs, instead of calling pg-boss `stop()`.

#### Changes to ADR 0044

Compose gains a `valkey` service: the Valkey image pinned by digest, publishing no port, under the rules for every service.

#### Changes to ADR 0060

The Zod environment schema gains the Valkey connection setting for every role.

### Consequences

* Good, because a lost Valkey costs queue state only, and Postgres keeps every business fact.
* Good, because `@nestjs/bullmq` and Bull Board are maintained integrations, and BullMQ brings deduplication, job schedulers and workers per queue.
* Bad, because the pilot host runs one more container, which ADR 0002 and ADR 0014 avoided.
* Bad, because an add cannot join a Postgres transaction, so the re-send path and `core.inbox` carry correctness.

### Confirmation

* Crash test: the process stops between the sequencer's commit and its adds; after a restart every consumer of that batch runs once.
* Two workers on one Valkey: a cron slot runs once, and a forced redelivery is skipped by the inbox.
* Deduplication test: three autoplan requests for one plant leave at most one active and one waiting job.
* Role test: role `api` registers no BullMQ worker or scheduler.
* Readiness test: with Valkey stopped, `/health/ready` reports not ready.
* Boundary lint: module server code that imports `bullmq` fails.

## Pros and cons of the options

### BullMQ on a Valkey container

* Good, because the outbox keeps every fact and Valkey holds queue state only.
* Good, because deduplication and `upsertJobScheduler` cover the autoplan queue and cron.
* Bad, because it adds a container and cannot enqueue inside a Postgres transaction.

### BullMQ's PostgreSQL backend

* Good, because it needs no extra container.
* Bad, because it arrived in 6.0.0 on 2026-07-30, with 30 releases since, and its docs give about 1.5 to 2 times fewer processed jobs per second than Redis.
* Bad, because it keeps its tables in its own schema (`bullmq` by default) with its own migrations, its fit with `@nestjs/bullmq` and the owner roles is unverified, and its docs show no enqueue on a caller's transaction.

### pg-boss, as ADR 0014 decided

* Good, because it enqueues inside the Postgres transaction without another service.
* Bad, because it changes fast with one publisher, and with `migrate: false` a pg-boss schema change makes a release roll back by restore (ADR 0014).

## More information

* Proposed ADRs 0028, 0031, 0032 and 0045 change in place, and the plan files that name pg-boss follow.
* Related ADRs: [0002][adr-0002], [0006][adr-0006], [0014][adr-0014], [0043][adr-0043], [0044][adr-0044], [0070][adr-0070].
* Revisit when BullMQ's PostgreSQL backend has a verified fit with `@nestjs/bullmq` and the owner roles.

[adr-0002]: 0002-modular-monolith-with-module-owned-schemas-and-process-roles.md
[adr-0006]: 0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md
[adr-0014]: 0014-outbox-event-log-and-pg-boss-jobs.md
[adr-0043]: 0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md
[adr-0044]: 0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md
[adr-0070]: 0070-one-nestjs-backend-with-one-graphql-schema-and-one-static-web-app.md
