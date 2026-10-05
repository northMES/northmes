---
status: "proposed"
date: 2026-10-05
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: internal research notes 13, 15, 22, 23 and 32
informed: contributors, coding agents and pilot IT
release: "1"
needs-confirmation: "pilot IT (monitoring tool or SMTP relay)"
---

# Observability: structured logs, host checks and optional OpenTelemetry

## Context and problem statement

The pilot runs on one host at the plant, operated by the customer's IT ([ADR 0044](0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md)). Somebody has to learn when a disk fills, a backup stops, archiving fails, a certificate nears expiry or the clock drifts. The first design had gaps that an internal stress test found (internal research note 32):

* The default pino serializers log every request header and the response headers, so session cookies, station key cookies, API keys and `set-cookie` at sign-in reach the container logs and any excerpt sent to support.
* The app cannot see disk space, NTP state or pgBackRest from inside its container, and a host script cannot insert into an audited table without an audit context.
* Notifications are a core module built only when a release needs them, and nothing else carried an alert to a person.

The research also found that the published OpenTelemetry instrumentation for NestJS did not cover Nest 12 when checked, and that the all-in-one backends are meant for development or need several GB of memory (internal research note 15). This ADR covers the logger configuration in `apps/server`, the `hostcheck` script and its timer, the `host.json` mount, the alert path, the `observability` profile and the rules for what support receives.

## Decision drivers

* No credential or secret header in any log line.
* A customer log collector sees security events, such as failed sign-ins.
* Host facts show on System health ([ADR 0043](0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md)) without giving the app access to the host.
* An alert reaches a person without an in-app notification service.
* At least 14 days of logs fit on the host.
* Nothing leaves the installation unless the customer configures it.

## Considered options

* JSON logs with redaction, a host check script that writes a status file, alerts through the customer's monitoring or SMTP relay, and OpenTelemetry behind an optional profile
* OpenTelemetry on by default with an all-in-one backend in the Compose bundle
* A host timer that writes backup and host results into a status table in the database

## Decision outcome

Chosen option: "JSON logs with redaction, a host check script that writes a status file, alerts through the customer's monitoring or SMTP relay, and OpenTelemetry behind an optional profile", because it closes the leaks, shows host facts to admins and gives alerts a channel with the least running software on a small host.

### Logs

* `nestjs-pino` writes JSON to stdout with a correlation id on every request, job and Pyramid poll. The `local` log driver rotates the files.
* The correlation id is a uuidv7 created once per HTTP request by the correlation middleware in `apps/server`, which `pinoHttp`'s `genReqId` reads, and once per graphql-ws operation. A worker takes it from the job payload, and a scheduled job that no request started creates one when it starts (a Pyramid poll uses its run id, [ADR 0013](0013-audit-trail-written-in-the-command-transaction.md)). It lives in `AsyncLocalStorage`. The subgraph context, the pipeline (which passes it to `audit.begin_command` and onto `core.event` rows), security events, job payloads and the exception filter read it from there and never create one. The server ignores a correlation header sent by a client and returns the id in the `x-northmes-correlation-id` response header. The header name and the rule for an id set by Caddy answer M-52 in [16 open questions](../plan/16-open-questions.md#design-points-from-the-plan-documents).
* `pinoHttp` redacts `req.headers.cookie`, `req.headers.authorization`, `req.headers['x-api-key']`, the station operator-session header and `res.headers['set-cookie']`, or a request serializer keeps only method, URL and correlation id. AI SDK error objects pass through a serializer that drops request and response bodies ([ADR 0035](0035-ai-provider-port-with-customer-configured-providers.md)).
* Requests log at debug level, except errors and slow requests. Per-service log options come from a measured budget that holds at least 14 days; the nightly end-to-end run measures log bytes per hour.
* Every security event is also a log line `{type: 'security_event', kind, principal, scope, correlationId}` ([ADR 0013](0013-audit-trail-written-in-the-command-transaction.md)). MCP reads are not audited and go to the log with the correlation id.

### hostcheck

* `/opt/northmes/bin/hostcheck` runs on a systemd timer every 5 minutes (`Persistent=true`, `After=docker.service`) and writes `/srv/northmes/status/host.json`: disk free per mount (root, Docker `data-root`, backup), `pgbackrest info --output=json`, the last drill result, `NTPSynchronized`, the certificate's `notAfter` and the running image digests.
* The app mounts the file read-only. A file older than 15 minutes is itself a degraded entry.
* The app reads archive health from `pg_stat_archiver` over SQL and certificate expiry from a TLS connection to `caddy:443` (warning at 30 days), so those two do not depend on the file.
* The shell shows admins a banner built from the `/health/ready` JSON.

