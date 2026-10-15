---
status: "proposed"
date: 2026-10-14
decision-makers: proposed by a planning session, to be confirmed by Krister Johansson
consulted: Krister Johansson
informed: contributors, coding agents, pilot IT and hosting partners
release: "1"
needs-confirmation: "maintainer (the support window of the last 3 minors in 0.x; northmes_meta.release; upgrades by NORTHMES_VERSION in .env and docker compose pull, down and up -d, with upgrade.sh, the rehearsal and rollback.sh later; migrate refusing while another version runs; the restore point before the first file; the customer file applied by migrate on every start; seeded snapshots as release assets; stopping instead of warning on an incompatible plugin; web upgrade requests waiting for a trigger; one Updates page with the Plugins page as a tab; notices to users from the host and from company admins; the schema drift check; three ways to host and how each upgrades; the web build as a release asset; the order backend first, then web; plugins from a site image on a platform; a release candidate of each minor from a release branch at least 14 days before the final; the SDK candidate as a release asset until npm publishing; v0.0.1 as the first release, before the version checks, with initial-version 0.0.1 and the adoption of v0.0.1 installations)"
---

# Upgrade paths with upgrade stops, a rehearsal on a restored copy and an upgrade matrix in CI

## Context and problem statement

On 2026-10-14 Krister Johansson asked how an installation upgrades from one NorthMES version to a later one: whether through the CLI, whether a "virtual test" can show that the migrations will work before anything changes, how to go back when something fails, how CI proves that a new release installs and that an older one upgrades to it, and which version jumps are allowed ("1-2-3-4 works, but 2-4 does not, so they do 2-3-4"). In follow-ups he asked whether an admin can start an upgrade from the web, whether the web can tell that it runs against another server version, that the upgrade check names the plugins that only work with an older version, and for a pre-release that a hosting partner can try and that plugin providers build their upgrades against. On 2026-10-15 he asked to start more manually than `upgrade.sh`: the operator edits the version in the Compose files and restarts so that Compose pulls the new image, and the setup comes from a file instead of CLI commands.

[ADR 0045][adr-0045] decides the upgrade and rollback scripts, the backup taken after the app stops, the rollback classes and the schema compatibility number. [ADR 0038][adr-0038] decides one lockstep version and patch releases of the image class. [ADR 0018][adr-0018] decides the stale-tab check, and proposed [ADR 0075][adr-0075] the plugin compatibility check in `upgrade.sh`.

None of them says which "from" versions an upgrade accepts, how an installation learns whether its own data migrates before the downtime, or how CI proves more than the step from N-1 to N. Nothing records the installed release in the database either: `northmes_meta` holds only the `migration` table, and the version comes from the image's `package.json` (`apps/backend/src/version.ts`).

This ADR decides the supported upgrade path and how it is enforced, how a release 1 installation upgrades with Docker Compose, a rehearsal on a restored copy for later, the upgrade tests in CI, who starts an upgrade, the message of the plugin check, and release candidates. It covers `northmes migrate` and `northmes migrate --check`, the `migrate` service and `.env` of the bundle, `northmes_meta`, the release manifest, the release and nightly workflows, System health and the Plugins page.

## Decision drivers

* An upgrade that will fail must fail before any downtime ([ADR 0045][adr-0045]).
* An admin knows from the tool, not only from the release notes, which version to install first.
* The installation's own data, not only a fixture, shows whether the migrations work.
* CI proves every upgrade path the project supports, not only N-1 to N.
* A fresh install and an upgraded installation end with the same schema.
* The `app` container never holds the Docker socket or the owner password ([ADR 0047][adr-0047], [ADR 0006][adr-0006]).
* Krister Johansson's choice: in release 1 an upgrade is an edit of `.env` and the usual `docker compose pull`, `down` and `up -d`, with no upgrade script, and operating NorthMES stays common practice with no black box.
* One developer supports the pilot, so every rule is a script or a check with a test.

## Considered options

* Any supported version upgrades straight to the latest, with declared upgrade stops that `migrate --check` enforces
* One minor at a time, always
* Any version to any later version, with no stops and no window

## Decision outcome

Chosen option: "Any supported version upgrades straight to the latest, with declared upgrade stops that `migrate --check` enforces", because the runner already applies every pending file in order across releases, so most jumps need nothing more, and a stop is declared only when the project needs one, as GitLab, Sentry self-hosted and Mastodon do.

