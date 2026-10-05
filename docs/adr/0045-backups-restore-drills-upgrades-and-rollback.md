---
status: "proposed"
date: 2026-10-05
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: internal research notes 06, 07, 15, 20 and 32
informed: contributors, coding agents and pilot IT
release: "1"
needs-confirmation: "maintainer and pilot IT (disk layout, offsite target, RPO and RTO); product owner (upgrade window)"
---

# Backups, restore drills, upgrades and rollback

## Context and problem statement

The pilot database runs in one Compose project on one host, with pgBackRest inside the database image ([ADR 0005](0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md), [ADR 0044](0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md)). An internal stress test of the first backup and upgrade design found these faults (internal research note 32):

* A restore drill on the pilot host inherits the production `archive_command` and backup mount. A physical copy shares the production system identifier, so a promoted drill pushes its own timeline into the production archive, and a later point-in-time restore can follow it. The drill database also holds the Pyramid endpoint, the encrypted credentials and the scheduled jobs. This was rated a blocker.
* The previous image refuses a schema that only expanded, so an image rollback never starts.
* The restore point was taken before the app stopped, and a named-point restore picks the latest backup, which lies after the point. A targeted restore also ends paused, read-only.
* While the offsite repository is unreachable, `archive-push` fails and WAL grows until the data disk fills and Postgres stops.
* The data disk was mounted nowhere, and a missing backup mount silently became an empty directory on the root disk.

This ADR records the backup setup, the disk layout, isolated restore drills, the schema compatibility rules and the upgrade and rollback scripts. It covers `pgbackrest.conf`, the systemd timers, `install.sh`, `upgrade.sh`, `rollback.sh`, `restore.sh`, the drill override, the migration markers and `northmes_meta`.

## Decision drivers

* A production restore returns production data only.
* A drill never writes to the production archive and never calls Pyramid or an AI provider.
* A release that only expands the schema rolls back by starting the previous image.
* An upgrade that will fail must fail before any downtime.
* An offsite outage must not stop the production database.
* Every procedure is a script with a nightly test, because one developer supports the pilot.

## Considered options

* pgBackRest with two repositories and asynchronous archiving, isolated drills, expand and contract markers with a schema compatibility number, and a scripted upgrade that stops the app before its backup
* The first design: a restore point before the app stops, a named-point rollback, and drills in a second Compose project on the same host with the production settings
* A nightly `pg_dump` only
* Hypervisor snapshots as the database recovery path

## Decision outcome

Chosen option: "pgBackRest with two repositories and asynchronous archiving, isolated drills, expand and contract markers with a schema compatibility number, and a scripted upgrade that stops the app before its backup", because it is the only option where every fault above has a fix that a nightly test proves.

### Backups

| Setting | Value |
|---|---|
| `archive_command`, `archive_timeout` | `pgbackrest --stanza=northmes archive-push %p`, 60 s, which bounds the loss on a quiet database to about a minute |
| repo1 | Posix path on the backup disk |
| repo2 | The customer's NAS, SFTP or S3-compatible storage, encrypted |
| `archive-async`, `spool-path` | `y`, spool on the backup disk |
| `archive-push-queue-max` | Sized to the data disk, for example 20GiB. Above it WAL is dropped with a warning, the database stays up, health shows the PITR gap in red, and a new full backup is required |
| `log-path`, `log-level-file` | On the backup disk, `warn` |
| Timers | Two systemd timers per repository: weekly `--type=full`, daily `--type=diff`, with explicit `retention-full` and `retention-archive`, `Persistent=true`, `After=docker.service` |
| Second copy | A nightly `pg_dump` that keeps 7 files |

Disk layout: `/etc/docker/daemon.json` sets `data-root` on the data disk. The backup disk is mounted at `/srv/northmes-backup`; a systemd drop-in sets `RequiresMountsFor=/srv/northmes-backup` on `docker.service`, and the bind uses the long syntax with `create_host_path: false`, so a missing mount stops `db` with a clear error. Outside the database, backups cover the `caddy_data` volume, the bundle with its site files and the secrets directory; the installation key is kept apart ([ADR 0047](0047-secrets-and-the-installation-key.md)).

Proposed targets: RPO 1 minute, RTO 2 hours. A monthly restore test restores only the database and checks row counts through `psql`. Pilot IT agrees before go-live that reverting a hypervisor snapshot is not the database recovery path; hostcheck alerts on `pg_stat_archiver.failed_count` above 0 ([ADR 0046](0046-observability-structured-logs-host-checks-and-optional-opentelemetry.md)).

