---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: internal research notes 01, 03, 06, 07, 08, 11, 17, 24, 25, 28, 31, 32 and 33
informed: contributors and coding agents
release: "1"
needs-confirmation: ""
---

# Test strategy: TDD, Vitest projects, Testcontainers and Playwright

## Context and problem statement

Krister Johansson decided that NorthMES is built test first, that integration and end-to-end tests run against Postgres from `@testcontainers/postgresql`, and that the coder keeps a refactor step after green. One developer builds with coding agents through handoff, which runs each task in its own git worktree and disables Claude Code hooks inside its runs.

Most NorthMES behaviour lives in Postgres: row-level security, the audit trigger, exclusion constraints, pg-boss jobs and `LISTEN`. Code commits, opens second connections and runs jobs. The stress test found that the first Vitest layout missed 5 of 10 typical test paths in the module layout, so an uncollected test passed quietly, and that the research notes disagreed on how to reset the database between test files (internal research note 32). It also turned several operational failures (rollback, restore drills, WAL archive outages, reconnects after a restart) into tests that must exist before the pilot.

This ADR decides the rules every task follows, the Vitest projects, the Testcontainers harness, the Playwright shape, the time zone matrix, the contract suites and the nightly jobs. AI in tests is in [ADR 0042](0042-ai-in-tests-mocked-by-default-opt-in-live-runs.md); the gate command, source exports and the stack script are in [ADR 0058](0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md); accessibility gates are in [ADR 0021](0021-accessibility-target-wcag-2-2-aa.md). [11-quality-and-testing.md](../plan/11-quality-and-testing.md) holds the full detail.

## Decision drivers

* Krister Johansson's decisions: failing test first, real Postgres through Testcontainers, a refactor step after green.
* No mock of Postgres: the database rules are the behaviour under test.
* A test file anywhere in the module layout lands in exactly one project, and a test nobody collects fails.
* Parallel test files, two worktrees and two handoff runs on one machine never share data.
* Per-test rollback cannot isolate code that commits, opens a second connection or runs a job.
* Time zone and DST bugs surface in tests, not at the plant.
* TDD must hold inside handoff runs, where hooks do not run; the Tester has a 20-minute limit.
* Upgrades, rollback and restores on an on-prem host are tested before the pilot depends on them.

## Considered options

* Test first; Vitest projects keyed on file suffix; one Testcontainers Postgres per run with a database per test file cloned from a migrated template; Playwright with per-worker database and server fixtures
* Vitest projects keyed on folders
* A transaction rolled back after each test
* Testcontainers `snapshot()` and `restoreSnapshot()` between test files
* Playwright `webServer` against one shared stack

## Decision outcome

Chosen option: "Test first; Vitest projects keyed on file suffix; one Testcontainers Postgres per run with a database per test file cloned from a migrated template; Playwright with per-worker database and server fixtures", because it is the only combination measured in the testing research that isolates parallel files with commits, jobs and `LISTEN`, collects every test file, and lets Playwright reach a database that `globalSetup` started (internal research note 17). The template clone was chosen over the `snapshot()` approach that internal research notes 01, 03, 07 and 08 proposed, because `snapshot()` resets one database per container.

### Rules every task follows

* A change starts with a failing test. A plan takes one behaviour at a time: one step writes the failing test, the next makes it pass with the smallest change, and a refactor step with the tests green follows. The commit that adds a failing test starts with `test:`.
* The seam a task names under "Seam" counts as agreed. SQL tests of policies, constraints and the catalog are their own seam through `packages/testing`.
* Every acceptance criterion names the test that proves it. Tests carry requirement ids from the first test. Until the maintainer fixes the format, a test name starts with the plan case id when one exists (TC1, CAL8) and otherwise with the story's plan id (E07-S05) ([ADR 0051](0051-regulated-readiness-no-regret-rules.md)).
* No shared database, no mock of Postgres, no `docker compose` and no `.env` file for tests. A missing Docker fails the run.
* A test isolates itself by creating its own company and plant (`given.company()`, `given.plant()`); tests never truncate and never assert global counts.
* Fixtures write through `db.command({ principal, scopes, reason }, fn)` with surface `cli`, so the audit trigger sees a context ([ADR 0013](0013-audit-trail-written-in-the-command-transaction.md)).
* Test data is synthetic. `.only` and `.skip` fail Biome.

### Vitest projects keyed on file suffix

