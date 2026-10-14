---
status: "proposed"
date: 2026-10-14
decision-makers: proposed by a planning session, to be confirmed by Krister Johansson
consulted: ADR 0005, 0006, 0018, 0038, 0043, 0045, 0051, 0071, 0075 and 0078; GitLab's post-deployment and batched background migrations
informed: contributors, coding agents, pilot IT and hosting partners
release: "1"
needs-confirmation: "maintainer (contract steps one release after the code stops using the old shape; the computed rollback class; the restore-class rollback deadline; backfills as background jobs after start; the migration time budget; the resumable upgrade unit; the read-only smoke check and the watch period)"
---

# Safer upgrades with contract steps a release later, a computed rollback class and a resumable, audited upgrade

## Context and problem statement

On 2026-10-14 Krister Johansson asked for a thorough review of the upgrade plan, because "we can't really have downtime or a failed upgrade ruin the production for companies". Offered a blue/green switch that would keep the app serving during an upgrade, he chose to keep stopping the app, as [ADR 0045][adr-0045] decides. This ADR therefore keeps the stop and closes the other gaps the review found, so that the stop is as short as possible and a failure never leaves a company with a broken or emptied installation:

* A contract migration can ship in the same release as the code change, which makes the release `restore` class, whose rollback loses every write after the backup.
* The rollback class is written by hand in the release manifest, so a wrong value makes `rollback.sh` start an image that refuses the schema.
* `upgrade.sh` runs in the operator's shell, so a dropped SSH connection stops it halfway, and no step says whether it may run twice.
* The bundle is verified at install but not at upgrade, and nothing refuses an older version.
* Long backfills inside migration files make the window as long as the data.
* Nobody records who upgraded what, the smoke check is undefined, and nothing watches the installation after it starts.
* No test kills an upgrade halfway, and no test measures migration time on a large database.

The upgrade path, the rehearsal and release candidates stay in proposed [ADR 0078][adr-0078]. This ADR covers the migration runner and lint of [ADR 0006][adr-0006], `upgrade.sh` and `rollback.sh` of [ADR 0045][adr-0045], the release manifest and the nightly tests.

## Decision drivers

* Krister Johansson's choice: an upgrade stops `app`, as ADR 0045 decides.
* A failed upgrade returns to the previous version, and losing writes is the rare case.
* The window is as short as the schema change, not as long as the data.
* An upgrade survives the operator's connection dropping, and each step can run twice.
* Every guarantee is a lint, a computed value or a test, because one developer supports the pilot.

## Considered options

* Keep the stop, and add contract steps a release later, a computed rollback class, backfills after start and a resumable, audited upgrade
* Keep ADR 0045 as it is
* A blue/green switch for releases of the `image` class (not chosen by Krister Johansson)

## Decision outcome

Chosen option: "Keep the stop, and add contract steps a release later, a computed rollback class, backfills after start and a resumable, audited upgrade", because each addition closes one failure the review found without changing the procedure Krister Johansson kept.

### Contract steps one release later

* A contract step never ships in the release whose code stops using the old shape. Release N stops reading and writing a column; release N+1 or later drops it. The previous image then still runs on the schema of every release that only expands, so almost every release is of the `image` class, and its rollback starts the previous image with no restore and no lost write ([ADR 0045][adr-0045]).
* A pull request that adds a `contract` file names the release whose code stopped using what it removes, and review checks it against the schema snapshot.
* A release is of the `restore` class only when nothing else works: a Postgres major or extension update ([ADR 0005][adr-0005]), a third-party schema change without a compatible path (Better Auth's tables, BullMQ's data in Valkey under [ADR 0071][adr-0071]), or a fix that must rewrite data the previous code would misread. Its release notes say why.
* Postgres major upgrades have their own procedure and window, and never share one with a NorthMES upgrade.

### A computed rollback class

CI computes each release's rollback class and schema compatibility number from the markers of every migration file since the previous release, the migrations of the example plugins and the recorded third-party schema changes, and writes both into the release manifest. The release workflow fails when a hand-written value disagrees. `upgrade.sh` reads the class from the verified manifest only.

### A short window

* A backfill over more than a fixed row count is not a migration file. A migration file registers it as a batched, idempotent background job that runs after `app` starts, in batches with a pause between them, and `northmes_meta.background_migration` records its progress. A later release whose code needs it finished declares that, and `migrate --check` refuses until it has finished, naming it. Such a release is an upgrade stop under proposed [ADR 0078][adr-0078].
* Each release manifest carries a migration time budget measured on the large nightly snapshot. The rehearsal of proposed [ADR 0078][adr-0078] prints its own time beside the budget, and the operator plans the window from it.
* The runner sets a `statement_timeout` from that budget on each file, so a migration that runs far longer than measured fails, and `rollback.sh` takes over, instead of holding the plant for an unknown time.
* Before stopping `app`, `upgrade.sh` lets running jobs finish inside the 45 s grace period of [ADR 0043][adr-0043]. Jobs still queued in Valkey carry `schema_version` ([ADR 0045][adr-0045]), and the new version accepts the previous version's payloads.

### Before the stop