### Restore drills isolated from production

* A drill restores with `--archive-mode=off`, through a drill override with no `archive_command`, the repository mounted read-only at another path, and its own Compose project name, ports and volumes.
* Both database services have a `mem_limit`.
* Drills preferably run on a second VM, or in a CI Testcontainers job against a copy of repo1.
* The drill app sits on a Compose network with `internal: true` and no egress; Caddy is the only container on both networks. One environment flag skips integration crons and forces Pyramid shadow mode. The task that builds it names the flag. Rule 6 of [ADR 0051](0051-regulated-readiness-no-regret-rules.md) keeps behaviour settings out of environment variables, so whether the drill switch may stay an environment flag is open (M-48 in [16-open-questions.md](../plan/16-open-questions.md)).
* The production restore runbook states which `--target-timeline` to use.

A production restore stops `app`, runs `restore.sh` with `--target-action=promote`, waits until `pg_is_in_recovery()` is false, runs `migrate`, starts `app`, writes a security event through a `cli` audit context and shows admins and planners a banner for 24 hours: "Data restored to <time>; changes after that were lost." It ends by running the Pyramid write-back reconciler after the next poll ([ADR 0032](0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md)).

### Schema compatibility

* Every migration file carries an `expand` or `contract` marker ([ADR 0006](0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md)). A lint rejects `cascade`, `drop table`, dropping constraints on referenced tables and key type changes unless the file carries `contract`.
* Each release carries one schema compatibility number in `northmes_meta`, bumped by any contract migration, pg-boss schema change, Better Auth schema change or extension update.
* Boot and readiness accept a newer database while that number does not exceed the image's maximum; System health shows "schema ahead by N expand migrations". An older image's `migrate` applies nothing and exits 0 with a warning when the database is compatible.
* Job payloads and events carry `schema_version`; a handler parks an unknown version in a dead-letter state ([ADR 0014](0014-outbox-event-log-and-pg-boss-jobs.md)).
* The runner records the foreign keys that point into a module's schema from other schemas before that module's pending files, and raises when one disappears. Plugin foreign keys to other modules use `ON DELETE CASCADE` or `SET NULL`, per the owner's grant policy. System health lists leftover schemas of modules no longer installed; `northmes plugin purge <id>` comes later.
* The release manifest states the rollback class: `image` when the release only expanded, `restore` when it bumped the compatibility number. `rollback.sh` never rolls the database image back without a restore.

### `upgrade.sh` and `rollback.sh`

`upgrade.sh` prints the rollback class, then:

1. Pre-flight: disk space, the last backup under 26 hours old, `pgbackrest check`.
2. `northmes migrate --check` from the new image with the site's config and plugins. It runs boot steps 1 to 10 without listening and stops before the first migration file, so a plugin that no longer composes fails here. In this mode the migration check of step 5 lists pending files instead of failing on them. A version with no recorded staging pass is refused.
3. Maintenance page on, `app` stopped.
4. `pgbackrest backup --type=incr --start-fast --annotation=northmes-upgrade=<version>`; the backup label goes into `upgrade-state.json`. Optionally `pg_create_restore_point` and `pg_switch_wal`.
5. Superuser bootstrap and extension updates over the local socket ([ADR 0005](0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md)).
6. `migrate`, then `up`, wait for `/health/ready`, smoke check.

`rollback.sh` first exports the `audit.command` and `production_start.report` rows written after the recorded time to a CSV for re-entry. For the image class it starts the previous site image without a restore. For the restore class it runs `restore --set=<label> --type=immediate --target-action=promote`, which is exact because nothing wrote after the app stopped, waits until `pg_is_in_recovery()` is false, runs the previous image's `migrate`, which applies nothing, and starts the previous site image. Then it writes the security event, shows the 24-hour banner and runs the reconciler, as a production restore does.

Upgrades run between shifts with paper reporting meanwhile; the product owner confirms the window. Nobody installs or upgrades in the week of a daylight saving change. The pilot's exit criteria include an upgrade rehearsal from N to N+1 with a migration, the backup and a rollback on the pilot-like VM.

### Consequences

* Good, because a drill can no longer change what a production restore replays, nor reach an integration.
* Good, because a release of the image class rolls back in minutes, without losing data.
* Good, because a broken plugin composition or a missing staging pass stops the upgrade while the app still runs.
* Bad, because drills need a second VM, or a separate project with its own network, ports and volumes.
* Bad, because a restore-class rollback loses the writes made after the upgrade; people re-enter them from the CSV.
* Bad, because each release must classify its migrations, and a contract step waits for a later release.

