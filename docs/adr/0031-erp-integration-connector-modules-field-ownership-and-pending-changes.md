---
status: "proposed"
date: 2026-10-05
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: internal research notes 02, 06, 08, 10, 12, 14, 16, 20, 22 and 32
informed: contributors and coding agents
release: "1"
needs-confirmation: "product owner (field ownership, spread rule)"
---

# ERP integration: connector modules, field ownership and pending changes

## Context and problem statement

NorthMES is built first for companies without an ERP. When a customer has one, it connects through one integration module, and nothing in core or planning is specific to that ERP: this is the product owner's rule. The pilot customer runs the Pyramid ERP, and Krister Johansson decided that its connector is in release 1.

Once both systems can change the same production order, three questions need an answer. Where does ERP-specific code live, and how does it write into NorthMES? Which system owns each field? What happens when the ERP changes an order that a planner is working on? A fourth question is whether release 1 needs an integration API for outside systems.

This ADR gives the rules every ERP connector follows. It covers the connector modules, the canonical import commands of core and planning, pending changes, field ownership and the REST surface of release 1. The Pyramid specifics (transport, parsing, echo detection, write-back modes, dates) are in [ADR 0032](0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md).

## Decision drivers

* Core and planning stay ERP-agnostic, so a second connector needs no change in core.
* An import passes the same pipeline as a user's command: Zod contract, permission at the target's scope, audit, validators and outbox events ([ADR 0012](0012-commands-as-the-single-write-path.md)).
* One developer: no extra deployable, and no API tokens or idempotency store before an outside system needs them.
* A poll every 5 minutes must not disturb planners' drafts or move their work.
* Field ownership is open: the product owner said the planning tool is master over the ERP for every field it can change, while the working answer in the original requirements gives the ERP the business facts and NorthMES the planning fields.
* Nothing is dropped silently: every row error and every rejected change stays visible.

## Considered options

* In-process connector modules with per-field ownership and pending changes for touched orders
* In-process connector modules where NorthMES is master over every field it can change
* In-process connector modules where every ERP change applies at once
* An outside connector service that calls a NorthMES integration REST API with scoped tokens
* A generic CSV or Excel import as the first integration, with ERP data moved as files

## Decision outcome

Chosen option: "In-process connector modules with per-field ownership and pending changes for touched orders", because it keeps ERP code out of core without a second deployable, runs every import through the normal command pipeline, and protects the orders planners work on without hiding ERP changes from them. Krister decided the Pyramid connector with write-back for release 1. The module shape, the ownership default and pending changes come from internal research notes 10 and 20 and the stress test (internal research note 32). Field ownership and the spread rule wait for the product owner.

### Connector modules

* One connector module per ERP, on the same `defineModule` contract as every module ([ADR 0003](0003-module-package-shape-and-the-definemodule-manifest.md)). It depends on core and planning. Core and planning never import a connector ([ADR 0002](0002-modular-monolith-with-module-owned-schemas-and-process-roles.md)).
* The Pyramid connector is the in-repo module `modules/pyramid-connector` (module id `pyramid-connector`, prefix `pyramidConnector`, schema `pyramid_connector`), licensed AGPL-3.0-or-later like the rest of core. Everything Pyramid-specific stays inside it: field names, status codes, date formats, units, CustomData keys and setup-row conventions.
* The connector runs in process. Polling runs as pg-boss cron jobs in the `worker` part; the file upload endpoint and the connector's subgraph belong to the `api` part; write-back consumes planning's committed events through the outbox ([ADR 0014](0014-outbox-event-log-and-pg-boss-jobs.md)).
* Imports go through core's and planning's canonical import commands under the connector's system principal with surface `connector` ([ADR 0013](0013-audit-trail-written-in-the-command-transaction.md)). Each poll opens a run command. Each changed order opens its own command in its own transaction, with `correlation_id` the run id and `causation_id` the run command id. An unchanged order or run writes no order command.
* One connector instance serves one company. Each order maps to a plant through warehouse-to-plant rules with a default plant; a row that matches no rule goes to the import inbox.
* External references are opaque strings in the `externalRef` value type of `@northmes/contracts`, matched by string equality, and the connector's link table maps them to NorthMES ids.
* Connector data reaches planning screens only through planning's slots: `planning/board/block-fields/v1` for the pending-change badge, the "differs from ERP" flag and the "not mirrored" marker, and `planning/board/header/v1` for the board header line "Pyramid data as of <time>" (slot ids proposed in [ADR 0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md)).
* Pending changes live in the connector's schema in release 1. A shared core import service waits for a second connector. A generic CSV and Excel import is not in release 1.

### No integration REST API in release 1