| Project | Selects | Runs in |
|---|---|---|
| `unit` | `**/*.test.ts` except `*.int.test.ts`, `*.ai.test.ts` and `*.ops.test.ts` | `pnpm check` |
| `integration` | `**/*.int.test.ts`; its `globalSetup` starts one container per run | `pnpm check` |
| `web` | `**/*.test.tsx` with the React plugin and happy-dom | `pnpm check` |
| browser accessibility | Vitest browser mode with Chromium, for axe contrast checks; the suffix is chosen by the task that adds it | not decided |
| `ai` | `**/*.ai.test.ts` ([ADR 0042](0042-ai-in-tests-mocked-by-default-opt-in-live-runs.md)) | `pnpm test:ai` only |
| `ops` | `**/*.ops.test.ts` | nightly |

* Every project excludes `node_modules`, `dist` and `docs/sources`. The coverage include follows the same globs; only the scheduling domain has a threshold at first.
* Two more projects run the scheduling and time suites nightly with native Temporal and with `temporal-polyfill` forced ([ADR 0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md)).
* Vitest 5 runs on Vite 8 without SWC; decorator metadata comes from `tsconfig.json`. Every code-first GraphQL field names its type, interface-typed dependencies use `@Inject(TOKEN)`, and `unplugin-swc` is the documented fallback.
* Vitest runs outside Turborepo, because the integration project must own exactly one container per run.

### Testcontainers harness

* `@northmes/testing` (MIT) holds the harness, so modules and the example plugins share one setup.
* One `PostgreSqlContainer` per run on the image digest in `infra/pg-image.json`, the same file Compose reads ([ADR 0005](0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md)), with tmpfs, `fsync`, `synchronous_commit` and `full_page_writes` off, `max_connections=300`, a random password and database name, and the session zone from `NM_TEST_PG_TZ` (default `UTC`). Ryuk stays on.
* The setup bootstraps the roles as the container superuser and runs `northmes migrate` into a template database named after a hash of the migration files.
* `useTestDatabase()` clones one database per test file from the template (10 to 26 ms measured) and hands out pools for `nm_app`, and for database-seam tests `nm_owner`. Tests never connect as the superuser, which bypasses row-level security. Every pool has an error handler before use.
* Multi-instance tests build two Nest applications in one process with separate pools, pg-boss instances and `LISTEN` connections (`createReplicas(2)`). A nightly image smoke test with `GenericContainer` covers the real process boundary.

### Playwright

* No `webServer`, because Playwright starts it before `globalSetup`. `globalSetup` runs the stack script into a template; a worker fixture clones `e2e_<parallelIndex>` and spawns the built server (`NORTHMES_ROLE=all`, `PORT=0`); an optional `stack2` fixture starts a second server on the same database for cross-replica specs.
* Each worker signs in a planner and an operator through Better Auth `testUtils` storage states, from a test-only auth instance that refuses to start under `NODE_ENV=production`.
* Outside systems are stubs started by fixtures: the fake PWS server for Pyramid and a stub OpenAI-compatible server.
* Tests run on Chromium. Edge or Firefox join only if the browser versions pilot IT reports require it.

### Time zones

* Unit and integration run twice in `ci / gate`: Node and Postgres in `UTC`, and both in `Europe/Stockholm`.
* Nightly, a hostile leg runs with the server zone `Pacific/Chatham` and asserts that every pool reports `UTC`. A Chromium project whose init script deletes `globalThis.Temporal` runs in `ci / e2e`.
* Stockholm and Helsinki fixtures for 2026-10-25 and 2027-03-28 exist from the first calendar test.

### Contract suites and nightly jobs

* Contract suites in `@northmes/testing` check invariants for the autoplan strategy, the ERP connector, the master-data kit and the command pipeline. Each has a database-free and a database-backed part, and they run in core CI. Publishing them and `pnpm northmes check` for app repositories wait.
* Nightly jobs run the Compose stack, the ops tests (install, restore drill, WAL archive outage, upgrade from N-1 to N with a failing migration and rollback), the N-1 image over a database the current image wrote, the board performance spec, the autoplan bench and the reconnect-after-outage spec.

### Test first inside handoff runs