### The upgrade path

* `northmes migrate` writes one row to `northmes_meta.release(version, image_digest, applied_at)` at the end of each successful run. The latest row is the installed release. The first `migrate` on an empty database also writes `northmes_meta.install(version, image_digest, started_at)` in its first transaction, before any migration file. System health and `/health` read it beside the image version.
* The release manifest of [ADR 0045][adr-0045] gains `minimumUpgradeFrom`. In 0.x it is the oldest of the last 3 minors, so an installation on 0.4.x upgrades to 0.7.0 in one step, and one on 0.3.x does not.
* A release becomes an upgrade stop when it squashes migration files into a baseline, when a data migration needs code of a certain version, or when it has to drop something an older release still expects. The next release then sets `minimumUpgradeFrom` to that stop. The first planned stop is 1.0, where 0.x migrations are squashed.
* `northmes migrate --check` compares the installed release with `minimumUpgradeFrom` before boot step 1 and exits 1 with both values and the path: "this installation runs 0.3.2; 0.7.0 upgrades from 0.4.0 or later; install the latest 0.4.x first". This release check reads only `northmes_meta.release` and runs before boot step 1. When it passes, `migrate --check` runs boot steps 1 to 10 as [ADR 0006][adr-0006] decides, where step 5 lists pending files instead of failing on them, and stops before the first file. The row is written from the release after v0.0.1 on, and a v0.0.1 installation is adopted as "The first release comes first" below says. A database that holds an `install` row but no `release` row is a first install that failed partway: `migrate --check` says so, and `docker compose up -d` with the same version resumes it: `migrate` from the image the `install` row names applies the files still pending ([ADR 0006][adr-0006]), and a different image is refused. A database that holds applied migrations and neither row was not installed from a release (a development or test database): `migrate --check` refuses it with exit 1 and names its newest applied file, and no release is guessed from the files. `pnpm upgrade:test --from main` is the way to test such a database.
* Schema drift: the release bundle carries the sorted `pg_dump --schema-only` of each release in the support window. `migrate --check` reads the installation's catalog, compares it with the dump of the installed release, and exits 1 naming each table, column, index, constraint and function that differs, so a change made by hand on production is found before the window and not halfway through a migration. This is the job Prisma's shadow database does on a developer's machine, done here on the installation's own schema; NorthMES needs no shadow database during development, because the runner applies SQL files written by hand instead of generating them from a diff.
* The upgrade guide in `apps/docs` lists the stops, and the release notes state `minimumUpgradeFrom` next to the rollback class.
* Downgrades stay a restore, as [ADR 0045][adr-0045] decides. No release ships down migrations.

### How an installation upgrades in release 1

Release 1 upgrades the way Krister Johansson asked: the operator changes the version and restarts. `upgrade.sh`, its rehearsal and `rollback.sh` of [ADR 0045][adr-0045] move to later. The checks move into the `migrate` service, which runs from the new image however the installation is started.

