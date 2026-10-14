---
status: "proposed"
date: 2026-10-14
decision-makers: proposed by a planning session, to be confirmed by Krister Johansson
consulted: Krister Johansson
informed: contributors, coding agents, pilot IT and hosting partners
release: "1"
needs-confirmation: "maintainer (the support window of the last 3 minors in 0.x; northmes_meta.release; the rehearsal as a requirement for the restore class; seeded snapshots as release assets; stopping instead of warning on an incompatible plugin; web upgrade requests waiting for a trigger; one Updates page with the Plugins page as a tab; notices to users from the host and from company admins; a release candidate of each minor from a release branch at least 14 days before the final; the SDK candidate as a release asset until npm publishing)"
---

# Upgrade paths with upgrade stops, a rehearsal on a restored copy and an upgrade matrix in CI

## Context and problem statement

On 2026-10-14 Krister Johansson asked how an installation upgrades from one NorthMES version to a later one: whether through the CLI, whether a "virtual test" can show that the migrations will work before anything changes, how to go back when something fails, how CI proves that a new release installs and that an older one upgrades to it, and which version jumps are allowed ("1-2-3-4 works, but 2-4 does not, so they do 2-3-4"). In follow-ups he asked whether an admin can start an upgrade from the web, whether the web can tell that it runs against another server version, that the upgrade check names the plugins that only work with an older version, and for a pre-release that a hosting partner can try and that plugin providers build their upgrades against.

[ADR 0045][adr-0045] decides the upgrade and rollback scripts, the backup taken after the app stops, the rollback classes and the schema compatibility number. [ADR 0038][adr-0038] decides one lockstep version and patch releases of the image class. [ADR 0018][adr-0018] decides the stale-tab check, and proposed [ADR 0075][adr-0075] the plugin compatibility check in `upgrade.sh`. None of them says which "from" versions an upgrade accepts, how an installation learns whether its own data migrates before the downtime, or how CI proves more than the step from N-1 to N. Nothing records the installed release in the database either: `northmes_meta` holds only the `migration` table, and the version comes from the image's `package.json` (`apps/backend/src/version.ts`).

This ADR decides the supported upgrade path and how it is enforced, a rehearsal of the upgrade on a restored copy, the upgrade tests in CI, who starts an upgrade, the message of the plugin check, and release candidates. It covers `northmes migrate` and `northmes migrate --check`, `northmes_meta`, the release manifest, `upgrade.sh`, the release and nightly workflows, System health and the Plugins page.

## Decision drivers

* An upgrade that will fail must fail before any downtime ([ADR 0045][adr-0045]).
* An admin knows from the tool, not only from the release notes, which version to install first.
* The installation's own data, not only a fixture, shows whether the migrations work.
* CI proves every upgrade path the project supports, not only N-1 to N.
* A fresh install and an upgraded installation end with the same schema.
* The `app` container never holds the Docker socket or the owner password ([ADR 0047][adr-0047], [ADR 0006][adr-0006]).
* One developer supports the pilot, so every rule is a script or a check with a test.

## Considered options

* Any supported version upgrades straight to the latest, with declared upgrade stops that `migrate --check` enforces
* One minor at a time, always
* Any version to any later version, with no stops and no window

## Decision outcome

Chosen option: "Any supported version upgrades straight to the latest, with declared upgrade stops that `migrate --check` enforces", because the runner already applies every pending file in order across releases, so most jumps need nothing more, and a stop is declared only when the project needs one, as GitLab, Sentry self-hosted and Mastodon do.

### The upgrade path

* `northmes migrate` writes one row to `northmes_meta.release(version, image_digest, applied_at)` at the end of each successful run. The latest row is the installed release. System health and `/health` read it beside the image version.
* The release manifest of [ADR 0045][adr-0045] gains `minimumUpgradeFrom`. In 0.x it is the oldest of the last 3 minors, so an installation on 0.4.x upgrades to 0.7.0 in one step, and one on 0.3.x does not.
* A release becomes an upgrade stop when it squashes migration files into a baseline, when a data migration needs code of a certain version, or when it has to drop something an older release still expects. The next release then sets `minimumUpgradeFrom` to that stop. The first planned stop is 1.0, where 0.x migrations are squashed.
* `northmes migrate --check` compares the installed release with `minimumUpgradeFrom` before boot step 1 and exits 1 with both values and the path: "this installation runs 0.3.2; 0.7.0 upgrades from 0.4.0 or later; install the latest 0.4.x first". This release check reads only `northmes_meta.release` and runs before boot step 1. When it passes, `migrate --check` runs boot steps 1 to 10 as [ADR 0006][adr-0006] decides, where step 5 lists pending files instead of failing on them, and stops before the first file. The row is written from the first release on, because the story that adds it lands before 0.1.0, so every installation made from a release has one. A database that holds applied migrations but no `northmes_meta.release` row was never installed from a release (a development or test database): `migrate --check` refuses it with exit 1 and names its newest applied file, and no release is guessed from the files. `pnpm upgrade:test --from main` is the way to test such a database.
* The upgrade guide in `apps/docs` lists the stops, and the release notes state `minimumUpgradeFrom` next to the rollback class.
* Downgrades stay a restore, as [ADR 0045][adr-0045] decides. No release ships down migrations.