* `upgrade.sh` verifies the bundle's digest and attestation as the install does (E18-S02), and refuses a version older than the installed one; going back is `rollback.sh` only.
* The disk check requires the rehearsal's measured peak disk use plus 20 percent, because an index build or a rewrite can need the size of the table again.
* Plugin migrations follow the same markers and lint, checked at install and by `northmes plugin check` ([ADR 0075][adr-0075]).

### A resumable, audited upgrade

* `upgrade.sh` starts itself as a transient systemd unit (`systemd-run --unit northmes-upgrade`), so it survives the operator's connection dropping. It logs to the backup disk and records each finished step in `upgrade-state.json`. `upgrade.sh --status` shows the step, and `upgrade.sh --resume` continues from the last finished step. Every step is safe to run twice; the migrate step already is, through `northmes_meta.migration` and the advisory lock ([ADR 0006][adr-0006]).
* It takes the host lock of proposed [ADR 0075][adr-0075].
* `upgrade.sh` and `rollback.sh` each write a security event through a `cli` audit context with the from and to versions, the bundle digest, the rollback class, the rehearsal result, the outcome and the operator's reason ([ADR 0051][adr-0051]).

### After the start

* The smoke check reads only: `/health/ready`, sign-in with a dedicated health account that holds no role, one read per module through the API, the web's module list and a realtime connection. It writes no command row.
* `upgrade.sh` watches for 30 minutes after the smoke check: readiness, the error rate in the logs and the browser error reports of [ADR 0043][adr-0043]. It prints what it saw and recommends `rollback.sh` on a failure, without running it.
* For the `image` class, `rollback.sh` starts the previous image at any time until the next upgrade. For the `restore` class, the operator sets a deadline at upgrade time, by default the start of the next shift; until then `rollback.sh` restores the backup, and after it `rollback.sh` refuses and names the forward fix, within the 72-hour patch target of [ADR 0038][adr-0038], so a restore never silently drops a day of production.
* The rehearsal copy of proposed [ADR 0078][adr-0078] holds production data: it stays on a host the customer controls, on an encrypted disk, and is removed on exit and again at the start of the next rehearsal.

### Consequences

* Good, because almost every release rolls back by starting the previous image, without losing a write.
* Good, because a mislabelled release, a tampered or older bundle, or a dropped connection no longer turns into a broken installation.
* Good, because the window holds the schema change only, and the operator knows its length before the stop.
* Good, because every upgrade and rollback is in the audit trail.
* Bad, because every upgrade still stops every plant user for the migrations and the boot, and plants report on paper meanwhile.
* Bad, because removing a column takes two releases.
* Bad, because backfills move from SQL files to jobs, which is more code per data change.

### Confirmation

* `rollback-class.test.ts`: a release with one `contract` file computes `restore`, and a manifest that says `image` fails the release workflow.
* `migrate-timeout.int.test.ts`: a file that runs longer than its `statement_timeout` fails, and `northmes_meta.migration` does not record it.
* `background-migration.int.test.ts`: a registered backfill runs in batches after start and survives a restart halfway; a release that needs it finished is refused by `migrate --check` until it is.
* `infra/test/upgrade-crash.int.test.ts` (nightly): the upgrade is killed after the backup, during migrate and after the start; each time `upgrade.sh --resume` or `rollback.sh` ends with a working installation and no lost rows.
* `infra/test/upgrade.int.test.ts`: an older bundle and a bundle with a wrong digest are refused before the stop; an upgrade and a rollback each write their security event.
* A large snapshot at five times pilot scale upgrades nightly inside the time budget of its release manifest.

## Pros and cons of the options

### Keep the stop, with the additions

* Good, because only one version runs at a time, and migrations may take any lock.
* Bad, because users still wait out every upgrade.

### ADR 0045 as it is

* Good, because nothing new is built.
* Bad, because every gap above stays open.

### A blue/green switch for the image class

* Good, because users would see only a reconnect.
* Bad, because migrations would have to be written for a live database, and two versions would overlap. Krister Johansson chose to keep the stop.

## More information

* Related ADRs: [0005][adr-0005], [0006][adr-0006], [0038][adr-0038], [0043][adr-0043], [0045][adr-0045], [0051][adr-0051], [0071][adr-0071], [0075][adr-0075], [0078][adr-0078].
* GitLab migration ordering and post-deployment migrations: https://docs.gitlab.com/development/database/migration_ordering/.
* Revisit if the length of upgrade windows becomes a problem for a plant; the blue/green switch is then the next step, because contract steps a release later already make it possible.

[adr-0005]: 0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md
[adr-0006]: 0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md
[adr-0038]: 0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md
[adr-0043]: 0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md
[adr-0045]: 0045-backups-restore-drills-upgrades-and-rollback.md
[adr-0051]: 0051-regulated-readiness-no-regret-rules.md
[adr-0071]: 0071-jobs-on-bullmq-with-valkey-and-the-postgres-outbox-as-the-record.md
[adr-0075]: 0075-plugin-installs-from-signed-archives-into-a-plugin-volume-with-plugin-screens-loaded-at-run-time.md
[adr-0078]: 0078-upgrade-paths-with-upgrade-stops-a-rehearsal-on-a-restored-copy-and-an-upgrade-matrix-in-ci.md