handoff disables hooks in its runs, so test first rests on: the issue naming the seam and the first failing tests; planner, coder and reviewer instructions that require one behaviour at a time; Krister approving the test list at the plan gate of the guided and standard graphs; the Tester running `pnpm check` after every coder attempt (20 minutes, one retry); and `scripts/handoff/tests-changed.mjs`, which fails when source under `modules/**`, `packages/**` or `examples/**` changed and no test did ([ADR 0049](0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md)). In interactive sessions, Claude Code hooks run related tests after edits and changed tests before stop.

### Consequences

* Good, because tests exercise the same policies, triggers and constraints the plant runs.
* Good, because file isolation through template clones lets files and worktrees run in parallel on one Docker host.
* Good, because a test file outside every project fails CI instead of passing unnoticed.
* Bad, because every developer and agent machine needs Docker; GitHub-hosted macOS runners cannot run it, so container tests run on Linux runners only.
* Bad, because a first image pull counts against the Tester's limit; `scripts/handoff/setup.sh` pre-pulls the image.
* Bad, because `tests-changed.mjs` checks that tests changed, not that they were written first; commit order is checked in review.
* Neutral, because a stricter edit guard is decided after a trial week on the scheduling domain.

### Confirmation

* `test/meta/collection.test.ts` compares `vitest list --json --filesOnly` with the test files `git ls-files` lists and fails on a file in no suffix project or in two.
* A guard test walks every Nest provider and fails when a `design:paramtypes` entry is `Object` without an `@Inject` token.
* Biome fails on `.only` and `.skip`; a repository lint fails when a Compose file, Dockerfile or test names a Postgres image other than the digest in `infra/pg-image.json`.
* A raw insert outside `db.command` fails with SQLSTATE P0001 and a message that names `db.command`.
* The hostile leg asserts `current_setting('TimeZone') = 'UTC'` on every pool.
* `e2e/skeleton.spec.ts` is required in `ci / gate` from M1.
* `tests-changed.mjs` fails a branch that changes a file under `modules/` without changing a test.
* Nightly: `wal-archive-outage.ops.test.ts`, the restore drill test (no timeline 2 in the production archive), the upgrade and rollback test, `reconnect-after-outage.spec.ts`, `e2e/board-perf.spec.ts` and `plan.bench.ts`.

## Pros and cons of the options

### Suffix-keyed projects, template clones, Playwright worker fixtures

* Good, because a 20-file integration run took 3.0 to 3.7 s in the research spike, container start included.
* Bad, because the harness is code the project owns and maintains.

### Projects keyed on folders

* Good, because it mirrors the package layout.
* Bad, because 5 of 10 typical paths fell into no project, and a related-tests hook with `--passWithNoTests` let them pass.

### A transaction rolled back per test

* Good, because it is fast and needs no cloning.
* Bad, because it fails as soon as code commits, opens a second connection or runs a job, which most NorthMES code does.

### `snapshot()` and `restoreSnapshot()`

* Good, because Testcontainers ships it.
* Bad, because it resets the one database of a container, so it cannot serve test files running in parallel.

### Playwright `webServer`

* Good, because it is Playwright's default.
* Bad, because `webServer` starts before `globalSetup`, so it cannot use a database `globalSetup` started, and one shared stack gives no per-worker data.

## More information

* Related ADRs: [0005](0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md), [0013](0013-audit-trail-written-in-the-command-transaction.md), [0021](0021-accessibility-target-wcag-2-2-aa.md), [0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md), [0028](0028-autoplan-as-a-pure-deterministic-function.md) performance budget, [0042](0042-ai-in-tests-mocked-by-default-opt-in-live-runs.md), [0045](0045-backups-restore-drills-upgrades-and-rollback.md) ops tests, [0049](0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md), [0050](0050-github-organization-rulesets-ci-runners-and-supply-chain.md) required checks, [0051](0051-regulated-readiness-no-regret-rules.md), [0057](0057-scheduling-domain-as-a-pure-package-in-the-planning-module.md), [0058](0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md).
* Plan: [11-quality-and-testing.md](../plan/11-quality-and-testing.md), [04-data-and-platform.md](../plan/04-data-and-platform.md#testing-the-data-layer), [16-open-questions.md](../plan/16-open-questions.md) (M-22).
* Vitest projects: https://vitest.dev/guide/projects. Testcontainers for Node: https://node.testcontainers.org/. Playwright test configuration: https://playwright.dev/docs/test-configuration.
* Revisit when an optional time-series backend from [ADR 0059](0059-time-series-storage-port-with-an-open-default-backend.md) enters the test image, when contract suites are published for app repositories, and after the trial of a stricter edit guard.