### Rehearsal on a restored copy

`migrate --check` proves that the new image composes with the site's config and plugins; it runs no SQL. A migration can still fail on the installation's data (a new unique index over duplicate codes, `not null` over old nulls) or take longer than the window.

* `upgrade.sh --rehearse` restores the latest backup into a throwaway database with the drill isolation of [ADR 0045][adr-0045]: archive mode off, the repository read-only, its own Compose project, volumes and an internal network with no egress, integrations off.
* It runs the new image's `plugin check`, `migrate --check` and `migrate` against the copy, boots the app there and runs the smoke check, prints each file's duration and the total, writes the result to `rehearsal-state.json` with the version, the backup label, the time and `peakDiskBytes` (the most bytes the copy and its WAL held at once, sampled each second), and removes the copy.
* `app` keeps serving the plant during a rehearsal. The pre-flight checks the disk space for a second copy and takes the host lock of proposed [ADR 0075][adr-0075].
* `upgrade.sh` refuses a release of the `restore` class without a passing rehearsal of that version from the last 72 hours, and names the command. A rehearsal counts only while its backup label is the newest backup; a newer backup makes it stale, so the upgrade's own backup must follow the rehearsed one with no other backup between them, and the archived WAL between the two is what the rehearsal did not see. For the `image` class the rehearsal is optional. This replaces "a version with no recorded staging pass is refused" in [ADR 0045][adr-0045] with a check the installation runs itself.

### Upgrade tests in CI

* The release workflow stores a seeded snapshot per release as a release asset: a `pg_dump` of an installation built with that release's CLI and fixtures (companies, plants, articles, orders, audit rows, the example plugins).
* The upgrade matrix restores the snapshot of every release from the candidate's `minimumUpgradeFrom` to the latest, runs the candidate's `migrate`, boots it, runs the smoke check and the data assertions, and checks that the example plugins load. It runs on the release-please pull request and nightly, beside the N-1 to N test of [ADR 0045][adr-0045].
* Fresh equals upgraded: `pg_dump --schema-only` of a fresh install equals that of every upgraded snapshot, after the dump is sorted. A difference fails the test and is printed. It catches the drift that [ADR 0006][adr-0006] avoids by keeping shared SQL helpers out of migrations.
* A snapshot older than `minimumUpgradeFrom` makes `migrate --check` exit 1 with the path, and leaves `northmes_meta` unchanged.
* The fresh install from the offline bundle stays the release verification job of [ADR 0038][adr-0038].

### Who starts an upgrade

* The host runs an upgrade, through `upgrade.sh`, in release 1. The web cannot: replacing its own image, stopping itself, backing up and migrating as `nm_owner` would need the Docker socket and the owner password in `app`, and there is no role above a company ([ADR 0066][adr-0066]). [ADR 0011][adr-0011] rejected a web setup route for the same reason.
* System health shows the installed release, a newer release when the installation knows of one (from a bundle on the host or an optional update check), its rollback class, `minimumUpgradeFrom` and the last rehearsal result. It is read-only.
* One settings page, Updates (name proposed), holds both: a NorthMES tab with the installed release, a newer release, the path to it, its rollback class, the last rehearsal and which plugins have a version for it, and a Plugins tab that is the Plugins page of proposed [ADR 0075][adr-0075]. Plugin compatibility belongs with the release it blocks, and the proposed `upgrade.sh --with-plugin-updates` of ADR 0075 applies the core upgrade and the plugin updates as one set. System health keeps a one-line summary that links to it. Its route, permission and layout come from a design task (E18-S16); in release 1 the NorthMES tab is read-only.
* Later, an admin may request an upgrade in the web the way proposed [ADR 0075][adr-0075] requests a plugin install: an audited request row that a host timer applies in the upgrade window, rehearsal first, with the result written back. An installation setting that only `northmes installation set` changes turns web requests off, so a hosting partner keeps upgrades to itself. Trigger: a customer without host access asks for it.