* Krister Johansson asked on 2026-10-15 that operating NorthMES stay simple and common practice, with no step that feels like a black box. The upgrade therefore uses the commands any self-hosted Compose application documents, and every check prints what it checked.
* The bundle's `.env` holds one line, `NORTHMES_VERSION=0.7.0@sha256:<digest>`, which every NorthMES image in `compose.yaml` reads, as Immich and Plausible keep their version in `.env`. The digest keeps the image pinned ([ADR 0044][adr-0044]), so a tag moved on the registry cannot change what runs; each release's notes give the line to copy and the command that verifies the image's signature. The `db` image stays pinned in `compose.yaml` itself, because it changes rarely, and the Compose check below says when to download a new `compose.yaml`. The site's own changes stay in `compose.override.yaml`, so a release can replace `compose.yaml` without losing them.
* The upgrade is three commands after the edit: `docker compose pull`, `docker compose down`, `docker compose up -d`. `down` stops the whole stack, so no old version runs while the schema changes. `migrate` has `restart: "no"`, and `app` depends on it with `condition: service_completed_successfully`, so `app` starts only when `migrate` exits 0. Before the window, `docker compose run --rm migrate northmes migrate --check` runs the same checks against the new image while the old version keeps serving, so a jump that will fail is found before any downtime. There the running-version check only prints the version it finds, because the old version is expected to be running; the run that migrates refuses it.
* `migrate` on the new image runs in this order and prints each step:
  1. The checks, read only, each exiting 1 with a message that names the way on: the release check above; another version still running, which only a migrating run enforces (a backend of another version wrote its heartbeat to `northmes_meta.instance` in the last 30 seconds: "NorthMES 0.6.2 is still running; run docker compose down first"); the Compose check, which compares the release manifest's `composeVersion` with the `NORTHMES_COMPOSE_VERSION` that `compose.yaml` passes and names the `compose.yaml` to download; an extension older than its `default_version`, naming the one command that updates it in the `db` container ([ADR 0005][adr-0005]); the drift check; the plugin check; and boot steps 1 to 10 ([ADR 0006][adr-0006]). Nothing has changed yet, so putting the previous line back and running `docker compose up -d` starts the old version again.
  2. The restore point. `migrate` writes `northmes_meta.upgrade(from_version, to_version, started_at, deadline, restore_point_at)`, then calls `pg_create_restore_point('northmes-upgrade-<to>')` and `pg_switch_wal()`, which `db bootstrap` grants to `nm_owner` ([ADR 0005][adr-0005]), and prints the point's name and time. With the continuous archive of [ADR 0045][adr-0045], that point is what a failed upgrade restores to, so the upgrade waits for no backup and needs no disk space for one: it is the common "back up before you upgrade" step, done in a second. A rerun creates a point only when `restore_point_at` is empty; a second point of the same name, left by a kill between the two, is harmless, because recovery stops at the first.
  3. The migration. `migrate` applies the pending files with the deadline of proposed [ADR 0081][adr-0081], writes the `release` row, removes the `upgrade` row, applies the customer file of [ADR 0072][adr-0072], writes the security event of ADR 0081 and exits 0. Compose then starts `app`.
* A failure in step 3 leaves the `upgrade` row and the stack stopped. The operator either fixes the cause and runs `docker compose up -d` again, which goes on from the first pending file, or goes back. For a release of the `image` class, going back is the previous line in `.env` and `docker compose up -d`: the old image's `migrate` accepts the newer schema while the compatibility number fits ([ADR 0045][adr-0045]), writes a `release` row for its own version, removes the `upgrade` row and exits 0. For the `restore` class, the upgrade guide restores the database to the restore point with pgBackRest in the `db` container and then starts the previous version; writes after the point are lost, as [ADR 0045][adr-0045] states. An older image refuses a newer schema whose compatibility number does not fit, and names the guide.
* `migrate` also runs on every `docker compose up -d` without a new version: it finds nothing pending, writes no `upgrade` row and applies the customer file, printing each change it made or "no changes", as Grafana's provisioning files and other configuration-as-code tools do. Editing that file and running `docker compose up -d` is how an installation changes its companies, plants, first admins, notices and installation settings, so the guide needs no CLI commands for the setup. This brings the customer file of [ADR 0072][adr-0072] into release 1. The secret files are still written once at install ([ADR 0047][adr-0047]).

### Later: a rehearsal on a restored copy

`migrate --check` proves that the new image composes with the site's config and plugins; it runs no SQL. A migration can still fail on the installation's data (a new unique index over duplicate codes, `not null` over old nulls) or take longer than the window. In release 1 the restore point bounds that risk, and the release notes of a `restore`-class release advise trying it first on a copy restored with the drill procedure of [ADR 0045][adr-0045]. A rehearsal command comes later. Trigger: the first `restore`-class release after the pilot, or a migration that fails on an installation's data.

* `upgrade.sh --rehearse` restores the latest backup into a throwaway database with the drill isolation of [ADR 0045][adr-0045]: archive mode off, the repository read-only, its own Compose project, volumes and an internal network with no egress, integrations off.
* It runs the new image's `plugin check`, `migrate --check` and `migrate` against the copy, boots the app there and runs the smoke check, prints each file's duration and the total, writes the result to `rehearsal-state.json` with the version, the backup label, the time and `peakDiskBytes` (the most bytes the copy and its WAL held at once, sampled each second), and removes the copy.
* `app` keeps serving the plant during a rehearsal. The pre-flight checks the disk space for a second copy and takes the host lock of proposed [ADR 0075][adr-0075].
* A release of the `restore` class then needs a passing rehearsal of that version from the last 72 hours. A rehearsal counts only while its backup label is the newest backup, and the archived WAL after it is what the rehearsal did not see. For the `image` class the rehearsal is optional.

