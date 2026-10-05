---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: internal research notes 01, 03, 15, 16, 17, 18, 19, 20, 21, 22, 24, 29, 32 and 33
informed: contributors and coding agents
release: "1"
needs-confirmation: "product owner (reporting in NorthMES or Pyramid, corrections, operators per station); pilot IT (station network, hardware)"
---

# Online operator station in the production-start module

## Context and problem statement

Operators report on the shop floor what started, paused and finished, and how many good and scrap pieces came out. Krister Johansson decided that release 1 has minimal operator reporting, online only: start, pause, finish, and good and scrap quantities with a reason. Krister Johansson also decided that operators sign in at a station by badge or personal login. The original requirements asked the station to survive a network outage without losing reports, through a queue on the station. The decided scope leaves the queue out, so release 1 must say what it promises instead.

A station is a shared PC at one or more machines, with a keyboard-wedge badge reader, gloved hands and a network that can drop. Reports feed planning (status and progress on the board, the fixed rows of autoplan) and ERP write-back. This ADR covers the production-start module (module id `production-start`, prefix `productionStart`, schema `production_start`), the station identity, operator sessions and badges in core, and planning's `reportOperationProgress`.

## Decision drivers

* Krister Johansson's decision of minimal online-only reporting, built inside the 5 to 7 days the release 1 ledger gives the station slice.
* A report is a shop-floor fact: planning rules never refuse it, and nothing edits it afterwards ([ADR 0051](0051-regulated-readiness-no-regret-rules.md), rules 4 and 5).
* A retry after a timeout never creates a second report.
* The shared device holds no admin credentials, has one operator at a time, and never sends one operator's entries under another operator's name.
* A station sees and changes only its plant and its own equipment.
* Quantity reports must not turn planners' drafts stale ([ADR 0029](0029-per-planner-drafts-soft-locks-and-the-plan-revision.md)).
* WCAG 2.2 AA on the station: 2.1.4 character key shortcuts, 2.2.1 timing adjustable, 2.5.8 target size and 3.3.8 accessible authentication ([ADR 0021](0021-accessibility-target-wcag-2-2-aa.md)).
* The pilot's operators may keep reporting in Pyramid instead; the product owner has not answered yet.

## Considered options

* An online-only station in the production-start module, with a stated promise for unsent entries
* A station with an outage queue in release 1: an IndexedDB outbox and a service worker
* No station in release 1: operators keep reporting in Pyramid, and statuses and quantities arrive through the connector

## Decision outcome

Chosen option: "An online-only station in the production-start module, with a stated promise for unsent entries", because it is the decided scope for the station and it gives operators a working station inside the slice's budget. The promise, the states and the mechanics below come from the stress test (internal research note 32). For release 1 the promise replaces the outage queue of the original requirements; the queue arrives in a later release.

### Where it lives

* The station is the route `/station/$stationId` in the production-start remote, mounted on the shell's second mount point with a full-screen layout ([ADR 0019](0019-web-shell-with-react-module-federation-remotes.md)). Station remotes load with a 30 s timeout, and every station chunk preloads right after sign-in.
* Station identity, operator sessions and badges live in core. Reports live in `production_start`. Production-start calls `planning.reportOperationProgress` in the same transaction, so planning does not depend on production-start ([ADR 0002](0002-modular-monolith-with-module-owned-schemas-and-process-roles.md)).
* In scope: switch equipment; start, pause and finish a job order; good and scrap quantities with a scrap reason; corrections; the last five reports on the selected job. No OEE.

### The online-only promise

