---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: internal research notes 06, 11, 12, 13, 15, 17, 32 and 37
informed: contributors, coding agents and pilot IT
release: "1"
needs-confirmation: "maintainer (the pgBackRest source fallback until PGDG publishes 2.59.3)"
---

# Postgres 18 official image with pgBackRest, TimescaleDB deferred

## Context and problem statement

NorthMES runs on PostgreSQL 18, which is supported until 2030-11-14. The pilot runs on-prem in Docker Compose on one host. Point-in-time recovery uses pgBackRest with WAL archiving, and `archive_command` runs inside the database container, so pgBackRest must be in the database image (internal research note 15).

The research proposed three TimescaleDB-based images: the Alpine `timescale/timescaledb` image, the Ubuntu-based `timescale/timescaledb-ha` image, and the ha image's `-oss` variant. Release 1 needs no TimescaleDB feature: planning, the Pyramid connector, the outbox and the audit trail are plain tables. The data directory, the uid and the locale provider are fixed at a customer's first init, so the image has to be decided before the first install (internal research note 32).

Krister Johansson decided on the official `postgres:18` image with pgBackRest, and on leaving TimescaleDB out until Data collection. This ADR records that decision, the image contents and tests, and the superuser bootstrap and extension updates that follow from it. It covers the `db` service, `infra/pg-image.json`, the Testcontainers harness, `install.sh` and `upgrade.sh`.

## Decision drivers

* The image must carry pgBackRest 2.59.3 or later. That release fixes a flaw where encrypted repositories could get weak subkeys and salts.
* Production, tests and the offline image bundle must use the same image, named in one place.
* Release 1 uses no TimescaleDB feature, and Data collection must be able to add TimescaleDB later without moving the data directory or changing the uid.
* Text indexes must not depend on libc or ICU versions across image changes.
* Migrations run as `nm_owner`, never as the superuser, so every step that needs the superuser must happen outside the app.

## Considered options

* The official Debian-based `postgres:18` image plus pgBackRest from PGDG, with TimescaleDB left out
* `timescale/timescaledb-ha` for Postgres 18 with the `-oss` tag, plus pgBackRest 2.59.3 or later
* The Alpine `timescale/timescaledb` image for Postgres 18

## Decision outcome

Chosen option: "The official Debian-based `postgres:18` image plus pgBackRest from PGDG, with TimescaleDB left out", because it carries no TimescaleDB code that release 1 does not use, keeps the official data directory and uid for a later TimescaleDB install, and gets a current pgBackRest from the PGDG repository.

### The image

* The image is built from the official Debian-based `postgres:18` image pinned by digest, plus pgBackRest 2.59.3 or later from PGDG. It is published as `ghcr.io/northmes/postgres`.
* The Dockerfile pins the exact PGDG package version of pgBackRest, and the pin is the newest PGDG version that passes the image test. On 2026-10-05 the PGDG `trixie-pgdg` index carried pgBackRest 2.59.2 at most, one day after the 2.59.3 release, so no PGDG package passed yet. Until PGDG publishes 2.59.3, the image builds pgBackRest 2.59.3 from the upstream release tag in a build stage, the image test stays unchanged, and a tracking issue moves the build back to the PGDG package when it appears. No image ships a pgBackRest older than 2.59.3, because the encrypted offsite repository depends on that fix. Taking pgBackRest from a source other than PGDG until PGDG catches up is adopted from internal research note 37.
* TimescaleDB is not in the image. The official `PGDATA` (`/var/lib/postgresql/18/docker`, volume mounted at `/var/lib/postgresql`) and the official uid stay, so TimescaleDB can join the same image when Data collection starts.
* `infra/pg-image.json` holds the one digest that Compose, Testcontainers and the offline bundle job read. A repository lint fails when a Compose file, a Dockerfile or a test names any other Postgres image. Renovate proposes digest updates to this file ([ADR 0050](0050-github-organization-rulesets-ci-runners-and-supply-chain.md)).
* The first init sets `POSTGRES_INITDB_ARGS='--locale-provider=builtin --builtin-locale=C.UTF-8'`. Text indexes then sort by code point and never depend on libc or ICU versions. Screens that sort names for people use an explicit ICU collation, for example `COLLATE "sv-SE-x-icu"`.
* The `db` command adds `-c wal_compression=zstd`. In a measured stock snapshot sync with 5 percent changed rows, WAL per sync fell from 19 MB to 6 MB with zstd (internal research note 32). The `db` service has a `mem_limit`.
* The workarounds that the TimescaleDB images needed (`PGBACKREST_CONFIG`, `TS_TUNE_*`, `timescaledb.telemetry_level`, `timescaledb.max_background_workers=0`) are dropped.

### Superuser bootstrap

* An init script in the image's `/docker-entrypoint-initdb.d` creates `nm_owner`, `nm_app`, `nm_auth` and `nm_ext` on first init and reads their passwords from `_FILE` secrets. On a database server that already exists, `northmes db bootstrap` does the same once as the superuser. The roles and their rights are in [ADR 0006](0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md).
* The superuser password is its own secret, `POSTGRES_PASSWORD_FILE`. No NorthMES process uses the superuser.
* `install.sh` writes secret files with `install -m 0440`, owned by root and by the group of the uid that the `db` and `app` processes run as. The image test records that uid.
* `install.sh` runs in this order: chown the backup and spool directories to the db uid, start `db`, `pgbackrest stanza-create`, `pgbackrest check`, a full backup, then migrate and start `app`.
* `btree_gist` is a trusted extension, so `nm_owner` with `CREATE` on the database creates it in a migration without the superuser.

### Extension updates