### Notices to users

* A notice is a short plain-text message with a severity (info or warning), a time to show from and a time to end, such as "Planned maintenance 2026-11-10 12:40 to 13:50". The shell draws it in the banner strip under the top bar, from the same `BannerSpec` data as its own banners, for every signed-in user it reaches, and removes it at its end time. It holds no link and no markup.
* No role sits above a company ([ADR 0066][adr-0066]), so an installation-wide notice belongs to the host like the other installation-wide values: `northmes notice add|list|remove` (names proposed) writes it as an audited command, and `upgrade.sh --schedule <time>` (later) adds the maintenance notice for its window by itself. A company admin with `core.notice:manage` (name proposed) posts a notice to their own company's users from company settings, also audited. Both kinds show on the Updates page.
* During the stop itself the maintenance page of [ADR 0045][adr-0045] answers, so a notice is how users learn of the window before it starts.

### Plugins and open tabs

* The plugin check of proposed [ADR 0075][adr-0075] stays a stop, not a warning, because a server plugin that fails its range check stops boot ([ADR 0038][adr-0038]). Its message names each plugin, its version, its NorthMES range from `northmes-plugin.json` and the way on: "Upgrade to 0.6.0 stopped: acme-labels 1.4.0 supports >=0.5.0 <0.6.0 and has no newer version in its index; shopfloor-kpi 2.1.0 supports >=0.5.0 <0.6.0, and 2.2.0 supports 0.6.0 (run with --with-plugin-updates)."
* System health and the Plugins page warn early: "2 plugins have no version for 0.6.0", once the installation knows of that release, so the admin asks the plugin's vendor before the window.
* A tab that loaded an older build is handled by [ADR 0018][adr-0018]: the build header, the reload dialog and `core.client_outdated` on a mutation. Since the web and the image come from one bundle, the check compares for equality, which also catches a newer web in front of an older server after a rollback. Under proposed [ADR 0070][adr-0070] the hash in the header is the schema snapshot's hash.

### Release candidates

A minor release breaks plugins in 0.x ([ADR 0038][adr-0038]), so plugin providers and hosting partners need the next minor before the plant does.

* Every minor release has at least one release candidate, `X.Y.0-rc.N`, at least 14 days before the final. Patch releases have none, because they are image-only.
* The candidate is cut from a release branch `release/X.Y`, which release-please targets for the candidates and the final. Only fixes reach that branch, cherry-picked from `main`, so what a provider tests is what ships; `main` goes on towards the next minor.
* The release workflow builds, signs and attests a candidate as it does a final, publishes it as a GitHub pre-release, tags images `X.Y.0-rc.N` only (never `X.Y` or `latest`), and attaches the offline bundle, the seeded snapshot and the SDK packages as tarballs. Once the MIT packages are on npm, the candidate SDK goes under the `next` dist-tag.
* The candidate's release notes carry a "for plugin providers" part: the API Extractor report changes, the GraphQL schema diff, the event schema diff and the extension points that changed or were removed, from the reports ADR 0038 already writes.
* A plugin provider builds against the candidate SDK. Its range, `>=X.Y.0-0 <X.(Y+1).0-0`, accepts the candidates and the final, so the version it publishes during the candidate period installs on the final unchanged. A plugin index may list such versions marked `prerelease`, and the Plugins page shows them only where the installation setting `plugins.allowPrerelease` is on.
* A hosting partner or customer tries a candidate on a staging installation, or with `upgrade.sh --rehearse` against a copy of production. `upgrade.sh` refuses a candidate on an installation unless `--allow-prerelease` is passed, and System health shows "running a release candidate". The upgrade matrix covers the upgrade from the last candidate to the final, so a staging installation upgrades on.
* The final is the last candidate with only the version changed when no fix landed in between; otherwise it gets another candidate unless the fixes are image-only.

### Consequences

* Good, because an admin who skips too far is stopped before downtime with the version to install first.
* Good, because the rehearsal shows on the installation's own data whether the migrations work and how long they take, while the plant keeps working.
* Good, because CI proves every supported path and that a fresh and an upgraded installation have the same schema.
* Good, because the logic that reads the database lives in the CLI and is tested with Testcontainers, and `upgrade.sh` stays a thin script that a later `northmes upgrade` can wrap.
* Bad, because a rehearsal needs disk space for a second copy of the database.
* Bad, because the release workflow keeps a snapshot per release and the matrix grows with the window.
* Good, because plugin providers have at least 14 days with the next minor before plants can upgrade.
* Bad, because in 0.x every minor upgrade stops on each plugin until it is rebuilt.
* Bad, because a release branch per minor means cherry-picking fixes from `main`.