### Alerts reach a person

One of two paths is a go-live gate, and pilot IT chooses:

* The customer's monitoring polls the degraded list of `/health/ready`.
* `hostcheck` mails state changes through the customer's SMTP relay.

No in-app notification service is built for this ([ADR 0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md)).

### OpenTelemetry

* The `observability` Compose profile starts an OpenTelemetry backend for a debugging session, not for permanent use.
* The SDK loads only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set; otherwise the process runs with `OTEL_SDK_DISABLED=true`.
* No Sentry SDK runs in the server. Browser and server errors land in the installation's own database ([ADR 0043](0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md)); telemetry to the project is opt-in and later ([ADR 0052](0052-error-telemetry-opt-in-and-deferred.md)).

### Support

Support receives logs only, with secret headers redacted. No database dump leaves the site, and every support ticket has a deletion date ([12 operations and security](../plan/12-operations-and-security.md#security-reporting-and-support-access)).

### Consequences

* Good, because logs can go to support or a customer collector without exposing a session or a key.
* Good, because admins see host facts on System health, and the customer's existing tools receive alerts.
* Good, because the default install runs no tracing backend and no exporter.
* Bad, because one host script and one systemd timer join the bundle and are tested apart from the app.
* Bad, because alerts depend on a monitoring tool or an SMTP relay at the customer; without one the go-live gate is not met.
* Bad, because the pilot has no traces until someone starts the `observability` profile, and Nest spans depend on an instrumentation release that covers Nest 12.

### Confirmation

* Redaction test: sign in, call `/graphql` with an API key, and assert that neither the token nor the cookie value appears in the captured log lines.
* Security event log test: a failed sign-in yields a log line that validates against the JSON schema of `type: 'security_event'`.
* `hostcheck` test on fixture inputs (disk at 91 percent, a backup 27 hours old, a certificate expiring in 20 days): one state change and one mail per fixture, captured by Mailpit.
* App integration test: a `host.json` fixture with 3 warnings makes `/health/ready` return 200 with status degraded and those 3 keys; a file 16 minutes old adds `hostcheck: stale`.
* Log budget: the nightly end-to-end run records log bytes per hour, and the per-service options keep at least 14 days within the disk budget.
* OpenTelemetry test: a process started without `OTEL_EXPORTER_OTLP_ENDPOINT` reports the SDK disabled and opens no exporter connection.
* License gate: `@sentry/node` in a server dependency tree fails the gate ([ADR 0040](0040-dependency-license-policy-ci-gate-and-sbom.md)).

## Pros and cons of the options

### JSON logs, hostcheck file, customer alert channel, optional OpenTelemetry

* Good, because every part works on an offline host with the customer's own tools.
* Bad, because metrics and traces are not collected by default.

### OpenTelemetry on by default

* Good, because traces and metrics would exist from the first day.
* Bad, because the all-in-one backends are meant for development or need several GB of memory, and the published NestJS instrumentation did not cover Nest 12 when researched (internal research note 15).

### A host timer that writes into a status table

* Good, because System health reads one table.
* Bad, because every module table has the fail-closed audit trigger, so a `psql` insert from the host needs an audit context or an allowlisted table, and the result still gives alerts no channel (internal research note 32).

## More information

* Related ADRs: [0013](0013-audit-trail-written-in-the-command-transaction.md) security events, [0035](0035-ai-provider-port-with-customer-configured-providers.md) AI error redaction, [0040](0040-dependency-license-policy-ci-gate-and-sbom.md) license gate, [0043](0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md) health endpoints and System health, [0044](0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md) Compose bundle, [0045](0045-backups-restore-drills-upgrades-and-rollback.md) backups and drills, [0052](0052-error-telemetry-opt-in-and-deferred.md) error telemetry later, [0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md) notifications deferred.
* Plan: [12 operations and security](../plan/12-operations-and-security.md) (hostcheck, logs and optional OpenTelemetry, go-live checklist item 8), [16 open questions](../plan/16-open-questions.md).
* Pilot IT confirms whether a monitoring tool polls `/health/ready` or `hostcheck` mails through an SMTP relay.
* nestjs-pino: https://github.com/iamolegga/nestjs-pino
* pino redaction: https://getpino.io/#/docs/redaction
* OpenTelemetry JavaScript: https://opentelemetry.io/docs/languages/js/
* Revisit when a released NestJS instrumentation covers the Nest major in use, when a customer asks for permanent tracing, or when the notifications module is built.
