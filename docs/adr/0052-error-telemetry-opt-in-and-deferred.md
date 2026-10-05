---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: internal research notes 12, 13, 15, 19, 20, 22 and 32
informed: contributors, coding agents, plant admins
release: "later"
needs-confirmation: ""
---

# Error telemetry: opt-in and deferred

## Context and problem statement

Bugs that show up across many installations are found faster when installations report their errors to the project. NorthMES also runs on customers' own servers, often in plants where operator PCs have no internet, and the customer keeps its data. Krister Johansson decided that error telemetry to the NorthMES project is opt-in, off by default, decided as a principle and built later.

Release 1 still needs errors to be visible inside the installation. The design review found that browser failures (a missing remote file, a remote that throws while loading, a render error in a widget, a CSP violation, an insecure context) had no path to the server at all. This ADR splits error handling into a local half that release 1 builds and a sending half that waits. It covers the client error endpoint in core, the System health page, the later telemetry sender and the packages the server may use for it.

## Decision drivers

* The customer keeps its data; nothing leaves an installation without a company admin's choice.
* Plant admins and support need errors from browsers and the server in one place, whether or not anything is shared.
* The scope rule: a platform feature is built when a release needs it ([ADR 0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md)); the pilot needs only the local half.
* `@sentry/node` 11 pulls the FSL-licensed Sentry CLI into production installs (sentry-javascript issue #24849); self-hosted Sentry needs at least 16 GB of RAM; GlitchTip is MIT and speaks the Sentry protocol.
* Whoever runs a receiver is responsible for what it receives; IP addresses at an endpoint can be personal data.

## Considered options

* Local capture in release 1; opt-in telemetry to the project built later
* Opt-in telemetry built in release 1
* Local capture only, no telemetry ever
* A browser and server SDK sending straight to a hosted error service

## Decision outcome

Chosen option: "Local capture in release 1; opt-in telemetry to the project built later", because it gives the pilot's admins every error on System health now, keeps all data inside the installation, and leaves the receiver, its operator and its privacy notice to be decided when the sending half is built.

Release 1, the local half:

* `POST /api/web/client-errors` is authenticated, same-origin, rate-limited and capped at an 8 kB body. It takes `{ moduleId, moduleVersion, stage, code, messageTemplate, route, fingerprint }`, where `stage` is `manifest`, `entry`, `validate`, `render`, `slot`, `chunk`, `csp` or `insecure-context`. CSP reports go to the same endpoint.
* Rows land in a core table on the audit no-trigger list, grouped by fingerprint with a count. Server errors are grouped by fingerprint the same way. System health shows both ([ADR 0043](0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md)).
* Reporters in the shell: `createRoot` with `onCaughtError` and `onUncaughtError`; window `error` and `unhandledrejection` handlers, with `moduleId` taken from the catching boundary or from a stack URL under `/modules/<id>/<version>/`; the route error component; each slot boundary. Placeholder and route error components show the stage and code. A minimal status route in the shell survives a broken core remote ([ADR 0019](0019-web-shell-with-react-module-federation-remotes.md)).
* Nothing leaves the installation. Boot refuses to start with `BETTER_AUTH_TELEMETRY` set ([ADR 0051](0051-regulated-readiness-no-regret-rules.md)), and no error SDK runs in the server.

Later, the sending half, built to these rules:

* Off by default. A company admin turns it on through an audited company setting, and the settings page shows exactly which fields are sent.
* Browser errors go to the NorthMES server, never straight to the project; the server scrubs and forwards, and the consent check sits in one place.
* An allowlist, not a denylist. Sent: error type and message template, stack frames from core code, fingerprint, count, NorthMES version, enabled module and plugin ids with versions, Node and Postgres versions, a random installation id. Never sent: names, emails, IP addresses, article numbers, order numbers, customer data, GraphQL variables, request bodies, free-text messages.
* Plugin frames are reduced to `plugin:<id>@<version>`.
* Errors are batched by fingerprint from a queue in Postgres, so an offline plant sends later. The admin can open a log of what was sent and when.
* The receiver is in the EU and speaks the Sentry protocol; GlitchTip is the realistic self-hosted choice. It would live under a northmes.dev subdomain. Its operator, legal entity and privacy notice are decided when it is built.
* `@sentry/node` 11 stays out of the server. The sender pins a version without the CLI dependency, uses `@sentry/core`, or posts Sentry envelopes over plain HTTP; the choice is re-checked against issue #24849 at build time.
* Feature-usage analytics, if ever wanted, is a separate opt-in.

### Consequences

* Good, because the pilot's admins see browser and server errors, grouped and counted, from the first release.
* Good, because no data leaves an installation in release 1, which keeps the pilot's data processing simple.
* Bad, because the project learns about errors only through support until the sending half exists.
* Bad, because the local error table grows on a busy installation; grouping by fingerprint keeps one row per error kind.
* Neutral, because the sending half reuses the local table and fingerprints, so building it later adds a queue, a scrubber and a sender, not a new capture path.

### Confirmation

* Playwright with planning's lazy board chunk deleted: the boot log contains `web.asset_missing` and System health shows "planning: 1 missing file".
* Playwright with planning's `./module` throwing at evaluation: a client error row with stage `entry` and `moduleId` `planning` appears within 2 s.
* Playwright with core's remote deleted: the shell status route still renders.
* A fixture widget that throws on render for one order and rejects a promise for another: the board stays usable, the fallback has a role and an accessible name and receives focus, and two client error rows exist.
* Integration test on the endpoint: a request without a session or from another origin is refused; a body over 8 kB is refused; the same fingerprint twice raises the count and adds no row.
* The license gate's never-installed list holds `@sentry/node` for the server ([ADR 0040](0040-dependency-license-policy-ci-gate-and-sbom.md)). Boot with `BETTER_AUTH_TELEMETRY` set exits non-zero.
* When the sending half is built: with the setting off, a fake receiver gets zero requests; a payload schema test fails on any field outside the allowlist; a stack with plugin frames sends only `plugin:<id>@<version>`; with the receiver unreachable, batches stay queued and send after it returns; the sent log matches what the fake receiver got.

## Pros and cons of the options

### Local capture now, telemetry later

* Good, because it matches the scope rule and keeps the pilot free of outbound data.
* Bad, because cross-installation error patterns stay invisible to the project for now.

### Opt-in telemetry in release 1

* Good, because errors reach the project from the first installation.
* Bad, because it needs a receiver, its operator, a privacy notice and scrubbing work that no release 1 user asks for.

### Local capture only, forever

* Good, because nothing ever leaves an installation.
* Bad, because it contradicts Krister Johansson's decision and leaves errors that only many installations reveal to support tickets.

### SDK sending straight to a hosted service

* Good, because it is quick to wire up.
* Bad, because operator PCs often have no internet, consent would be checked in many places, and the current Node SDK brings an FSL-licensed binary into production installs.

## More information

* Related ADRs: [0019](0019-web-shell-with-react-module-federation-remotes.md), [0040](0040-dependency-license-policy-ci-gate-and-sbom.md), [0043](0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md), [0046](0046-observability-structured-logs-host-checks-and-optional-opentelemetry.md) (no Sentry SDK in the server; logs to support), [0048](0048-documentation-on-docs7-at-docs-northmes-dev.md) (names under northmes.dev), [0051](0051-regulated-readiness-no-regret-rules.md), [0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md).
* Plan: [06 web and UX, browser errors reach the server](../plan/06-web-and-ux.md#browser-errors-reach-the-server), [12 operations and security](../plan/12-operations-and-security.md), [14 roadmap](../plan/14-roadmap.md).
* sentry-javascript issue on the CLI dependency: https://github.com/getsentry/sentry-javascript/issues/24849.
* Revisit when the project decides to build the sending half; decide then the receiver, its operator, the privacy notice and the SDK path.
