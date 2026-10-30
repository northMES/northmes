---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: internal research notes 04, 06, 07, 08, 14, 18, 19, 20, 23, 27, 32, 33, 34 and 35
informed: product owner, the pilot customer, contributors and coding agents
release: "1"
needs-confirmation: "maintainer (ledger additions)"
---

# Release 1 scope under option B and the scope rule

## Context and problem statement

Release 1 was framed as production planning plus the platform it needs, built by one developer with coding agents for a pilot test around April 2027. An internal stress test of the design (internal research note 32) found that release 1 as decided does not fit that window, and offered two options: option A, an April 2027 planning pilot with a narrow slice and five items moved to 0.x releases during the pilot; or option B, the full release 1 scope with the pilot moved to the date measured velocity gives. Krister Johansson chose option B.

This ADR records the release 1 scope, how the pilot date is set, the work ledger that measures progress, the checkpoints, the order of cuts if velocity is low, and the scope rule that keeps platform work from growing. It also records principles decided without a build date (error telemetry, notifications, ingestion, file storage, the Events API, webhooks and actions) and the later platform work, each with its trigger. It covers planning for every epic and the plan documents.

## Decision drivers

* Krister Johansson wants the full feature set in the first release the pilot sees, AI included; the pilot is not asked to opt out of AI.
* One developer builds with coding agents. Every task passes the maintainer at several gates: at 180 to 240 tasks and 15 to 25 minutes each, the gates alone take 6 to 12 days.
* The estimates already assume coding agents, so a forecast on a faster line would count that speed-up twice.
* A date fixed before any velocity is measured is a guess.
* Each platform feature built early costs the one developer; later modules must still fit without rework.

## Considered options

* Option A: an April 2027 planning pilot; the assistant, agent proposals, late live write-back, the operator station and `/mcp` ship in 0.x releases during the pilot
* Option B: the full release 1 scope; the pilot date comes from measured velocity
* The full scope with the April 2027 date kept

## Decision outcome

Chosen option: "Option B", because it keeps every item Krister Johansson wants in the first release and replaces a guessed date with a forecast from measured work.

Release 1 holds:

* The planning module: scheduling engine, plant calendars, per-planner drafts with soft locks, the planning board.
* The Pyramid connector: orders, operations, materials, stock, write-back.
* A minimal online operator station.
* The AI provider port with provider settings and usage metering; a read-only planning assistant; agent proposals that reach the planner's draft.
* The MCP read-mostly planning toolset.
* The internal `defineModule` contract with two example plugins (a backend command validator and a frontend widget).
* The platform these need: identity, tenancy, commands, audit, events and jobs, Federation, the web shell, health, operations and backups.