* Unsent entries stay on the screen and in localStorage (inside try/catch, cleared after a confirmed response). They are never sent without the operator pressing Send. Loss on device failure is accepted.
* Two states: Connected, and Disconnected with the banner "No connection to NorthMES. Entries stay on this screen and are not sent until the connection is back." (`role=status`, announced once on change). Send, Start, Pause and Finish while disconnected show an inline error and keep the entries.
* The job list and the scrap reasons are fetched at sign-in and read cache-first. Station mutations never use `optimisticResponse`.
* When the app is down, Caddy serves a maintenance page that retries every 10 s and returns to the original URL ([ADR 0044](0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md)). The station shell reloads by itself only when it is idle, no form holds unsent input and the module versions changed.
* Upgrades run between shifts with a paper fallback form ([ADR 0045](0045-backups-restore-drills-upgrades-and-rollback.md)). Stations use a persistent browser profile over HTTPS, never Edge kiosk mode, which runs InPrivate and drops the station cookie.

### Reports are facts

* `productionStart.start` and the quantity report call `planning.reportOperationProgress` in the same transaction. It moves the job order from planned to active and adds to the reported quantities in `planning.job_order_progress` without bumping `job_order.version`.
* `planning.commitScheduleChanges` and the autoplan apply add `and status = 'planned'` to any change of machine or start. Postgres re-checks the predicate after the lock wait, so no advisory lock is needed.
* The equipment check is "the reporting equipment belongs to the station". A report stores `job_order_id`, `production_order_operation_id` and `equipment_id` and is accepted on locked, moved, cancelled and finished job orders. A different machine, or a finished or cancelled job, sets a conflict flag in a separate planning table, and the board shows the Conflict state. The station's job list includes job orders with an open run on its equipment, whatever their planned machine.
* A planner's move of the unreported remainder of a started job is refused until the product owner decides about splitting it.
* Fact commands (start, pause, finish, reportQuantity, correctReport) are not validatable in release 1. Later extension points on them are advisory only ([ADR 0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md)).
* UPDATE and DELETE on the report tables are revoked from `nm_app`.

### Idempotent submits

* The client creates the report's uuidv7 `client_report_id` when the form opens, keeps it across retries, edits and reloads, and replaces it only after a confirmed response.
* Before `audit.begin_command` the server selects by `client_report_id` and returns a stored report with `replayed: true`. On a unique violation race (23505) it rolls back and returns the stored row, which leaves one command row.
* Start, pause and finish are idempotent by target state. Station mutations use `AbortSignal.timeout(15000)`. While one is in flight, Send is `aria-disabled`, a status says "Sending", and the client idle timer does not fire.

### Station identity and operator sessions

* A station is a device identity: a Better Auth api-key credential with `configId` `station` in a `__Host-nm_station` cookie (SameSite=Strict, Path=/). It is registered with a pairing code that an admin approves from their own signed-in PC, so no admin credential lands in the shared browser profile. The key has no expiry; the cookie is re-sent with a fresh Max-Age once a day.
* The gateway's principal plugin has a station branch ([ADR 0011](0011-principals-credentials-and-same-origin-rules.md)). It verifies the key (the verified hash is cached for 30 to 60 s and dropped on revocation), takes the plant from the credential's scope and rejects a differing `x-northmes-plant`. On HTTP it adds the operator from `x-northmes-operator-session` after checking that the session is open and belongs to this station; the operator bearer is a random token stored hashed. The key alone grants only `core.station:signIn` and reading its own station record. With an operator, permissions are the station ceiling intersected with the operator's permissions at the station's plant. A command precondition rejects target equipment that is not bound to the station.
* Sign-in and sign-out are the commands `core.stationOperatorSignIn` and `core.stationOperatorSignOut` under `/api/station`, with principal station, surface station and `acting_for` the user. Badge is the default method. Personal login and an optional PIN (one field that accepts paste and autofill, for WCAG 3.3.8) go through the same command.
* A partial unique index on `core.station_operator_session (station_id) where ended_at is null` allows one open session per station. Sign-in ends the open session in the same transaction with end reason `replaced`. The job's state does not change when the operator changes.
* The client idle limit is a station setting of at least 120 s, with a warning 30 s before sign-off and a "Stay signed in" action (WCAG 2.2.1). The server limit is a backstop: the client limit plus 15 minutes, or the end of the shift. On `OPERATOR_SESSION_ENDED` the client keeps the entries and sends them under a new session only when the badge scan is the same user.
* Station subscriptions authorize against the station ceiling only and carry no operator. Stations cannot send mutations over the WebSocket, and `core.credential.revoked` closes that credential's sockets with 4403.
* 5 unknown badges within 60 s lock badge sign-in on that station for 5 minutes and write a security event. A key used from a new source IP writes a security event too; `allowedCidrs` per station is optional.