### Upgrade tests in CI

* The release workflow stores a seeded snapshot per release as a release asset, from the first release after v0.0.1 on (v0.0.1's is built from its tag and kept as a CI cache artifact, as "The first release comes first" says): a `pg_dump` of an installation built with that release's CLI and fixtures (companies, plants, articles, orders, audit rows, the example plugins).
* The upgrade matrix restores the snapshot of every release from the candidate's `minimumUpgradeFrom` to the latest, runs the candidate's `migrate`, boots it, runs the smoke check and the data assertions, and checks that the example plugins load. It runs on the release-please pull request and nightly, beside the N-1 to N test of [ADR 0045][adr-0045].
* Fresh equals upgraded: `pg_dump --schema-only` of a fresh install equals that of every upgraded snapshot, after the dump is sorted. A difference fails the test and is printed. It catches the drift that [ADR 0006][adr-0006] avoids by keeping shared SQL helpers out of migrations.
* A snapshot older than `minimumUpgradeFrom` makes `migrate --check` exit 1 with the path, and leaves `northmes_meta` unchanged.
* The fresh install from the offline bundle stays the release verification job of [ADR 0038][adr-0038].

### Who starts an upgrade

* The host runs an upgrade, with `docker compose up -d`, in release 1. The web cannot: replacing its own image, stopping itself, backing up and migrating as `nm_owner` would need the Docker socket and the owner password in `app`, and there is no role above a company ([ADR 0066][adr-0066]). [ADR 0011][adr-0011] rejected a web setup route for the same reason.
* System health shows the installed release, a newer release when the installation knows of one (from a bundle on the host or an optional update check), its rollback class and `minimumUpgradeFrom`. It is read-only.
* One settings page, Updates (name proposed), holds both: a NorthMES tab with the installed release, a newer release, the path to it, its rollback class, the two lines to run and which plugins have a version for it, and a Plugins tab that is the Plugins page of proposed [ADR 0075][adr-0075]. Plugin compatibility belongs with the release it blocks. System health keeps a one-line summary that links to it. Its route, permission and layout come from a design task (E18-S16); in release 1 the NorthMES tab is read-only.
* Later, an admin may request an upgrade in the web the way proposed [ADR 0075][adr-0075] requests a plugin install: an audited request row that a host timer applies in the upgrade window, with the result written back. An installation setting that only the customer file sets turns web requests off, so a hosting partner keeps upgrades to itself. Trigger: a customer without host access asks for it.

### Three ways to host, and how each upgrades

The backend and the database carry the upgrade; the web is a static build that follows them. [ADR 0070][adr-0070] already lets any static host serve the web build, with the API's URL in its `config.json`, a bearer JWT instead of a cookie and CORS only for the `webOrigins` in `northmes.config.json`, and [ADR 0075][adr-0075] has the CSP set by whichever host serves it. Each release is published as three artifacts with digests and attestations: the bundle of [ADR 0044][adr-0044], the backend image, and the web build as `northmes-web-<version>.tar.gz`.

* **The appliance** (the supported default in release 1): the bundle on one host with Docker Compose ([ADR 0044][adr-0044]). The new line in `.env` and `docker compose pull`, `down` and `up -d` upgrade the backend, the database and the web build that Caddy serves in one step, with the restore point as the way back. This is the way to host for an operator who wants to install a new version and nothing more.
* **Your own platform from the published artifacts**: the backend image on a container platform, the web build on any static host such as Azure Static Web Apps or a CDN, and the database on an existing or managed Postgres 18 server set up with `northmes db bootstrap` ([ADR 0005][adr-0005]). The checks and `migrate` run from the backend image and need only a Postgres connection. The restore through pgBackRest runs inside the `db` image, so here the upgrade guide gives the same steps with the provider's tools: take a snapshot or note the time after the backend stops, try the new `migrate` on a clone if the release is of the `restore` class, and go back by the provider's point-in-time restore to the time `migrate` printed before its first file. The order is the backend first, then the web build of the same version. Between the two the web still runs the old build, so the build check of [ADR 0018][adr-0018] lets queries through and refuses mutations with `core.client_outdated`. When a reload still serves the old build, the shell stops reloading and says that the web host has not been updated yet, naming both versions.
  * Several backend replicas and several web hosts are allowed, because the backend already follows the multi-replica rules of [ADR 0002][adr-0002]: replicas never migrate, boot refuses a pending file, and migrations run once in a separate step under the advisory lock of [ADR 0006][adr-0006]. Only the wrapper of that step changes: a Kubernetes Job or Helm pre-upgrade hook, an Azure Container Apps manual job, an ECS one-off task. Release 1 describes these in the written upgrade guide only and ships no example manifests, Helm chart or templates (Krister Johansson, 2026-10-15). It runs the new image, and only it gets the owner secret; an init container or a replica that migrates at boot is not supported.
  * Every upgrade in release 1 stops every backend replica, workers included: scale to zero, run the migrate job, scale up. Krister Johansson confirmed this on 2026-10-15. It is the stop of [ADR 0045][adr-0045] that he chose to keep, applied to N replicas, and it keeps the build check of [ADR 0018][adr-0018] correct, because that check compares builds for equality and is right only while one backend version runs. All replicas and the migrate job run the same image digest.
  * The migrate job reads its own database URL, which must be a direct connection: the migration lock is a session lock, so a pooler in transaction mode, such as a managed service's built-in PgBouncer, would lose it.
  * Plugins come only from a site image built `FROM` the official image ([ADR 0037][adr-0037]) on such a platform in release 1, because the plugin volume and its host timer of [ADR 0075][adr-0075] assume one host. The migrate job runs that site image, because migrate loads plugin migrations.
  * A managed Postgres has two more steps in the guide: its point-in-time restore creates a new server with a new host name, and an extension update is a manual step on the provider's allow-list instead of the bootstrap step of [ADR 0045][adr-0045].
* **Without Docker**, as a Node process under systemd or PM2: not supported in release 1. The `northmes` CLI stays runnable with plain Node, so a later shape is a built Node tarball with systemd units, with the same separate migrate step. Trigger: a customer who cannot run containers asks for it; none had by 2026-10-15.
* **A fork built from source**: the project supports upgrades from released artifacts only. A fork that edits a core migration or a core table breaks the upgrade path, and the drift check names what differs. The supported way to add behaviour is a plugin ([ADR 0037][adr-0037], [ADR 0075][adr-0075]), which keeps the upgrade path. Under the AGPL, a fork offered to users over a network must offer them its source ([ADR 0039][adr-0039]).

### Notices to users

* A notice is a short plain-text message with a severity (info or warning), a time to show from and a time to end, such as "Planned maintenance 2026-11-10 12:40 to 13:50". The shell draws it in the banner strip under the top bar, from the same `BannerSpec` data as its own banners, for every signed-in user it reaches, and removes it at its end time. It holds no link and no markup.
* No role sits above a company ([ADR 0066][adr-0066]), so an installation-wide notice belongs to the host like the other installation-wide values: the customer file lists it, and `migrate` applies the list as audited commands on the next `docker compose up -d`. A company admin with `core.notice:manage` (name proposed) posts a notice to their own company's users from company settings, also audited. Both kinds show on the Updates page.
* During the stop itself NorthMES does not answer, so a notice is how users learn of the window before it starts.

### Plugins and open tabs

* The plugin check of proposed [ADR 0075][adr-0075] stays a stop, not a warning, because a server plugin that fails its range check stops boot ([ADR 0038][adr-0038]). Its message names each plugin, its version, its NorthMES range from `northmes-plugin.json` and the way on: "Upgrade to 0.6.0 stopped: acme-labels 1.4.0 supports >=0.5.0 <0.6.0 and has no newer version in its index; shopfloor-kpi 2.1.0 supports >=0.5.0 <0.6.0, and 2.2.0 supports 0.6.0 (update it on the Plugins page first)."
* System health and the Plugins page warn early: "2 plugins have no version for 0.6.0", once the installation knows of that release, so the admin asks the plugin's vendor before the window.
* A tab that loaded an older build is handled by [ADR 0018][adr-0018]: the build header, the reload dialog and `core.client_outdated` on a mutation. Since the web and the image come from one bundle, the check compares for equality, which also catches a newer web in front of an older server after a rollback. Under proposed [ADR 0070][adr-0070] the hash in the header is the schema snapshot's hash.

### Release candidates

A minor release breaks plugins in 0.x ([ADR 0038][adr-0038]), so plugin providers and hosting partners need the next minor before the plant does.

* Every minor release has at least one release candidate, `X.Y.0-rc.N`, at least 14 days before the final. Patch releases have none, because they are image-only.
* The candidate is cut from a release branch `release/X.Y`, which release-please targets for the candidates and the final. Only fixes reach that branch, cherry-picked from `main`, so what a provider tests is what ships; `main` goes on towards the next minor.
* The release workflow builds, signs and attests a candidate as it does a final, publishes it as a GitHub pre-release, tags images `X.Y.0-rc.N` only (never `X.Y` or `latest`), and attaches the offline bundle, the seeded snapshot and the SDK packages as tarballs. Once the MIT packages are on npm, the candidate SDK goes under the `next` dist-tag.
* The candidate's release notes carry a "for plugin providers" part: the API Extractor report changes, the GraphQL schema diff, the event schema diff and the extension points that changed or were removed, from the reports ADR 0038 already writes.
* A plugin provider builds against the candidate SDK. Its range, `>=X.Y.0-0 <X.(Y+1).0-0`, accepts the candidates and the final, so the version it publishes during the candidate period installs on the final unchanged. A plugin index may list such versions marked `prerelease`, and the Plugins page shows them only where the installation setting `plugins.allowPrerelease` is on.
* A hosting partner or customer tries a candidate on a staging installation, or on a copy of production restored with the drill procedure. Installing one means writing its version on purpose, and System health shows "running a release candidate". The upgrade matrix covers the upgrade from the last candidate to the final, so a staging installation upgrades on.
* The final is the last candidate with only the version changed when no fix landed in between; otherwise it gets another candidate unless the fixes are image-only.

### The first release comes first

The first release is v0.0.1 (Krister, 2026-10-15). It ships what the later work tests against: the release images built in CI (E18-S01), the install from them (E18-S02), the Updates page with the installed release and the Plugins tab (E18-S16) and the example plugins. The version checks and upgrade tests of this ADR and [ADR 0081][adr-0081] start after v0.0.1 is published, so they work against a real release instead of one imagined from `main`.

* A v0.0.1 installation has no `northmes_meta.release` row. The first `migrate` with the release check adopts it: it records v0.0.1 only when the database's applied migration files equal the list in v0.0.1's release manifest, and otherwise refuses as it refuses any database with migrations and no row. Nothing is guessed from a partial match.
* v0.0.1 is published before `pnpm upgrade:seed` exists and its release is immutable, so its snapshot is not a release asset: the upgrade matrix builds it from the `v0.0.1` tag and keeps it as a CI cache artifact.

### Changes to ADR 0038

ADR 0038 is accepted, so its text stays as it was. This ADR replaces one value in it, and the rest of ADR 0038 stands.

| ADR 0038 | Replaced by |
|---|---|
| release-please `initial-version: 0.1.0` | `initial-version: 0.0.1`, so the first release is v0.0.1; `bump-minor-pre-major` stays, so a later `feat` raises the minor |

### Changes to ADR 0044

ADR 0044 is accepted, so its text stays as it was. This ADR replaces one part of it, and the rest of ADR 0044 stands.

| ADR 0044 | Replaced by |
|---|---|
| The `migrate` row's last column: "`restart: "no"`; `install.sh` and `upgrade.sh` run it explicitly with `docker compose run --rm migrate`" | `restart: "no"`; it runs on every `docker compose up`, and `app` depends on it with `condition: service_completed_successfully`. The CLI commands that remain run with `docker compose run --rm migrate` |

### Changes to ADR 0005

ADR 0005 is accepted, so its text stays as it was. This ADR replaces two parts of it and adds one, and the rest of ADR 0005 stands.

| ADR 0005 | Replaced by |
|---|---|
| Extension updates: "`upgrade.sh` runs extension updates as `docker compose exec -T db psql -U postgres` over the local socket, before migrate, for every extension whose `extversion` is older than its `default_version`." | One command in the `db` image, `docker compose exec -T db northmes-db-extensions` (name proposed), runs them as `postgres` over the local socket. `migrate` refuses while an extension is older than its `default_version` and names the command. The rest of that paragraph stands |
| The extension update test: "after the `upgrade.sh` extension step" | after `northmes-db-extensions` |
| (added to the superuser bootstrap) | The init script and `northmes db bootstrap` grant `nm_owner` `EXECUTE` on `pg_create_restore_point(text)` and `pg_switch_wal()`, and nothing else beyond [ADR 0006][adr-0006], so `migrate` sets the restore point without the superuser |

### Consequences

* Good, because an admin who skips too far is stopped before downtime with the version to install first.
* Good, because an upgrade is a version edit and the Compose commands operators already know, and every check runs from the new image however it is started and prints what it checked.
* Good, because the restore point needs no backup step and no disk space for one.
* Bad, because without a rehearsal in release 1, a migration that fails on the installation's data is found in the window, and the operator goes back through the guide's pgBackRest steps instead of one script.
* Bad, because the stack is down for the whole migration, so users see no maintenance page; a notice announces the window, and gateways resend after it ([ADR 0081][adr-0081]).
* Good, because CI proves every supported path and that a fresh and an upgraded installation have the same schema.
* Good, because the logic that reads the database lives in the CLI and is tested with Testcontainers, and a later `upgrade.sh` only wraps `docker compose`.
* Bad, because the release workflow keeps a snapshot per release and the matrix grows with the window.
* Good, because plugin providers have at least 14 days with the next minor before plants can upgrade.
* Bad, because in 0.x every minor upgrade stops on each plugin until it is rebuilt.
* Bad, because a release branch per minor means cherry-picking fixes from `main`.

### Confirmation

* `migrate-release.int.test.ts`: a successful `migrate` writes one `northmes_meta.release` row with the image version; a failed run writes none; a first install that fails after its second file is resumed by `migrate` from the same image and ends with one `release` row; a database with `northmes_meta.migration` rows and no `northmes_meta.release` row makes `migrate --check` exit 1 naming its newest applied file, and changes nothing.
* `e2e/web-lag.spec.ts`: a web on build A against a backend on build B shows the reload dialog, and after a reload that still serves build A it shows that the web host has not been updated, names both versions and sends no mutation.
* `migrate-check-drift.int.test.ts`: a column added by hand to an installation at 0.4.1 makes `migrate --check` exit 1 naming the column, before any file runs; without it the check passes.
* `migrate-check-path.int.test.ts`: with `minimumUpgradeFrom` 0.4.0, a database at 0.3.2 exits 1 naming 0.3.2, 0.4.0 and the path before boot step 1 runs, and `northmes_meta` is unchanged; at 0.4.1 it goes on through boot step 5, lists a pending file, applies none, and `northmes_meta` is unchanged.
* `migrate-running.int.test.ts`: with a heartbeat from a backend at version A in the last 30 seconds, `migrate` at B exits 1 naming A and `docker compose down`, and writes nothing; with a heartbeat older than that it goes on.
* `infra/test/compose-upgrade.int.test.ts` (nightly): with the bundle at N-1 and rows written, the line of N in `.env` and `docker compose pull`, `down` and `up -d` end with N serving and every row present; `migrate --check` run beside a serving N-1 changes nothing; `up -d` without `down` exits 1 naming the running version; a fixture file that fails halfway leaves the stack stopped, and the guide's restore to `northmes-upgrade-<N>` followed by N-1 brings back every row written before the point; for an `image`-class release, the line of N-1 and `docker compose up -d` serve again without a restore; `docker compose up -d` with no new version applies an edited customer file.
* `infra/test/upgrade-matrix.int.test.ts` (release pull request and nightly): every snapshot from `minimumUpgradeFrom` upgrades, boots and passes the smoke check; the sorted schema dump equals a fresh install's.
* `test/meta/release-workflow.test.ts`: a candidate tag publishes a pre-release whose images carry no `X.Y` or `latest` tag; System health shows "running a release candidate" on `0.6.0-rc.1`.
* `plugin-check.test.ts`: an installed plugin whose range excludes the new release prints its id, version and range, and `migrate` exits 1 before it writes the `upgrade` row or the restore point.

## Pros and cons of the options

### Any supported version to the latest, with declared stops

* Good, because most installations upgrade in one step.
* Good, because a stop costs nothing until the project needs one.
* Bad, because the matrix test must cover the whole window.

### One minor at a time, always

* Good, because CI only tests N-1 to N.
* Bad, because an installation three minors behind needs three windows, three backups and three rehearsals, as Nextcloud's one-major rule requires.

### Any version to any later version

* Good, because there is nothing to declare.
* Bad, because no test covers every old version, so an untested path fails on the plant; squashing migrations at 1.0 would be impossible.

## More information

* Related ADRs: [0002][adr-0002] multi-replica rules, [0005][adr-0005] `db bootstrap` on an existing server, [0006][adr-0006] runner and `migrate --check`, [0011][adr-0011] no web setup route, [0018][adr-0018] stale tabs, [0037][adr-0037] drop-in plugins, [0038][adr-0038] versions and patch releases, [0039][adr-0039] AGPL, [0043][adr-0043] grace period, [0044][adr-0044] one Compose host, [0045][adr-0045] upgrade, rollback, drills and the compatibility number, [0047][adr-0047] secrets per service, [0066][adr-0066] no role above a company, [0070][adr-0070] one schema and the static web build, [0072][adr-0072] upgrades per installation, [0075][adr-0075] plugin check and the host lock.
* Plan: [14 roadmap](../plan/14-roadmap.md) epic E18, [12 operations and security](../plan/12-operations-and-security.md).
* GitLab upgrade paths: https://docs.gitlab.com/update/upgrade_paths. GitLab migration ordering: https://docs.gitlab.com/development/database/migration_ordering/. Sentry self-hosted hard stops: https://forum.sentry.io/t/upgrading-from-21-6-x-to-21-7-0-fails-with-error-it-looks-like-youve-skipped-a-hard-stop-in-our-upgrade-process/14754. Nextcloud upgrades: https://docs.nextcloud.com/server/14/admin_manual/maintenance/upgrade.html.
* The `northmes` range of [ADR 0038][adr-0038], `>=X.Y.0-0 <X.(Y+1).0-0`, admits the candidates of its own minor and refuses those of the next, which is what lets a plugin built against a candidate run on the final without a rebuild.
* Before this ADR is accepted, the proposed ADRs it changes are updated: [0045][adr-0045] (`upgrade.sh`, `rollback.sh` and the upgrade's own backup move to later; the restore point instead of that backup), [0072][adr-0072] (the customer file in release 1, applied on every start) and [0066][adr-0066] (the setup from the customer file), and the plan pages that describe `upgrade.sh` ([02 architecture](../plan/02-architecture.md), [03 modules and extensibility](../plan/03-modules-and-extensibility.md), [04 data and platform](../plan/04-data-and-platform.md), [12 operations and security](../plan/12-operations-and-security.md) and [17 risks](../plan/17-risks.md)).
* Revisit at 1.0 (the first squash and stop, the support window after 1.0 of [ADR 0038][adr-0038]), when a customer without host access asks for web upgrades, when a second replica allows upgrades without downtime, or when operators ask for a scripted or scheduled upgrade, which brings `upgrade.sh` back as a wrapper of `docker compose`.

[adr-0002]: 0002-modular-monolith-with-module-owned-schemas-and-process-roles.md
[adr-0005]: 0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md
[adr-0006]: 0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md
[adr-0011]: 0011-principals-credentials-and-same-origin-rules.md
[adr-0018]: 0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md
[adr-0037]: 0037-plugins-drop-in-packages-command-validators-and-ui-slots.md
[adr-0038]: 0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md
[adr-0039]: 0039-license-agpl-3-0-or-later-core-and-a-contributor-license-agreement.md
[adr-0043]: 0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md
[adr-0044]: 0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md
[adr-0045]: 0045-backups-restore-drills-upgrades-and-rollback.md
[adr-0047]: 0047-secrets-and-the-installation-key.md
[adr-0066]: 0066-companies-created-by-the-cli-plant-slugs-unique-per-installation-company-settings-at-settings-and-an-onboarding-wizard-before-a-plant-opens.md
[adr-0070]: 0070-one-nestjs-backend-with-one-graphql-schema-and-one-static-web-app.md
[adr-0072]: 0072-one-installation-per-customer-and-hosting-partners-run-many-with-a-customer-folder-northmes-apply-and-the-health-endpoints.md
[adr-0075]: 0075-plugin-installs-from-signed-archives-into-a-plugin-volume-with-plugin-screens-loaded-at-run-time.md
[adr-0081]: 0081-safer-upgrades-with-contract-steps-a-release-later-a-computed-rollback-class-and-a-resumable-audited-upgrade.md
