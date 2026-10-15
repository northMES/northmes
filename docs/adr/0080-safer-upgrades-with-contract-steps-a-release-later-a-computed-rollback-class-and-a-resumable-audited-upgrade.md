---
status: "proposed"
date: 2026-10-14
decision-makers: proposed by a planning session, to be confirmed by Krister Johansson
consulted: Krister Johansson
informed: contributors, coding agents, pilot IT and hosting partners
release: "1"
needs-confirmation: "maintainer (contract steps one release after the code stops using the old shape; the computed rollback class; backfills as background jobs after start; the migration time budget; resuming by running docker compose up -d again; the read-only smoke check in CI, with the watch period and the restore-class deadline in a script later; the 503 with Retry-After during the stop; a late window of at least 24 hours; the gateway requirements in the install guide; polling adapters outside app)"
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

The upgrade path, the rehearsal and release candidates stay in proposed [ADR 0079][adr-0079], which also moves `upgrade.sh` and `rollback.sh` of [ADR 0045][adr-0045] to later: in release 1 an upgrade is an edit of `.env` and `docker compose pull`, `down` and `up -d`, and the `migrate` service checks, sets a restore point and migrates. This ADR covers the migration runner and lint of [ADR 0006][adr-0006], that `migrate` service, the release manifest and the nightly tests.

## Decision drivers

* Krister Johansson's choice: an upgrade stops `app`, as ADR 0045 decides.
* A failed upgrade returns to the previous version, and losing writes is the rare case.
* The window is as short as the schema change, not as long as the data.
* An upgrade survives the operator's connection dropping, and each step can run twice.
* Krister Johansson's choice of 2026-10-15: no upgrade script in release 1 ([ADR 0079][adr-0079]).
* Every guarantee is a lint, a computed value or a test, because one developer supports the pilot.

## Considered options

* Keep the stop, and add contract steps a release later, a computed rollback class, backfills after start and a resumable, audited upgrade
* Keep ADR 0045 as it is
* A blue/green switch for releases of the `image` class (not chosen by Krister Johansson)

## Decision outcome

Chosen option: "Keep the stop, and add contract steps a release later, a computed rollback class, backfills after start and a resumable, audited upgrade", because each addition closes one failure the review found without changing the procedure Krister Johansson kept.

### Contract steps one release later

* A contract step never ships in the release whose code stops using the old shape. Release N stops reading and writing a column; release N+1 or later drops it. The previous image then still runs on the schema of every release that only expands, and its rollback starts the previous image with no restore and no lost write ([ADR 0045][adr-0045]).
* A delayed contract step keeps the rule of [ADR 0045][adr-0045]: it bumps the schema compatibility number, and its release is of the `restore` class. To keep such releases rare, contract steps are batched: they wait for a release that is of the `restore` class anyway, or for an upgrade stop of proposed [ADR 0079][adr-0079], so most releases carry none and are of the `image` class.
* A pull request that adds a `contract` file names the release whose code stopped using what it removes, and review checks it against the schema snapshot.
* A release is of the `restore` class only when nothing else works: a Postgres major or extension update ([ADR 0005][adr-0005]), a third-party schema change without a compatible path (Better Auth's tables, BullMQ's data in Valkey under [ADR 0071][adr-0071]), or a fix that must rewrite data the previous code would misread. Its release notes say why.
* Postgres major upgrades have their own procedure and window, and never share one with a NorthMES upgrade.

### A computed rollback class

CI computes each release's rollback class and schema compatibility number from the markers of every migration file since the previous release, the backfill declarations below, the migrations of the example plugins and the recorded third-party schema changes, and writes both into the release manifest. The release workflow fails when a hand-written value disagrees. `migrate`, the release notes and the Updates page read the class from the manifest in the image only.

### A short window

* A backfill over more than a fixed row count is not a migration file. A migration file registers it as a batched, idempotent background job that runs after `app` starts, in batches with a pause between them, and `northmes_meta.background_migration` records its progress. A backfill keeps the release `image` class only when the old code works with every row in any state the backfill leaves and with every row the new code writes while the job runs, for example by writing a new column the old code ignores. Markers cannot show that, so a backfill's registration declares `previousImageReads: true` only together with a test that runs the previous image's smoke check and data reads on a database where the backfill is halfway and the new code has written rows; CI computes `restore` for a backfill without that declaration or without its passing test. The old image's `migrate` pauses the job and waits for its current batch to commit before the old version serves again. A later release whose code needs it finished declares that, and `migrate --check` refuses until it has finished, naming it. Such a release is an upgrade stop under proposed [ADR 0079][adr-0079].
* Each release manifest carries a migration time budget measured on the large nightly snapshot. The release notes and the Updates page show it, and the operator plans the window from it; the later rehearsal of proposed [ADR 0079][adr-0079] prints the installation's own time beside it. The stop window is bounded by the run's deadline below plus a fixed 15 minutes for the stop, the restore point, the boot and the smoke check, and the release workflow refuses a manifest whose budget times the safety factor plus those 15 minutes reaches 12 hours, half the shortest late window.
* The runner sets one deadline for the whole run, the start time plus the release's budget times a safety factor, and before each file and each statement sets `statement_timeout` to the time left until that deadline. A run that passes the deadline fails, however its time is spread over statements and files, and the operator goes back as ADR 0079 decides, instead of holding the plant for an unknown time. The first run stores the deadline in the `upgrade` row of ADR 0079, and every rerun uses the stored deadline, never a new one. Past it, `migrate` applies no more files and exits 1 naming the way back, so retries cannot stretch the migration beyond the bound above. Under ADR 0079 the whole stack is stopped during an upgrade, with no backend left running, so what remains is the operator's response: the upgrade guide says to go back as soon as `migrate` reports the deadline, and because the bound is at most 12 hours, half the shortest late window, at least 12 hours remain for that before buffered machine data would be refused. `infra/test/upgrade-crash.int.test.ts` checks that going back with the previous line or the restore guide works after an expired deadline.
* `docker compose down` lets running jobs finish inside the 45 s grace period of [ADR 0043][adr-0043]. Jobs still queued in Valkey carry `schema_version` ([ADR 0045][adr-0045]), and the new version accepts the previous version's payloads.