### Badge input, quantity bounds, corrections and times

* Enter in a station number field never submits; only the Send button does. Badge input is captured only in the focused badge field and on the Switch operator screen, with no global key listener (WCAG 2.1.4, speech input). Every station screen has a visible Switch operator button.
* When good plus scrap exceeds the remaining quantity times a plant setting (default 1.5), the server requires `confirmedLargeQuantity: true` and otherwise returns `QUANTITY_CONFIRMATION_REQUIRED`. A report with the same job and quantities within 10 minutes under another key returns `REPEAT_CONFIRMATION_REQUIRED` unless `confirmedRepeat` is set.
* `productionStart.correctReport({ originalReportId, deltaGood, deltaScrap, scrapReasonId?, reason, clientCommandId })` inserts a report of kind `correction` with `corrects_report_id`. Only original reports can be corrected, the net per original stays at or above zero (`CORRECTION_EXCEEDS_ORIGINAL`), and write-back sends the new net. Proposed permission: the operator role gets `productionStart.report:correct` for reports from the same station in the current production day; other corrections need the supervisor role.
* A report stores `device_time`, `received_at` (database clock) and a nullable `effective_at`; shift attribution waits for OEE. The reserved prefill input `{ source, quantity, ref? }` rejects source `machine` with `UNSUPPORTED_PREFILL_SOURCE` in release 1.
* The CSS variable `--nm-target-min` (24 px by default, 44 px in the station layout, final value after a glove test on pilot hardware) drives every `@northmes/ui` interactive primitive, so shell chrome and plugin panels follow.

### Open questions and the cut

* Product owner, by 2026-10-30: do operators report in NorthMES or keep reporting in Pyramid? If Pyramid, the station moves to a 0.x release, and statuses and quantities arrive through the connector's `reportSourceProgress` ([ADR 0032](0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md)).
* Product owner: who may correct a report; several operators per station (the index then moves to `(station_id, user_id)` and reports name the operator); whether a job pauses when the operator changes; "scan anywhere" as a per-station option; the upgrade window.
* Pilot IT: station network ranges, station hardware, OS and browser versions, screen size, gloves and the badge reader model.
* The station is item 5 of the cut order in [ADR 0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md). A cut removes it together with the `station` api-key configuration, the station principal and `core.badge_assignment`.

### Consequences

* Good, because operators get start, pause, finish and quantity reporting in release 1 with no service worker or client-side queue to build and test.
* Good, because a report is never lost to a planning rule, never duplicated by a retry and never sent under the wrong operator.
* Good, because quantity reports leave planners' drafts and the autoplan apply untouched.
* Bad, because entries typed during an outage wait for the operator to press Send again, and a device failure loses them.
* Bad, because upgrades need a window between shifts and a paper form.
* Bad, because the station adds a principal type, a credential configuration and a badge table to core, which stay even if the station is cut later.

### Confirmation

Tests come first ([ADR 0041](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md)); names marked proposed in [09-operator-station.md](../plan/09-operator-station.md), section 13, may change in the task.

