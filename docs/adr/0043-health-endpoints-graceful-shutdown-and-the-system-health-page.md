---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: internal research notes 15, 18, 19, 20, 22 and 32
informed: contributors, coding agents and pilot IT
release: "1"
needs-confirmation: ""
---

# Health endpoints, graceful shutdown and the System health page

## Context and problem statement

Krister Johansson decided that every web endpoint and service exposes `/health` with status, version and dependency state, plus a liveness and a readiness probe. The pilot runs one `app` process in role `all` under Docker Compose ([ADR 0044](0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md)). Docker Engine never restarts a container because its healthcheck fails; only an exit triggers the restart policy. The embedded Hive Gateway registers SIGTERM and SIGINT listeners that stop Node's default exit, and closing graphql-ws after Nest closes HTTP deadlocks the shutdown (internal research note 20). Manifest 404s, render errors, widget crashes and CSP violations happen in the browser, and without a reporting path no admin ever sees them.

This ADR records the three health endpoints and their checks, the in-process watchdog, the shutdown order of role `all`, the local reporting of browser errors and the contents of the System health page. It covers `apps/server`, the core health checks, `defineHealthCheck` in `@northmes/sdk/health`, `POST /api/web/client-errors`, the shell's status route and the System health page in `core-web`.

## Decision drivers

* Krister Johansson's decision: `/health`, liveness and readiness on every web endpoint and service.
* A process that is stuck must exit, because Docker does not act on an unhealthy container.
* A SIGTERM must drain jobs and finish running mutations inside the 45 s `stop_grace_period`.
* A missing audit partition makes every write fail, so it must fail readiness before it happens.
* Nothing leaves the installation by default; error telemetry to the project is opt-in and built later ([ADR 0052](0052-error-telemetry-opt-in-and-deferred.md)).
* The plant admin needs one page that shows server, host and browser problems.

## Considered options

* Three probes with a degraded list, an in-process watchdog, a fixed shutdown order and local browser error reporting
* One `/health` endpoint for every probe, Nest's default shutdown, and errors only in logs and the browser console
* Server and browser errors sent to a hosted error service

## Decision outcome

Chosen option: "Three probes with a degraded list, an in-process watchdog, a fixed shutdown order and local browser error reporting", because it is the only option that recovers a stuck process under Compose, shuts down without losing jobs or mutations, and shows browser failures to an admin while keeping all data in the installation.

### Endpoints

| Endpoint | Checks | Used by |
|---|---|---|
| `/health/live` | The process only | Probes that ask whether the process answers |
| `/health/ready` | `select 1` on the application pool; the schema compatibility number within the image's range ([ADR 0045](0045-backups-restore-drills-upgrades-and-rollback.md)); the `LISTEN` connection; pg-boss started. JSON body with status, version, supergraph hash and a degraded list. Returns 503 during shutdown | The Compose healthcheck (a small Node script that fetches the endpoint), the customer's monitoring, the shell's admin banner |
| `/health` | Status, version and the state of each dependency (database connected and similar) | Any client that wants the full status |

* Degraded entries keep readiness true: Pyramid unreachable; the last successful backup older than 26 hours; audit partitions fewer than 3 months ahead; the host status file older than 15 minutes ([ADR 0046](0046-observability-structured-logs-host-checks-and-optional-opentelemetry.md)); WAL archiving failing or a point-in-time recovery gap; certificate expiry within 30 days; clock skew.
* Readiness fails when audit partitions are fewer than 1 month ahead ([ADR 0013](0013-audit-trail-written-in-the-command-transaction.md)).
* Checks are custom `@nestjs/terminus` indicators with timeouts. A module adds a check with `defineHealthCheck({ name, affects: "ready" | "degraded", timeoutMs, check })`. Core owns the platform checks; a module checks only its own dependencies, for example the Pyramid connector's last poll.
* Every role serves the three endpoints. A `worker` replica serves its own.

### Recovery under Compose

* The database pool and pg-boss start retry with backoff. Until the database answers and the schema is compatible, readiness is false.
* An in-process watchdog exits with code 1 when readiness stays false more than 120 s after its first success, or 300 s after start. `restart: unless-stopped` then starts a fresh process.

### Shutdown order of role `all`