### Before the stop

* `migrate` refuses an image older than the installed release unless the installed release is of the `image` class and the compatibility number fits, which is the rollback of [ADR 0079][adr-0079]; otherwise going back is the restore in the upgrade guide.
* Plugin migrations follow the same markers and lint, checked at install and by `northmes plugin check` ([ADR 0075][adr-0075]).
* Later, with `upgrade.sh` (ADR 0079): the script verifies the image's digest and attestation itself, and checks free disk space against the rehearsal's measured peak plus 20 percent, because an index build or a rewrite can need the size of the table again. In release 1 the upgrade guide gives the verify command, and the restore point needs no disk space for a backup.

### A resumable, audited upgrade

* A dropped connection does not stop an upgrade halfway: `migrate` runs in its own container, not in the operator's shell, and finishes its run. Running `docker compose up -d` again then finishes the upgrade. Every step of `migrate` is safe to run twice, and is recorded only after its side effect: the checks write nothing; the `upgrade` row by its versions; the restore point by `restore_point_at` on that row; each file through `northmes_meta.migration` and the advisory lock ([ADR 0006][adr-0006]); the customer file because it never deletes and changes only what differs ([ADR 0072][adr-0072]); and the security event by an idempotency key of the upgrade and the step, so a replay writes no second event.
* `northmes migrate` writes a security event with the from and to versions, the image digest, the rollback class and the outcome through a `cli` audit context ([ADR 0051][adr-0051]), so every upgrade and every image-class rollback is audited, on the appliance and on a platform alike. A restore writes its own event when the restored database first starts the old version.

### After the start

* The smoke check reads only: `/health/ready`, sign-in with a dedicated health account that holds no role, one read per module through the API, the web's module list and a realtime connection. It writes no command row. In release 1 the nightly tests run it, and the upgrade guide's last step is checking that `/health` reports the new version.
* Later, `upgrade.sh` watches for 30 minutes after the smoke check: readiness, the error rate in the logs and the browser error reports of [ADR 0043][adr-0043]. It prints what it saw and recommends going back on a failure, without doing it.
* For the `image` class, the previous line in `.env` starts the previous version at any time until the next upgrade. For the `restore` class, the upgrade guide restores to the restore point only until the next shift has worked on the new version; after that it names the forward fix, within the 72-hour patch target of [ADR 0038][adr-0038], so a restore never silently drops a day of production. A later `rollback.sh` enforces that deadline.
* The later rehearsal copy of proposed [ADR 0079][adr-0079] holds production data: it stays on a host the customer controls, on an encrypted disk, and is removed on exit and again at the start of the next rehearsal.

### Machine data, stations and displays during the stop

Krister Johansson named machine data as what matters most during an upgrade, and expects the gateway at the machine to keep its own store so that it works offline for a while. That is the model [ADR 0059][adr-0059] already assumes ("gateways buffer during outages and resend late, repeated and out-of-order data"). For the stop to lose nothing:

* While `app` is down and Caddy runs, as during a boot, Caddy answers `/api` and `/graphql` with `503` and a `Retry-After` header, never with the maintenance page's HTML and a `200`, so a gateway or a script never takes the page for an accepted batch. The maintenance page is served only to browsers that ask for HTML.
* The ingestion endpoint is idempotent per sample (series, timestamp and the gateway's sequence number), so a resent batch is stored once.
* Data collection's late window ([ADR 0059][adr-0059]) is at least 24 hours, longer than any upgrade window, so data buffered through the stop is accepted, not refused as `beyond_late_window`.
* The install guide states the requirement on a gateway: a local store for at least 24 hours of its signals, resend with backoff on `503` and on network errors, and in-order resend per series. An MQTT broker that NorthMES reads from runs outside the NorthMES stack, with persistent sessions and QoS 1, so it holds messages while the adapter is down.
* An adapter that polls a machine, such as OPC UA, runs as its own process role or on an edge host with a local buffer, not inside `app`, so it keeps reading while NorthMES is stopped. The Data collection ADR decides where, before the adapter is built.
* Operator stations are online only in release 1 ([ADR 0033][adr-0033]). During the stop an unsent entry stays on the screen and in local storage until the operator sends it, and paper reporting covers the window. The station outage queue that ADR 0033 moves to a later release makes the stop invisible to operators, and becomes more valuable because of this ADR.
* Displays and boards only read. They show the maintenance page, then reconnect and refetch every query ([ADR 0018][adr-0018]), so they lose nothing.

### Consequences

* Good, because most releases carry no contract step and roll back by starting the previous image, without losing a write.
* Good, because a mislabelled release, an older image or a dropped connection no longer turns into a broken installation.
* Good, because the window holds the schema change only, and the operator knows its length before the stop.
* Good, because every upgrade and rollback is in the audit trail.
* Bad, because every upgrade still stops every plant user for the migrations and the boot, and plants report on paper meanwhile.
* Bad, because in release 1 the restore-class deadline and the watch after the start are steps in a guide, not checks in a script.
* Bad, because removing a column takes two releases.
* Bad, because backfills move from SQL files to jobs, which is more code per data change.

### Confirmation

* `rollback-class.test.ts`: a release with one `contract` file computes `restore`, and a manifest that says `image` fails the release workflow; a manifest whose budget times the safety factor plus 15 minutes reaches 12 hours fails it too; a release with a backfill that lacks `previousImageReads: true` and its passing test computes `restore`.
* `migrate-timeout.int.test.ts`: a file that runs past the run's deadline fails, and `northmes_meta.migration` does not record it; three files that each stay under the per-file share but together pass the deadline make the run fail at the third; a run killed and rerun three times keeps the first run's deadline, and a rerun after it applies no file and exits 1.
* `background-migration.int.test.ts`: a registered backfill runs in batches after start and survives a restart halfway; a release that needs it finished is refused by `migrate --check` until it is.
* `infra/test/upgrade-crash.int.test.ts` (nightly): `migrate` is killed between each side effect and the record of it (the `upgrade` row, the restore point, each migration file, the customer file, the security event), and during a file. For an `image`-class release, each time `docker compose up -d` again, or the previous line and `docker compose up -d`, end with a working installation, one restore point, one security event per step and no lost rows. For a `restore`-class release, the guide's restore ends with a working old installation that holds every row from before the restore point, and the test asserts only that. A third case goes back to the previous image while a background backfill is halfway and checks that the job is paused and the old image serves every row, including a row the new code wrote in the new format.
* `infra/test/maintenance.int.test.ts`: with `app` stopped, a POST to the ingestion endpoint and to `/graphql` gets `503` with `Retry-After`, and a browser request for `/` gets the maintenance page.
* `infra/test/upgrade.int.test.ts`: an older image is refused before the restore point when the installed release is of the `restore` class, and names the guide; an upgrade and an image-class rollback each write one security event, also when `migrate` runs twice.
* `infra/test/upgrade-matrix.int.test.ts`, nightly in `nightly.yml`: "the large snapshot upgrades within the release's time budget", with a snapshot at five times pilot scale.

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

* Related ADRs: [0005][adr-0005], [0018][adr-0018], [0033][adr-0033], [0059][adr-0059], [0006][adr-0006], [0038][adr-0038], [0043][adr-0043], [0045][adr-0045], [0051][adr-0051], [0071][adr-0071], [0075][adr-0075], [0079][adr-0079].
* GitLab migration ordering and post-deployment migrations: https://docs.gitlab.com/development/database/migration_ordering/.
* Revisit if the length of upgrade windows becomes a problem for a plant; the blue/green switch is then the next step, because contract steps a release later already make it possible. A rolling upgrade of an `image`-class release over several replicas needs four more things first: a build check that accepts the previous build for one window, workers upgraded before API replicas, plugins in the image or on shared storage, and a nightly test that runs two versions at once against one database.

[adr-0005]: 0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md
[adr-0006]: 0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md
[adr-0038]: 0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md
[adr-0043]: 0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md
[adr-0045]: 0045-backups-restore-drills-upgrades-and-rollback.md
[adr-0051]: 0051-regulated-readiness-no-regret-rules.md
[adr-0071]: 0071-jobs-on-bullmq-with-valkey-and-the-postgres-outbox-as-the-record.md
[adr-0072]: 0072-one-installation-per-customer-and-hosting-partners-run-many-with-a-customer-folder-northmes-apply-and-the-health-endpoints.md
[adr-0075]: 0075-plugin-installs-from-signed-archives-into-a-plugin-volume-with-plugin-screens-loaded-at-run-time.md
[adr-0079]: 0079-upgrade-paths-with-upgrade-stops-a-rehearsal-on-a-restored-copy-and-an-upgrade-matrix-in-ci.md
[adr-0033]: 0033-online-operator-station-in-the-production-start-module.md
[adr-0059]: 0059-time-series-storage-port-with-an-open-default-backend.md
[adr-0018]: 0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md