* `station-offline.spec.ts`: with the browser offline, the report form opens with its scrap reasons; Send shows the inline error, keeps the values and announces the offline message once; back online, Send saves one report; axe passes in the disconnected state.
* `station-server-down.spec.ts`, against the Compose stack: with the app stopped, the station URL shows the maintenance page; after the app starts, the station screen returns within 30 s without input.
* `station-double-submit.spec.ts`: the server commits while the browser sees a failure; Send twice, reload, Send again: exactly one `production_start.report` row.
* `started-row-freeze.int.test.ts`: when a start commits first, the planner's save fails for that row; when the move commits first, the report succeeds on the reporting equipment with the conflict flag set and no `permission.denied` event; a report on a locked job succeeds; autoplan over a started row changes only its end; an `nm_app` UPDATE on the report table fails with permission denied.
* `report-idempotency.int.test.ts`: the same `client_report_id` sent twice in sequence and twice concurrently gives one report row and one `audit.command` row, the second response marked `replayed`; finish twice returns the current state.
* `station-session.int.test.ts`: two concurrent sign-ins on one station leave one open session and the other ended with reason `replaced`, and the job order is still started.
* `station-principal.int.test.ts`: another station's operator session returns 403; a differing `x-northmes-plant` returns 403; a mutation over the station WebSocket is rejected; revoking the key closes the socket with 4403; six unknown badges within a minute return 429 on the sixth and write one lockout event; a report on equipment not bound to the station is `FORBIDDEN` with `productionStart.station_equipment`.
* `station-badge.spec.ts`: with Good quantity focused, typing `0004512345` and Enter with a 5 ms delay sends zero mutations.
* `report-rules.int.test.ts` and `report-correction.int.test.ts`: the confirmation codes, `UNSUPPORTED_PREFILL_SOURCE`, a correction of minus 120 and minus 3 leaving two rows and a net of zero, and `CORRECTION_EXCEEDS_ORIGINAL`.
* `station-settings.test.ts`: the idle limit schema rejects 30 and 119 and accepts 120. `station-idle.spec.ts`: the warning appears 30 s before sign-off and entries survive the sign-off. `station-targets.spec.ts`: at 1280 x 800 with touch, every visible interactive element measures at least 44 by 44 px.

## Pros and cons of the options

### Online-only station with a stated promise

* Good, because it fits the decided scope for the station and the slice budget.
* Good, because HTTPS, idempotent submits and device time stored as data are already the groundwork the later queue needs.
* Bad, because release 1 does not meet the original outage-queue requirement.

### Station with an outage queue in release 1

* Good, because reports typed during an outage are sent automatically when the network returns.
* Bad, because a service worker, an IndexedDB outbox, replay ordering and their tests do not fit the slice, and the decided scope for the station excludes it.

### No station in release 1

* Good, because it saves the slice and keeps reporting where operators already work.
* Bad, because it depends on the product owner's answer, gives NorthMES no shop-floor facts of its own, and contradicts the decided scope for the station unless that answer is Pyramid.

## More information

* Related ADRs: [0002](0002-modular-monolith-with-module-owned-schemas-and-process-roles.md) dependency direction, [0010](0010-identity-with-better-auth-roles-and-permissions-in-core-tables.md) operators as full users and badges, [0011](0011-principals-credentials-and-same-origin-rules.md) principals, [0013](0013-audit-trail-written-in-the-command-transaction.md) audit and security events, [0018](0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md) reconnects, [0019](0019-web-shell-with-react-module-federation-remotes.md) mount points, [0021](0021-accessibility-target-wcag-2-2-aa.md) accessibility, [0029](0029-per-planner-drafts-soft-locks-and-the-plan-revision.md) drafts and the plan revision, [0032](0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md) write-back of reports, [0044](0044-on-prem-deployment-with-docker-compose-and-mandatory-tls.md) TLS and the maintenance page, [0051](0051-regulated-readiness-no-regret-rules.md) regulated rules, [0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md) cut order.
* Plan: [09-operator-station.md](../plan/09-operator-station.md) (data model, sign-in flow, browser setup on station PCs, later releases); [07-production-planning.md](../plan/07-production-planning.md); [16-open-questions.md](../plan/16-open-questions.md).
* Revisit when the product owner answers where operators report, when OEE or Data collection needs shift attribution and machine prefill, and when the outage queue is scheduled.