`upgrade.sh` runs extension updates as `docker compose exec -T db psql -U postgres` over the local socket, before migrate, for every extension whose `extversion` is older than its `default_version`. `northmes migrate` runs as `nm_owner` and never updates an extension: on a TimescaleDB image, `ALTER EXTENSION ... UPDATE` as `nm_owner` failed with "must be owner of extension" (internal research note 32). An extension update bumps the schema compatibility number ([ADR 0045](0045-backups-restore-drills-upgrades-and-rollback.md)).

### Consequences

* Good, because the release 1 image contains no TimescaleDB binaries. The non-oss TimescaleDB images ship community-edition binaries under the Timescale License, and the ha image's init script creates `timescaledb_toolkit`.
* Good, because the Debian base matches the Node image ([ADR 0004](0004-monorepo-tooling-pnpm-turborepo-node-and-typescript-versions.md)), and the time zone data comes from the OS package (tzdata 2026b in `postgres:18` when checked, internal research note 11).
* Good, because one digest file drives Compose, tests and the bundle, so tests never run on another image than production.
* Bad, because NorthMES builds, signs and publishes its own database image and rebuilds it for each Postgres minor and pgBackRest release.
* Bad, because init scripts do not run on an existing data directory. When Data collection adds TimescaleDB, `shared_preload_libraries` is set by hand and the superuser creates the extension (internal research note 06). [ADR 0059](0059-time-series-storage-port-with-an-open-default-backend.md), proposed, stores Data collection's machine data in plain Postgres without TimescaleDB; if it is accepted, this consequence no longer applies.
* Bad, because pgBackRest's maintainer announced on 2026-04-27 that the project was no longer maintained, then on 2026-05-18 that it continues with sponsor funding. A switch to another backup tool needs a new base backup (internal research note 15).

### Confirmation

Image test, run with Testcontainers on the built image:

* `pg_available_extensions` lists no `timescaledb`.
* `pg_database.datlocprovider` is `b` for the NorthMES database.
* `pgbackrest version` reports 2.59.3 or later, `pgbackrest check` passes after the install step, and `pg_stat_archiver.failed_count` is 0 after `select pg_switch_wal()`.
* The test records the uid of the postgres process, which `install.sh` uses for the group of the secret files.

Other checks:

* Image lint: a Compose file, Dockerfile or test that names a Postgres image other than the digest in `infra/pg-image.json` fails CI.
* Bootstrap test: a fresh container with the `_FILE` secrets has `nm_owner`, `nm_app`, `nm_auth` and `nm_ext`; `nm_app` has no `SUPERUSER`, `CREATEROLE` or `BYPASSRLS`; a second `northmes db bootstrap` changes nothing.
* Extension update test: an extension created at a version older than its `default_version` (picked from `pg_available_extension_versions`) is at `default_version` after the `upgrade.sh` extension step; a second run changes nothing.
* The nightly Compose test on Linux runs `install.sh` and asserts that `app` and `db` read their secrets and that `show wal_compression` returns `zstd`.

## Pros and cons of the options

### Official `postgres:18` plus pgBackRest

* Good, because pgBackRest comes from PGDG at the version the backup design needs.
* Good, because the official `PGDATA` and uid stay, so a later TimescaleDB install uses the same data directory.
* Bad, because NorthMES maintains the image build.

### `timescale/timescaledb-ha` with the `-oss` tag

* Good, because pgBackRest is preinstalled, and TimescaleDB's Apache-2.0 edition is ready for Data collection.
* Bad, because the image points pgBackRest at a file inside the data directory with stanza `poddb` and never reads a mounted config, so it needs `PGBACKREST_CONFIG` set and `PGBACKREST_STANZA` unset (internal research note 32).
* Bad, because the local pg17 tag held pgBackRest 2.58.0, below the required 2.59.3, and the image is large (about 677 MB compressed for amd64 on `pg18.6-ts2.30.2`).
* Bad, because it keeps data in `/home/postgres/pgdata/data` as uid 1000 and defaults to the libc `C.UTF-8` locale.

### Alpine `timescale/timescaledb`

* Good, because it is smaller (about 376 MB compressed for `2.30.2-pg18`).
* Bad, because the image has no pgBackRest, and Alpine 3.23 packages pgBackRest 2.57.0.
* Bad, because its tags without `-oss` ship community-edition binaries, its init script creates the `timescaledb` extension in `template1`, `postgres` and `POSTGRES_DB`, and telemetry is on (`basic`) by default.
* Bad, because musl differs from the Debian Node image.

## More information

* Related ADRs: [0004](0004-monorepo-tooling-pnpm-turborepo-node-and-typescript-versions.md) Node image, [0006](0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md) roles and migrations, [0041](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md) Testcontainers harness, [0044](0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md) Compose bundle, [0045](0045-backups-restore-drills-upgrades-and-rollback.md) backups and upgrades, [0047](0047-secrets-and-the-installation-key.md) secrets, [0059](0059-time-series-storage-port-with-an-open-default-backend.md) time-series storage for Data collection.
* Plan: [04 data and platform](../plan/04-data-and-platform.md) (database server and image, roles and bootstrap), [12 operations and security](../plan/12-operations-and-security.md).
* Official image: https://hub.docker.com/_/postgres/
* pgBackRest: https://pgbackrest.org/
* PostgreSQL versioning policy: https://www.postgresql.org/support/versioning/
* Revisit when Data collection starts (proposed [ADR 0059](0059-time-series-storage-port-with-an-open-default-backend.md) keeps TimescaleDB out of the image), when PGDG publishes pgBackRest 2.59.3, when Postgres 19 is released, or when pgBackRest's maintenance status changes.