1. Readiness returns 503. Running assistant chats are aborted through their registered `AbortController` with reason `server-restarting` and get up to 5 s to settle their `ai_call` rows; the propose tool checks the signal before its commit ([ADR 0035](0035-ai-provider-port-with-customer-configured-providers.md), [ADR 0036](0036-agent-proposals-as-planning-records-a-person-commits.md)).
2. graphql-ws is disposed in `beforeApplicationShutdown`. Disposing it later deadlocks, because `server.close()` waits for upgraded sockets.
3. pg-boss `stop()` drains the workers.
4. Nest closes HTTP.
5. The gateway runtime is disposed in `onApplicationShutdown`.
6. The listener connection and the pools close last.

`app.enableShutdownHooks(["SIGTERM", "SIGINT"])` is mandatory, because of the gateway's own signal listeners. `forceCloseConnections` stays off and `return503OnClosing` is on, which also stops a mutation from enqueueing a job on a stopped pg-boss. `stop_grace_period` (45 s) stays above the pg-boss drain timeout (30 s by default). Create commands take a client-generated uuidv7 id and insert with `on conflict do nothing`, so a retry after a restart returns the first row ([ADR 0012](0012-commands-as-the-single-write-path.md)).

### Browser errors reach the server

* `POST /api/web/client-errors` is authenticated, same-origin ([ADR 0011](0011-principals-credentials-and-same-origin-rules.md)), rate-limited and capped at an 8 kB body. It takes `{ moduleId, moduleVersion, stage, code, messageTemplate, route, fingerprint }`, where `stage` is `manifest`, `entry`, `validate`, `render`, `slot`, `chunk`, `csp` or `insecure-context`. CSP reports go to the same endpoint.
* Rows land in a core table on the audit no-trigger list, grouped by fingerprint with a count.
* Reporters: `createRoot` with `onCaughtError` and `onUncaughtError`; window `error` and `unhandledrejection` handlers; the federation diagnostics plugin; the route error component; each slot boundary. `moduleId` comes from the catching boundary or from a stack URL under `/modules/<id>/<version>/`.
* At boot the server checks the files each `mf-manifest.json` lists. A missing file marks the module degraded with `integrity: null` and logs `web.asset_missing` ([ADR 0019](0019-web-shell-with-react-module-federation-remotes.md)).
* Placeholder and route error components show the stage and code. A minimal status route in the shell survives a broken core remote, because the System health page lives in `core-web`.
* `<Slot>` keys each contribution's error boundary by contribution id, with reset keys from the selected entity, and moves focus to the fallback when focus was inside the widget.

### The System health page

Admins see: errors and browser errors grouped by fingerprint; failed and retrying jobs; the last successful Pyramid poll; the last successful backup; database size; certificate expiry; NTP status; versions, image digest and supergraph hash; Node and Postgres tzdata versions and whether Temporal is native ([ADR 0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md)); event-loop delay p99 and heap used; a "Modules and plugins" table (id, version, range, status, reason); "schema ahead by N expand migrations"; leftover schemas of modules no longer installed; stations not seen for 7 days; `pg_stat_archiver` failures. The app measures clock skew per request from a client time header and warns above 5 s; every station syncs its clock to the plant NTP source. The task that builds the header names it.

### Consequences

* Good, because a process that cannot reach readiness exits and the restart policy recovers it, even though Docker ignores health status.
* Good, because SIGTERM ends the process inside the grace period: in the integration spike, the process exited 6 ms after SIGTERM with `enableShutdownHooks`, and a graphql-ws subscriber got close code 1001 before an exit 13 ms after SIGTERM (internal research note 20).
* Good, because browser failures show on the same page as server and host state, and no data leaves the installation.
* Bad, because the shutdown order depends on Nest lifecycle hooks and on how the gateway runtime handles signals, so an upgrade of either can break it; the shutdown tests guard this.
* Bad, because a database outage longer than the watchdog limit restarts the process, which then waits in its boot retry loop.
* Bad, because degraded states reach a person only through this page, the admin banner or a monitoring tool polling `/health/ready` ([ADR 0046](0046-observability-structured-logs-host-checks-and-optional-opentelemetry.md)).

### Confirmation

