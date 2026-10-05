---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: internal research notes 06, 07, 08, 15, 16, 18, 20, 32 and 33
informed: contributors and coding agents
release: "1"
needs-confirmation: ""
---

# Modular monolith with module-owned schemas and process roles

## Context and problem statement

NorthMES is an open source, developer-first MES. One monorepo holds every module with its services and its frontend. Production planning is the first module to release, and later modules from the module map (Start of production beyond the minimal operator station, Data collection, OEE, Maintenance, Traceability and the rest) must fit the same module contract without changes to core's rules. The pilot runs on-prem on one Linux host with Docker Compose, and one developer builds it with coding agents.

An earlier attempt at the same product ran 14 services, eleven module subgraphs plus platform subgraphs behind a separate router, eleven web remotes, a hosted identity provider and a cloud message bus. Entity ownership was split across services, so the scheduling service copied about 20 columns of planning data, and most end-to-end tests ran in stub mode (internal research note 16).

This ADR decides the process shape, how modules own data and call each other, the process roles of the image, and the boot order with what stops a boot. It covers `apps/server` and every module and plugin. The module package and manifest are in [ADR 0003](0003-module-package-shape-and-the-definemodule-manifest.md), the database roles in [ADR 0006](0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md).

## Decision drivers

* One developer with coding agents must reach a pilot. Every extra process, broker or network hop costs build and test time.
* Later modules and third-party plugins must fit without core changes, so module boundaries must be enforced, not only agreed.
* Integration tests must exercise the real paths against Postgres from Testcontainers, with no stubs between modules.
* The pilot runs one replica, and a second replica must not need a rewrite.
* A plugin that fails to load must never remove a business rule without anyone noticing.

## Considered options

* A NestJS modular monolith: one process, module-owned Postgres schemas, synchronous calls through API modules, one image started in roles
* One service per module, each deployed on its own, with a message bus between them
* A monolith with one shared schema and module boundaries by convention only

## Decision outcome

Chosen option: "A NestJS modular monolith", because it keeps one process and one database for the pilot while Postgres roles and boot checks enforce the module boundaries that a convention would leave open. Krister Johansson decided the monolith, the module-owned schemas and the pilot shape (one `all` replica on one host). The role split and the boot rules come from internal research note 20 and the stress test (internal research note 32).

### Module rules

* Every module owns one Postgres schema and never reads or changes another module's tables. Per-module owner roles enforce this at migration time ([ADR 0006](0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md)). At run time one `nm_app` role serves all modules, so per-module Kysely `DB` types, Biome `noRestrictedImports` and a raw-SQL pattern check keep queries inside the module's schema.
* Queries and commands across modules are synchronous in-process calls to the owner's `<Id>ApiModule`, which holds plain providers and no resolvers.
* Events go through the outbox only for side effects: ERP write-back, subscription fan-out and, later, notifications. An event never replaces a command call to another module ([ADR 0014](0014-outbox-event-log-and-pg-boss-jobs.md)).
* Master data lives in core: plant, scope tree, equipment groups, equipment, tools, articles, routings and operations, operation equipment, calendars, warehouses and customers.
* Dependencies point toward core. Planning depends on core. Production-start depends on planning and core. The Pyramid connector depends on core and planning. The `ai` module depends on core. The example plugins depend on planning.
* Upstream modules never know downstream ones. Production-start reports progress by calling planning's `reportOperationProgress`, so planning has no dependency on production-start. Planning shows downstream data only through slots that the downstream module fills.

### Process roles

One image starts in one of three roles. There is no `web` role and no `ingest` role in release 1.

| Role | Runs | Does not run |
|---|---|---|
| `all` | everything in the two rows below, in one process | |
| `api` | catalog and boot checks; every module's Nest module; the subgraphs and the embedded gateway on `/graphql` (HTTP, graphql-ws, SSE); `/mcp`; the event tail; static files and `/api/web/modules`; the command bus with validators; pg-boss for sending jobs only | pg-boss workers, cron, the sequencer, connector polling |
| `worker` | catalog and boot checks; every module's Nest module; the command bus with validators; event handlers; pg-boss workers and cron; the sequencer; connector polling; a health endpoint | subgraph schemas, the gateway, static files, `/mcp` |