The limits inside each area and what stays out are in [01 product and scope](../plan/01-product-and-scope.md#release-1-scope-under-option-b).

The pilot date:

* The April 2027 date is dropped. The stress test estimated the option B pilot window at 2027-08-24 to 2028-01-20 on its 2x line and gave no 1x figure; on the 1x line, the basis of the estimates themselves, the window falls later.
* `docs/plan/README.md` carries one row per week: merged tasks and the raw ledger days they earn as shares of their epics' estimates, the cumulative total against the 1x line, and, once handoff runs start, median gate minutes per task and merged tasks per day.
* At a checkpoint, the remaining ledger plus the stabilization reserve, divided by the measured rate of raw ledger days per working day, gives the earliest install date. The pilot test starts at least 4 weeks after the install. From M3, 10 percent of capacity is held as a stabilization reserve. No forecast script is built.
* Nobody installs or upgrades in the week of a daylight saving change (2027-10-31, 2028-03-26).

Checkpoints (dates after M3 are proposals):

| Checkpoint | Date | What must hold | What it decides |
|---|---|---|---|
| M0 | 2026-10-30 | ADRs that the first epics need are accepted, this one included; product owner answers recorded or turned into settings with ADR defaults; three to six pilot acceptance criteria written | Decisions; the ledger opens |
| M1 | 2026-11-20 | `e2e/skeleton.spec.ts` and the resolve-hook test required in `ci / gate`; the first weekly rows | Board spike fallback if it failed twice |
| M2 | 2027-01-22 | Velocity checkpoint 1: the first forecast from at least eight weekly rows; the connector's parser, mapper and file mode done; live write-back verified or shadow mode with the daily report | A provisional pilot window |
| M3 | 2027-02-26 | Compose on a pilot-like VM with pgBackRest and a timed restore; the write-path decision if Pyramid has none; velocity checkpoint 2; the reserve starts | A narrower window; review of the cut order |
| M4 | 2027-04-30 | Velocity checkpoint 3 | The maintainer fixes the install date and the pilot test start, and applies cuts if the forecast misses |

The ledger counts the platform estimate (35 to 51 days, internal research note 20) once, with the Federation (6 to 9) and web shell (19 to 29) estimates included in it. Additions from the stress test, which the maintainer still confirms:

| Addition | Estimate (raw days) |
|---|---|
| Shared building blocks, net (internal research note 33) | 14 to 34 |
| Units and the unit catalog | about 9 |
| The list kit, gross, overlapping the shared building blocks | 17.5 to 24 |
| Draft storage, commit, locks and row statuses | 4 to 7 |
| The station slice with the cheaper fixes | 5 to 7 |
| Accessibility work, offset by about 2 days of cuts | 5 to 7 |
| Agent proposals limited to moves of existing job orders | 8 to 12 |

Most other stress-test fixes have no estimate and sit in the foundation.

Cut order if velocity is low. Items 3 to 7 change scope Krister Johansson decided, so each needs Krister Johansson's decision at a checkpoint. A cut moves the item to a 0.x release during the pilot; it does not leave the product.

1. Generator work: `objectFromZod`, the module generator, the command generator, the settings cascade below company and plant.
2. Small cuts inside kept features: click-to-place on the board and the ghost outlines of other planners' drafts.
3. The `/mcp` endpoint (8 to 13 days); the SDK tool definitions and the shared runner stay for the assistant.
4. Live Pyramid write-back, if the write method is late and the product owner accepts double entry for a set period.
5. The operator station (5 to 7 days), cut together with its station API key configuration, the station principal and `core.badge_assignment`; this needs the product owner's answer that operators keep reporting in Pyramid.
6. Agent proposals (8 to 12 days), with the propose tool.
7. The read-only assistant (about 21 days); the provider port, provider settings and usage metering stay.
8. If the board spike fails twice: the job order table view with the shared Move dialog plus a read-only timeline.

The scope rule:

* A platform feature is built only when a release needs it. Everything else stays documented design with the trigger that brings it in.
* No decorator, manifest key or flag ships without the code that reads it, in the same task ([ADR 0022](0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md)).
* An item enters release 1 only by the maintainer's decision, recorded in this ADR's ledger table. An item leaves only through the cut order.
* A task moves to Ready only when every ADR it links is accepted with no open needs-confirmation ([ADR 0001](0001-record-architecture-decisions-in-madr.md)).

Principles decided without a build date:

| Principle | Release 1 instead | Trigger |
|---|---|---|
| Notifications are a core module | Host alerts through hostcheck and the customer's monitoring or SMTP relay ([ADR 0046](0046-observability-structured-logs-host-checks-and-optional-opentelemetry.md)); budget warnings and restore notices as shell banners; autoplan results through the requester's subscription | A release needs notifications |
| REST is the core ingestion endpoint; MQTT and OPC UA come as adapter modules on the same ingestion port, which has a unit step (about 2 days on top of the unit catalog); time-series storage goes through the storage port with plain Postgres as the default backend ([ADR 0059](0059-time-series-storage-port-with-an-open-default-backend.md)) | Nothing | Data collection starts |
| Opt-in error telemetry ([ADR 0052](0052-error-telemetry-opt-in-and-deferred.md)) | Local capture on System health | Built later |
| File storage port with driver plugins ([ADR 0054](0054-file-storage-port-with-a-postgres-driver.md)) | No files stored | A release needs files |
| Events API with commit-ordered cursors; Standard Webhooks with `request-filtering-agent` and a three-day retry schedule; actions | Nothing | A consumer that needs them |

Later platform work and its triggers: the integration REST API with scoped tokens (the first outside system); the Integrations page beyond the AI and Pyramid cards, OAuth applications and machine-to-machine auth (none named); the reporting schema (a customer asks for BI access); CSV and Excel import for registers (the first customer without an ERP); list export as an audited command (a pilot user asks); comments and mentions (a second entity type needs them); a command palette (none named); Helm values and partner hosting docs (a partner); the public demo under a `demo` environment (outreach); MCP Apps views and WebMCP (a client the customer uses can reach the server; WebMCP leaves its origin trial); the app repository, `northmes upgrade`, codemods and override tracking (after 1.0).

### Consequences

* Good, because the pilot sees the whole product Krister Johansson designed, and the date rests on measured work.
* Good, because the cut order is fixed in advance, so a low forecast leads to a planned cut, not an improvised one.
* Bad, because the pilot starts months later than first planned, and the product owner waits longer for feedback.
* Bad, because the weekly row and the checkpoints cost the maintainer time every week.
* Neutral, because cut items still ship, in 0.x releases during the pilot.

### Confirmation

* Plan check at every checkpoint: `docs/plan/README.md` has one weekly row per week since M1 with the four fields; the checkpoint records its forecast in the roadmap.
* Definition of ready: only Krister moves a task to Ready, and only when every ADR it links is accepted with no open needs-confirmation ([ADR 0001](0001-record-architecture-decisions-in-madr.md)).
* Boot catalog check: enabling the production-start module without the station API key configuration fails boot, so the station and its parts are cut or kept together.
* Review checklist from ADR 0022: a decorator, manifest key or flag without the code that reads it is rejected.
* Shaping check: an issue for a new release 1 item without a row in this ADR's ledger table is not created.

## Pros and cons of the options

### Option A

* Good, because the planning pilot could start in April 2027.
* Bad, because it needed an earned rate of at least 1.5 raw ledger days per working day (41 days by M1, 97 by M2), and it moves five items Krister Johansson wants out of the first release.

### Option B

* Good, because the full scope ships and the date follows evidence.
* Bad, because the pilot moves to a window estimated at 2027-08-24 to 2028-01-20 or later.

### Full scope with the April date

* Good, because nothing changes in the plan.
* Bad, because the stress test showed it does not fit, which makes it a blocker, not an option.

## More information

* Related ADRs: [0001](0001-record-architecture-decisions-in-madr.md), [0005](0005-postgres-18-official-image-with-pgbackrest-timescaledb-deferred.md), [0022](0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md), [0030](0030-a-planning-board-built-in-house.md) (board spike fallback), [0033](0033-online-operator-station-in-the-production-start-module.md), [0034](0034-mcp-surface-one-endpoint-a-read-mostly-planning-toolset.md), [0035](0035-ai-provider-port-with-customer-configured-providers.md), [0036](0036-agent-proposals-as-planning-records-a-person-commits.md), [0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md), [0049](0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md) (gate time, epic order), [0052](0052-error-telemetry-opt-in-and-deferred.md), [0054](0054-file-storage-port-with-a-postgres-driver.md).
* Plan: [01 product and scope](../plan/01-product-and-scope.md), [14 roadmap](../plan/14-roadmap.md), [16 open questions](../plan/16-open-questions.md), [17 risks](../plan/17-risks.md), [README](../plan/README.md).
* Revisit at M2, M3 and M4, and whenever the maintainer adds an item to release 1.