* Readiness test: with a `FixedClock` and audit partitions up to month M, `/health/ready` degrades at M-3 and returns 503 at M-1.
* Boot retry test: with `db` paused at start and unpaused after 40 s, `/health/ready` returns 200 within 60 s. With `LISTEN` reconnects blocked for 150 s, the process exits non-zero and a restarted process becomes ready.
* Host file test: a `host.json` fixture with 3 warnings makes `/health/ready` return 200 with status degraded and those 3 keys; a file 16 minutes old adds `hostcheck: stale`.
* Shutdown tests: after SIGTERM with the embedded gateway, the process exits on its own with pg-boss stopped, and a graphql-ws subscriber receives close code 1001. A 1.5 s mutation with `app.close()` after 300 ms returns 200 and leaves one `audit.command` row. A slow mocked assistant stream gets `server-restarting` and leaves a complete proposal or none.
* Endpoint tests: a cross-origin or unauthenticated `POST /api/web/client-errors` is refused; a body above 8 kB is refused; two reports with one fingerprint give one row with count 2.
* Playwright, degraded paths: with planning's lazy board chunk deleted, the boot log contains `web.asset_missing` and System health shows "planning: 1 missing file". With planning's `./module` throwing at evaluation, a client error row with stage `entry` and `moduleId` planning appears within 2 s. With core's remote deleted, the shell status route renders. A fixture widget that throws on render for one order and rejects a promise for another leaves the board usable; the fallback has a role and an accessible name and receives focus; selecting another order shows the widget again; two client error rows exist.
* Clock skew test: a client time header 40 s behind records skew of -40 s and a warning.

## Pros and cons of the options

### Three probes, watchdog, fixed shutdown order, local browser errors

* Good, because liveness, readiness and full status serve different callers without one check deciding all three.
* Good, because the degraded list lets monitoring poll one URL for every warning.
* Bad, because NorthMES writes and tests its own terminus indicators; none of the built-in ones covers Kysely or raw `pg` (internal research note 15).

### One `/health` endpoint and default shutdown

* Good, because it is less code.
* Bad, because the gateway's signal listeners keep the process alive until Docker sends SIGKILL after the grace period, which skips the pg-boss drain (internal research note 20).
* Bad, because a stuck process stays up, and browser failures stay invisible to the admin.

### Hosted error service

* Good, because grouping, alerting and stack traces come ready-made.
* Bad, because data would leave the installation by default, while Krister Johansson decided that error telemetry is opt-in and off by default; the opt-in path is [ADR 0052](0052-error-telemetry-opt-in-and-deferred.md).

## More information

* Related ADRs: [0002](0002-modular-monolith-with-module-owned-schemas-and-process-roles.md) process roles, [0011](0011-principals-credentials-and-same-origin-rules.md) same-origin rules, [0012](0012-commands-as-the-single-write-path.md) commands, [0013](0013-audit-trail-written-in-the-command-transaction.md) audit partitions and the no-trigger list, [0014](0014-outbox-event-log-and-pg-boss-jobs.md) pg-boss, [0015](0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md) embedded gateway, [0018](0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md) graphql-ws, [0019](0019-web-shell-with-react-module-federation-remotes.md) shell and slots, [0044](0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md) Compose and Caddy, [0045](0045-backups-restore-drills-upgrades-and-rollback.md) schema compatibility, [0046](0046-observability-structured-logs-host-checks-and-optional-opentelemetry.md) hostcheck and logs, [0052](0052-error-telemetry-opt-in-and-deferred.md) error telemetry later.
* Plan: [02 architecture](../plan/02-architecture.md) (health endpoints, shutdown sequence), [04 data and platform](../plan/04-data-and-platform.md) (health checks per module), [06 web and UX](../plan/06-web-and-ux.md) (browser errors reach the server), [12 operations and security](../plan/12-operations-and-security.md) (health and the System health page).
* NestJS Terminus: https://docs.nestjs.com/recipes/terminus
* NestJS lifecycle events: https://docs.nestjs.com/fundamentals/lifecycle-events
* Docker does not restart unhealthy containers: https://github.com/moby/moby/issues/28400
* Hive Gateway graphql-ws disposal issue: https://github.com/graphql-hive/gateway/issues/2546
* Open: whether sequencer lag fails readiness or only shows as degraded.
* Revisit when a second replica or a separate `worker` role runs, or when the gateway runtime changes how it handles process signals.