The connector runs in process, so release 1 needs no integration REST API and no API tokens for outside systems. REST in release 1 is limited to these routes ([05-graphql-and-apis.md](../plan/05-graphql-and-apis.md)), in the route families of [ADR 0064](0064-rest-routes-under-api-v1-and-openapi-from-zod-contracts.md):

* First-party routes: the Pyramid XML upload `POST /api/v1/pyramid-connector/import-file`, `/api/v1/web/modules`, `/api/v1/web/client-errors`, `/api/v1/ai/chat` and `/api/v1/station`.
* The library family: Better Auth at `/api/v1/auth/*`.
* Root routes: the health endpoints.

The integration API is the public API family of ADR 0064, `/api/v<major>/<module-id>/...`, and release 1 has no route in it. It comes when an outside system needs it, with integration tokens bound to a scope node, OpenAPI generated from the Zod contracts and an oasdiff gate in CI. Its creates are idempotent through the client uuidv7 `id` that create command inputs already carry, so it needs no idempotency store. Krister Johansson decided that machine data ingestion later goes through a core REST endpoint, with MQTT and OPC UA as adapters; that is work for Data collection and separate from ERP connectors. As a public route, the ingestion endpoint sits under the id of the module that owns the ingestion port ([ADR 0059](0059-time-series-storage-port-with-an-open-default-backend.md)).

### Imports write only changed rows

`upsertProductionOrder` carries header, operations, materials and external data in one command, but it updates only rows whose own columns differ (`update ... where (columns) is distinct from (new values)`). A changed CustomData note or material line then bumps no job order `version`. The draft stale check compares planning fields or the plan revision ([ADR 0029](0029-per-planner-drafts-soft-locks-and-the-plan-revision.md)).

### Touched orders and pending changes