### Confirmation

* Restore drill ops test (nightly, `DockerComposeEnvironment`): write rows, take a full backup, run the drill, write rows in the copy and run `pg_switch_wal()` there; `pgbackrest info --output=json` lists no timeline 2, the archived segment count is unchanged, a production point-in-time restore returns production rows only, and a drill copy with live write-back configured sends zero requests to the fake PWS server.
* `wal-archive-outage.ops.test.ts`: repo2 points at an SFTP host that refuses connections, `archive-push-queue-max` is 128MiB and the test generates 300 MB of WAL; `pg_wal` stays under the queue maximum plus `max_wal_size`, health shows `archive: failing` and `pitr_gap: true`, and `pgbackrest check` passes once repo2 is back.
* Install test: with `/srv/northmes-backup` absent, `db` fails to start with a clear error and no directory is created.
* Upgrade and rollback ops test: install N-1, write rows, run `upgrade.sh` to N with a fixture migration that fails halfway, run `rollback.sh`; `db` starts, rows written before the stop are present, the pgBackRest log line "restore backup set <label>" matches the recorded label, and a write succeeds afterwards. A script test with a stub `docker` binary logs "stop app" before the backup call.
* `rollback-compat.test.ts`: a 0.4.0 fixture catalog whose planning adds one expand file migrates, and the 0.3.0 catalog boots with one warning; marked contract, boot refuses and names the file. A fake pg-boss schema bump makes the manifest say `restore`.
* `migrate --check` test: a planning fixture with `quantity: Float!` plus the example validator built against `quantity: Int!` exits 1 naming the validator, `EXTERNAL_TYPE_MISMATCH` and `ProductionOrder.quantity`, and `northmes_meta.migration` is unchanged.
* `migrate-guards.test.ts`: `drop table ... cascade` in a planning fixture while the example validator's foreign key exists raises a `MigrationError` naming that key, and `pg_constraint` still holds it. Health lists the schema of a plugin removed from the config.
* Migration lint in CI: a file with `cascade`, `drop table`, a dropped constraint on a referenced table or a key type change and no `contract` marker fails.
* Nightly N-1 image test: for releases of the image class, the previous image's smoke test and workers run through the real Compose file over a database the current image wrote.

## Pros and cons of the options

### pgBackRest, isolated drills, compatibility number, scripted upgrade

* Good, because point-in-time recovery, two repositories with their own retention and encryption come from one tool.
* Bad, because pgBackRest's maintainer announced in 2026 that the project was unmaintained, then that it continues with sponsor funding; a switch needs a new base backup (internal research note 15).

### The first design

* Good, because it needs no second VM.
* Bad, because the drill pollutes the production archive, the named-point rollback fails with "recovery ended before configured recovery target was reached", and the previous image refuses the new schema (internal research note 32).

### Nightly `pg_dump` only

* Good, because it is simple and independent of the physical layout.
* Bad, because it has no point-in-time recovery; up to a day of reports would be lost.

### Hypervisor snapshots

* Good, because many plant IT departments already run them.
* Bad, because after a revert Postgres sends WAL segments whose names already exist in the repository with other content, pgBackRest refuses them and archiving stops.

## More information

* Related ADRs: [0005](0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md), [0006](0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md), [0014](0014-outbox-event-log-and-pg-boss-jobs.md), [0032](0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md) shadow mode and the reconciler, [0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md) site image, [0038](0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md) patch releases of the image class, [0043](0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md), [0044](0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md), [0046](0046-observability-structured-logs-host-checks-and-optional-opentelemetry.md), [0047](0047-secrets-and-the-installation-key.md) escrow and the quarterly restore from repo2.
* Plan: [12 operations and security](../plan/12-operations-and-security.md) (disk layout, backups and WAL archiving, restore drills, upgrades and rollback), [11 quality and testing](../plan/11-quality-and-testing.md) (ops and image tests), [02 architecture](../plan/02-architecture.md) (boot sequence).
* To confirm: the disk layout, the repo2 target, retention per repository, RPO and RTO (user and pilot IT); the upgrade window and paper reporting (product owner).
* pgBackRest user guide: https://pgbackrest.org/user-guide.html
* pgBackRest command reference (restore `--set`, `--type`, `--target-action`, `--archive-mode`): https://pgbackrest.org/command.html
* Revisit when pgBackRest's maintenance status changes, when an optional time-series backend joins the image ([ADR 0059](0059-time-series-storage-port-with-an-open-default-backend.md)), or when a second replica allows upgrades without downtime.