### Confirmation

* `migrate-release.int.test.ts`: a successful `migrate` writes one `northmes_meta.release` row with the image version; a failed run writes none; a database with `northmes_meta.migration` rows and no `northmes_meta.release` row makes `migrate --check` exit 1 naming its newest applied file, and changes nothing.
* `migrate-check-path.int.test.ts`: with `minimumUpgradeFrom` 0.4.0, a database at 0.3.2 exits 1 naming 0.3.2, 0.4.0 and the path before boot step 1 runs, and `northmes_meta` is unchanged; at 0.4.1 it goes on through boot step 5, lists a pending file, applies none, and `northmes_meta` is unchanged.
* `infra/test/rehearse.int.test.ts` (nightly): a rehearsal with a fixture migration that adds a unique index over duplicate codes reports the failing file and leaves the production database and its archive unchanged; a passing rehearsal writes `rehearsal-state.json` with `peakDiskBytes`; `upgrade.sh` refuses a `restore`-class release without one, and refuses it again after a newer backup is taken.
* `infra/test/upgrade-matrix.int.test.ts` (release pull request and nightly): every snapshot from `minimumUpgradeFrom` upgrades, boots and passes the smoke check; the sorted schema dump equals a fresh install's.
* `test/meta/release-workflow.test.ts`: a candidate tag publishes a pre-release whose images carry no `X.Y` or `latest` tag; `upgrade.sh` refuses `0.6.0-rc.1` without `--allow-prerelease`.
* `plugin-check.test.ts`: an installed plugin whose range excludes the new release prints its id, version and range, and `upgrade.sh` stops before the maintenance page.

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

* Related ADRs: [0006][adr-0006] runner and `migrate --check`, [0011][adr-0011] no web setup route, [0018][adr-0018] stale tabs, [0038][adr-0038] versions and patch releases, [0045][adr-0045] upgrade, rollback, drills and the compatibility number, [0047][adr-0047] secrets per service, [0066][adr-0066] no role above a company, [0070][adr-0070] one schema, [0072][adr-0072] upgrades per installation, [0075][adr-0075] plugin check and the host lock.
* Plan: [14 roadmap](../plan/14-roadmap.md) epic E18, [12 operations and security](../plan/12-operations-and-security.md).
* GitLab upgrade paths: https://docs.gitlab.com/update/upgrade_paths. GitLab migration ordering: https://docs.gitlab.com/development/database/migration_ordering/. Sentry self-hosted hard stops: https://forum.sentry.io/t/upgrading-from-21-6-x-to-21-7-0-fails-with-error-it-looks-like-youve-skipped-a-hard-stop-in-our-upgrade-process/14754. Nextcloud upgrades: https://docs.nextcloud.com/server/14/admin_manual/maintenance/upgrade.html.
* The `northmes` range of [ADR 0038][adr-0038], `>=X.Y.0-0 <X.(Y+1).0-0`, admits the candidates of its own minor and refuses those of the next, which is what lets a plugin built against a candidate run on the final without a rebuild.
* Revisit at 1.0 (the first squash and stop, the support window after 1.0 of [ADR 0038][adr-0038]), when a customer without host access asks for web upgrades, or when a second replica allows upgrades without downtime.

[adr-0006]: 0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md
[adr-0011]: 0011-principals-credentials-and-same-origin-rules.md
[adr-0018]: 0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md
[adr-0038]: 0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md
[adr-0045]: 0045-backups-restore-drills-upgrades-and-rollback.md
[adr-0047]: 0047-secrets-and-the-installation-key.md
[adr-0066]: 0066-companies-created-by-the-cli-plant-slugs-unique-per-installation-company-settings-at-settings-and-an-onboarding-wizard-before-a-plant-opens.md
[adr-0070]: 0070-one-nestjs-backend-with-one-graphql-schema-and-one-static-web-app.md
[adr-0072]: 0072-one-installation-per-customer-and-hosting-partners-run-many-with-a-customer-folder-northmes-apply-and-the-health-endpoints.md
[adr-0075]: 0075-plugin-installs-from-signed-archives-into-a-plugin-volume-with-plugin-screens-loaded-at-run-time.md