* An order is touched when a committed planner change exists, a live soft lock exists or one of its job orders has started. Expired draft rows do not count.
* A real ERP change (neither an echo of NorthMES's own write nor unchanged, [ADR 0032](0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md)) to a touched order becomes a pending change that records the order, the field, the ERP text and the NorthMES value.
* Accept runs `planning.commitScheduleChanges(source: externalChange)`. It takes the order's soft lock if it is free and is refused with the holder's name otherwise. It rebases the accepting planner's own draft rows: new duration at the draft position, new base version.
* Reject keeps the NorthMES value. Last seen already suppresses a repeat of the same rejected value, so there is no `rejected_value` column; a different value creates a new pending change.
* For an untouched order the import applies the change, recomputes each job order's end at its current start with the shared duration function ([ADR 0027](0027-planned-duration-formula-and-override-precedence.md)), marks resulting overlaps and precedence breaks as conflicts on the board and in the import log, and enqueues write-back.
* Proposed spread rule, for the product owner to confirm: a quantity delta goes to the last not-started job order by planned start. A decrease below the reported quantities, or an operation with no not-started job order, stays pending as "split by hand".

### Field ownership (working default)

Until the product owner answers, ownership is per field as below. Live write-back cannot be selected before the answer.

| Fields | Owner | ERP change, untouched order | ERP change, touched order |
|---|---|---|---|
| Quantity, deadline, customer, article, materials, cancellation | ERP | apply | pending change |
| Planned start and end | NorthMES | pending change | pending change |
| Equipment, hard lock, priority | NorthMES | not applied; difference logged in the import log | same |
| Status registered and delivered | ERP | apply | apply |
| Status planned to finished, reported quantities | the system operators report in (connector setting) | apply when the ERP; pending change when NorthMES | same |
| Operation template values (cycle time, retool, OEE target, pieces per cycle) | ERP, unless marked "do not update" | apply | pending change for released operations |
| Article details, groups, colors, tools after creation | NorthMES | ignore | ignore |

* A computed "differs from ERP" flag, the NorthMES value against last seen, shows on ERP-owned fields on the board and in the import log.
* Quantity and deadline join write-back only if the ERP offers a write method that accepts them.

### Consequences

* Good, because core and planning hold no ERP knowledge, and the connector contract suite lets a second connector reuse the rules.
* Good, because imports are audited, validated and evented like user commands, and an order's History shows the connector as the author.
* Good, because release 1 runs without an extra deployable, a token store or a public API to version.
* Good, because a planner's work on an order is never overwritten silently, and a rejected ERP value stays visible as a difference.
* Bad, because pending changes add a review queue for planners, and the spread rule is still open.
* Bad, because live write-back is blocked until field ownership is answered, so the pilot may start in shadow mode.
* Bad, because a second connector will have to move pending changes into a shared core service.
* Bad, because an outside system that wants to push data has no API in release 1.

### Confirmation

* The ERP connector contract suite in `@northmes/testing` runs against every connector. Its database-free part checks that the same payload twice gives the same canonical commands, that local times parse in the plant zone across DST, that unknown fields land in external data and that output validates against the contracts schemas. Its database-backed part checks inbox deduplication and write-back idempotency against the connector's fake server.
* Biome `noRestrictedImports` fails on core or planning code that imports a connector package.
* `subscriptions.contract.test.ts`: the connector subscribes to no `planning.draft.*` and no `*.soft_lock_changed` event.
* `changed-rows.int.test.ts`: a poll that changes one CustomData value leaves every `job_order.version` unchanged, and a planner's draft for that order saves without `STALE`.
* `pending-change.int.test.ts` (DR8 in [07-production-planning.md](../plan/07-production-planning.md)): with the order in A's draft and no live lock, an ERP quantity change applies; with a live lock it becomes pending and `job_order.version` is unchanged; B's accept while A holds the order is refused with A's name; A's accept rebases A's draft row and A's save succeeds. An untouched order going from 10 to 12 pieces gets a longer job order, a conflict where it now overlaps and one write-back job.
* Spread rule unit case: job orders of 5 and 5, the first started, going from 10 to 12 gives 5 and 7.
* `rejected-changes.int.test.ts`: quantity 8 on a started order creates one pending change; after reject, three more polls with 8 create none and the order shows the "differs from ERP" flag; a poll with 9 creates a new pending change.
* `settings.test.ts` in the connector: the schema refuses `writeBackMode: live` until a write method is configured and field ownership is answered.
* The route inventory test `apps/server/test/rest/routes.int.test.ts`, the one plan 05 and [ADR 0011](0011-principals-credentials-and-same-origin-rules.md) name, lists the routes of the `api` role and fails on a route that is neither on the release 1 list above nor on the root allowlist. It checks routes by family: every route is a first-party route, Better Auth's library route or a root route on the allowlist (the health routes, `/graphql`, `/mcp`, `/modules/<id>/<version>/*`, `/assets/*` and the SPA paths), and no route is in the public family.

## Pros and cons of the options

### In-process connector modules with per-field ownership and pending changes

* Good, because the ERP keeps the business facts it is the source of, and NorthMES keeps the planning fields it computes.
* Good, because the pending-change unit, the soft lock and the write-back key are all the production order.
* Bad, because it contradicts the product owner's "planning tool is master" for quantity and deadline until the product owner confirms.
* Bad, because planners must act on pending changes.

### NorthMES master over every field it can change

* Good, because it follows the product owner's words, and NorthMES never needs a review queue.
* Bad, because ERP corrections to quantity or deadline would be overwritten by write-back, or would silently disagree when the ERP has no method that accepts them.

### Every ERP change applies at once

* Good, because it is the simplest import.
* Bad, because a 5-minute poll would move or resize job orders inside an open draft and turn the planner's work stale without warning.

### An outside connector service over an integration REST API

* Good, because connectors could be written in any language and released on their own.
* Bad, because release 1 would need scoped tokens, idempotent writes, a versioned public API and a second deployable for one connector.

### A generic CSV or Excel import first

* Good, because it serves companies without an ERP connector.
* Bad, because the pilot runs Pyramid, which needs write-back that a file import does not give, and one developer cannot build both for release 1.

## More information

* Related ADRs: [0002](0002-modular-monolith-with-module-owned-schemas-and-process-roles.md) module rules, [0003](0003-module-package-shape-and-the-definemodule-manifest.md) module package, [0012](0012-commands-as-the-single-write-path.md) commands, [0013](0013-audit-trail-written-in-the-command-transaction.md) system principals, [0014](0014-outbox-event-log-and-pg-boss-jobs.md) outbox and jobs, [0027](0027-planned-duration-formula-and-override-precedence.md) duration, [0029](0029-per-planner-drafts-soft-locks-and-the-plan-revision.md) drafts and the commit command, [0032](0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md) Pyramid connector, [0033](0033-online-operator-station-in-the-production-start-module.md) operator reporting, [0039](0039-license-agpl-3-0-or-later-core-and-a-contributor-license-agreement.md) license, [0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md) scope, [0064](0064-rest-routes-under-api-v1-and-openapi-from-zod-contracts.md) route families and the public API.
* Plan: [08-pyramid-connector.md](../plan/08-pyramid-connector.md), sections 1, 10 and 18; [07-production-planning.md](../plan/07-production-planning.md), section "ERP changes on planned orders"; [05-graphql-and-apis.md](../plan/05-graphql-and-apis.md); [16-open-questions.md](../plan/16-open-questions.md); [17-risks.md](../plan/17-risks.md), R-03 and R-10.
* Revisit when the product owner answers field ownership and the spread rule, when a second connector arrives (shared core import service), and when an outside system needs the integration API.