* The pilot runs one `all` replica on one host. The operations docs say that this host is a single point of failure.
* The code follows the multi-replica rules anyway: stateless processes, idempotent jobs, transaction-level advisory locks only, `LISTEN` on one direct connection, migrations as a separate step in the one-off `migrate` service. CI runs the two-replica integration tests.
* Every role loads the same configuration and every plugin, so a command that a worker runs (an ERP import) passes the same validators as one from the UI.
* There is no `web` role because `api` serves the shell and every remote as static files from the image and the plugin directories. A separate role would need each plugin's `web/dist` as well, which adds a second place that must agree with the backend's plugin list.
* There is no `ingest` role because machine data ingestion is later work. It arrives with Data collection.

### Boot sequence of role `all`

Every hard failure exits with code 1 and lists all problems it found in one message.

| Step | What happens | Fails hard on |
|---|---|---|
| 1. Config | read `northmes.config.json` | unreadable file; a version field that differs from the image |
| 2. Resolve hook | `module.registerHooks` maps host-provided packages imported from any plugin root to the host's copy | |
| 3. Manifests | import every manifest; no Nest code loads | missing `exports["./manifest"]`, import error, invalid id |
| 4. Catalog checks | duplicate ids, derived-name collisions, `dependsOn` present, no cycles, no core module depending on a plugin, `northmes` range, key prefixes, slot ownership; topological order with core first | any of these |
| 5. Migration check | as `nm_app`, compare applied migrations with the files of every installed module | pending files; a database newer than the image accepts |
| 6. Server imports | `await manifest.server()` in dependency order | import error; a configured plugin with a server part that fails to load |
| 7. Nest create | instantiate modules, one subgraph per module | dependency injection errors |
| 8. Isolation check | compute, the way Nest does, which resolver classes each subgraph root reaches | a resolver-bearing module reachable from two subgraph roots or through a global module |
| 9. Static mounts | shell assets and `/modules/<id>/<version>/` per installed remote | |
| 10. Init | build subgraph schemas, discover validators, compose with the NorthMES rules, warm the gateway, start graphql-ws | schema build or composition error; a Mutation field with no registered command handler; a resolver field with neither permission nor `@Public` metadata (the message names `Type.field`) |
| 11. MCP | mount `/mcp` with tools from the modules' `mcp` entries | |
| 12. Listen | HTTP and WebSocket on one port | port in use |
| 13. Workers | pg-boss with `migrate: false`, the sequencer, cron | |

A configured plugin with a server part that fails to load stops the boot. The host never skips it, because a skipped validator removes a business rule and a skipped subgraph changes the API under every client. `northmes migrate --check` runs steps 1 to 10 without listening ([ADR 0045](0045-backups-restore-drills-upgrades-and-rollback.md)). In this mode the migration check of step 5 lists pending files instead of failing on them.

These states degrade and the process keeps running:

* A module's remote files are missing, or a manifest hash does not match: `/api/web/modules` lists the module with `integrity: null`, and the shell shows a placeholder route and an "(unavailable)" menu entry.
* A remote fails in the browser, or a slot contribution throws: the route error component or the per-contribution error boundary.
* A web-only plugin (no server part, no migrations) targets a slot that no longer exists: status `incompatible` ([ADR 0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md), pending the maintainer's confirmation).
* A validator times out or throws at run time: that command is rejected.
* The database is unreachable at start: retry with backoff while readiness stays false.
* Pyramid is unreachable, the listener connection is lost or the last backup is old: readiness reports degraded, and the System health page shows it.

### Consequences

* Good, because a cross-module read is a function call, with no copied columns, projections or mirror tables.
* Good, because integration and end-to-end tests boot the real `all` process against Testcontainers Postgres.
* Good, because the integration spike booted core, planning and two plugins in 113 to 146 ms after imports, 529 to 605 ms wall time and 210 to 215 MB RSS on Node 24 (internal research note 20).
* Bad, because one event loop serves the gateway, the resolvers, the jobs and connector polling, so a long computation delays requests. Autoplan carries a step budget and moves to a worker thread only if the budget fails ([ADR 0028](0028-autoplan-as-a-pure-deterministic-function.md)).
* Bad, because plugin server code runs in the process with full access ([ADR 0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md)).
* Bad, because the pilot host is a single point of failure. Recovery is a restart plus a restore ([ADR 0045](0045-backups-restore-drills-upgrades-and-rollback.md)).
* Bad, because the catalog, migration and isolation checks are platform work that comes before the first planning feature.

### Confirmation

* Catalog contract suite: an invalid `northmes` range, a missing dependency, a cycle, a wrong key prefix, a slot contribution outside the `dependsOn` closure, a validator on an undeclared command and a validator without `dependsOn` on the owner each make boot exit 1 with a named message; three problems at once print "3 problems".
* Boot guard tests: a resolver field without permission or `@Public` metadata makes boot exit 1 naming `Type.field`; a Mutation field without a command handler makes boot exit 1 naming the field.
* Plugin load test: a configured plugin whose `dist/server.js` throws on import makes boot exit 1 naming the plugin id.
* Degrade tests: with one remote's files missing, boot completes and `/api/web/modules` lists that module with `integrity: null`; with the database paused at start and resumed after 40 s, `/health/ready` returns 200 within 60 s.
* Role test: role `api` registers no pg-boss work handlers, cron or sequencer; role `worker` serves no `/graphql` and answers its health endpoint.
* The two-replica integration tests run in CI.
* Boundary checks: Biome `noRestrictedImports` fails on module server code that imports another module's package other than its `./api` export or its contracts package; the per-module `DB` types make a query on another module's table a type error.
* Connector contract test: the Pyramid connector subscribes to no `planning.draft.*` and no `*.soft_lock_changed` event.
* `e2e/skeleton.spec.ts` runs Playwright on the built `all` process with Testcontainers Postgres and is required in `ci / gate` from milestone M1 ([ADR 0058](0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md)).

## Pros and cons of the options

### NestJS modular monolith with module-owned schemas

* Good, because the pilot host runs one application process, one database and no broker.
* Good, because Postgres refuses a migration that touches another module's schema, and boot checks refuse a wrong import.
* Neutral, because Federation still gives each module its own subgraph inside the process ([ADR 0015](0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md)), so the API keeps the module seams.
* Bad, because every role loads every module and one event loop serves them all.

### One service per module with a message bus

* Good, because modules deploy and scale on their own, and a crash stays inside one service.
* Bad, because the earlier attempt in this shape copied about 20 columns into its scheduling service, needed a bus emulator and an in-process fallback, and its default test run never crossed services (internal research note 16).
* Bad, because a single on-prem host would need a router, service discovery and a broker that one developer operates.

### One shared schema, boundaries by convention

* Good, because it is the quickest start, and a join across modules needs no API.
* Bad, because nothing stops a plugin migration from altering a core table. With module-owned schemas the integration spike showed Postgres refusing exactly that: `ALTER TABLE core.article` failed with "must be owner of table article" (internal research note 20).
* Bad, because modules that read each other's tables couple their migrations, so a later module cannot change its tables without checking every reader.

## More information

* Related ADRs: [0003](0003-module-package-shape-and-the-definemodule-manifest.md) module package and manifest, [0006](0006-kysely-sql-first-migrations-and-the-northmes-migration-runner.md) database roles and migrations, [0014](0014-outbox-event-log-and-pg-boss-jobs.md) outbox and jobs, [0015](0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md) embedded gateway, [0019](0019-web-shell-with-react-module-federation-remotes.md) web shell, [0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md) plugins, [0043](0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md) health and shutdown, [0044](0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md) deployment, [0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md) release 1 scope.
* Plan: [02 architecture](../plan/02-architecture.md) (process roles, boot and shutdown sequence, traps), [03 modules and extensibility](../plan/03-modules-and-extensibility.md), [12 operations and security](../plan/12-operations-and-security.md).
* Revisit when a customer needs more than one replica or separate `api` and `worker` hosts, and when Data collection adds an ingestion role.
