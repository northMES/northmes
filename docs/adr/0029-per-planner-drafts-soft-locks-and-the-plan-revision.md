---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: internal research notes 04, 05, 06, 09, 16, 17, 20, 21, 22 and 32
informed: contributors and coding agents
release: "1"
needs-confirmation: "product owner (lock level, who may break locks, save with conflicts)"
---

# Per-planner drafts, soft locks and the plan revision

## Context and problem statement

Several planners plan the same plant at the same time. The product owner described the rule: while planner A has an unsaved move on an order, planner B cannot change it, B is told who holds it, and B can break the lock. An earlier attempt at the product built one shared draft per plant with soft locks per job order and an explicit publish step (internal research note 16). Krister Johansson decided per-planner drafts with soft locks, and that Save commits a draft through one command.

Save is not the only writer. The autoplan apply, the ERP import, accepting a pending ERP change and operator reports also change job orders. The stress test of the design (internal research note 32) found that without one serialization point a late commit could hide behind an autoplan snapshot, and that an import every five minutes would bump every job order's `version` and turn every planner's draft stale.

This ADR covers the planning module's draft, soft lock and plan state tables, the command `planning.commitScheduleChanges` and the draft row statuses. The board ([ADR 0030](0030-a-planning-board-built-in-house.md)), the autoplan apply ([ADR 0028](0028-autoplan-as-a-pure-deterministic-function.md)), pending ERP changes ([ADR 0031](0031-erp-integration-connector-modules-field-ownership-and-pending-changes.md)), operator reports ([ADR 0033](0033-online-operator-station-in-the-production-start-module.md)) and agent proposals ([ADR 0036](0036-agent-proposals-as-planning-records-a-person-commits.md)) all write through it. It is recorded before the board's realtime work and before the migrations of the planning orders epic (E07).

## Decision drivers

* The product owner's rule: an unsaved move blocks other planners, who see the holder and can break the lock.
* One write path for Save, the autoplan apply, accepting an ERP change and accepted agent proposals, so command validators, the plan revision, events, audit and write-back behave the same for every source.
* No lost update when two saves, an autoplan apply, an import and operator reports race, on two replicas whose clocks may differ.
* An import that changes a note, or an operator's quantity report, must not turn drafts stale.
* The first import at the ERP's planned times already creates overlaps, so the board must tolerate them instead of refusing every save.
* An expiring lock is a time limit under WCAG 2.2 success criterion 2.2.1.
* Draft content never reaches the ERP.

## Considered options

* Per-planner drafts, soft locks per production order in their own table, one plan revision per plant, one commit command
* One shared draft per plant with soft locks per job order and a publish step
* Per-planner drafts with lock columns on `job_order`, a plan revision column per row and an advisory lock
* No drafts: every move commits at once with a version check per row

## Decision outcome

Chosen option: "Per-planner drafts, soft locks per production order in their own table, one plan revision per plant, one commit command", because it is the model Krister decided, it gives every writer at a plant one serialization point, and it keeps imports and operator reports from invalidating drafts. The table shapes, the commit command and the plan revision come from the stress test. The lock level, who may break locks and saving with conflicts wait for the product owner; the working defaults below apply until then.

### Drafts

* `planning.draft(id, plant_id, owner_user_id, version)`, unique on `(plant_id, owner_user_id)`: one draft per planner per plant, autosaved on the server.
* `planning.draft_change(draft_id, job_order_id, base_version, equipment_id, start_at, end_at, proposal_id null)` holds the moves. `start_at` is the setup start. `proposal_id` links a move that came from an accepted agent proposal.
* Moves are disabled while the subscription socket is disconnected.
* `planningMyDraft(plantId)` returns a status per row, computed in SQL:

| Row status | Meaning | Actions |
|---|---|---|
| `OK` | the lock is held and the committed row is unchanged | Save |
| `LOCK_LOST` | another planner holds the order's lock now (holder and since when) | discard, rebase |
| `STALE` | the committed row's planning fields changed after the draft was based on it (who changed it) | discard, rebase |
| `STARTED` | the job order started | discard |
| `PENDING_ERP_CHANGE` | an ERP change waits for acceptance on the order | discard, rebase after accept |
| `ROW_GONE` | the job order was cancelled or its order archived | discard |

* The stale check compares the planning fields (machine, start, end, quantity, status) or the plan revision, never the whole-row `version`.
* Read tools take a `view` argument, `committed` or `draft`. The in-app assistant defaults to the caller's draft, MCP to the committed plan.
* Optional ghost outlines show other planners' draft targets. They are a cut candidate.
* Draft tables are lifecycle class `working`: command-only, no field diffs, hard delete allowed ([ADR 0013](0013-audit-trail-written-in-the-command-transaction.md)).

### Soft locks

* `planning.soft_lock(production_order_id primary key, plant_id, draft_id, holder_user_id, taken_at, expires_at, version)`. Lock columns never go on `job_order`, where the version and audit triggers would fire on every extension.
* The first draft change to any job order of a production order locks the whole order for that draft. This matches the write-back key, the pending-change unit and autoplan's order-at-a-time loop. The product owner spoke of operations, so the order level is the working default until the product owner answers.
* Take or take over in one statement; zero rows returned means `LOCKED`:

```sql
insert into planning.soft_lock (production_order_id, plant_id, draft_id, holder_user_id, taken_at, expires_at)
values ($1, $2, $3, $me, now(), now() + $idle)
on conflict (production_order_id) do update
  set draft_id = excluded.draft_id, holder_user_id = excluded.holder_user_id,
      taken_at = excluded.taken_at, expires_at = excluded.expires_at
  where planning.soft_lock.expires_at < now() or planning.soft_lock.holder_user_id = $me
returning *;
```

* Expiry is lazy and read from the database clock, so replicas with different clocks agree and no cleanup job runs. The idle time is the planning setting `softLockIdleExpiry`. Its default waits for the product owner, and tests set it explicitly.
* A lock is extended only inside move commands and an explicit Extend action, never on a client timer. The board warns before expiry and offers a one-action extension (WCAG 2.2.1).
* Break is one command, `planning.breakSoftLock`, whose input requires a reason (trimmed, 3 to 500 characters) and `expectedHolderId`. It transfers the lock in the same statement, records the previous holder in the command detail and publishes `planning.production_order.soft_lock_changed`. A stale `expectedHolderId` returns a conflict.
* The manifest declares the permissions `lock` and `breakLock` on the job order resource. Admins get both. The planner role gets `breakLock` if the product owner agrees. The agent permission set strips both.
* Taking and releasing a lock write change rows under the entity `planning.productionOrder`. `expires_at` is on the skip list, so extensions write none.
* Save releases the locks of the orders it committed.

### Plan revision

* `planning.plant_plan_state(plant_id primary key, revision bigint)`. Every job order writer (Save, autoplan apply, import, accept-pending, operator status changes) selects the row `for update` and bumps `revision` in the same transaction when placement, locks, quantity, deadline or status change. The row lock serializes the writers of one plant.
* `CoreApiModule` exposes a per-plant calendar revision. Autoplan records both revisions in its snapshot and re-reads them under the row lock before it applies ([ADR 0028](0028-autoplan-as-a-pure-deterministic-function.md)).
* Operator progress goes to `planning.job_order_progress`, which does not bump `job_order.version`, so quantity reports never fail an apply or turn drafts stale.
* Save and accept-pending run the planning domain's `validate()` over the committed rows on the touched equipment and orders plus the change set. New overlaps and precedence breaks come back as conflicts that the planner confirms with a reason, stored in `audit.command.reason`. This is the working default; the product owner may prefer that new overlaps are refused.
* This replaces a per-row plan revision column and an advisory lock.

### Save through `planning.commitScheduleChanges`

* One internal command, `planning.commitScheduleChanges(changeSet, source: draft | autoplan | proposal | externalChange)`, serves Save, the autoplan apply and accept-pending. It is validatable, so plugin validators see every source, agent moves included ([ADR 0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md)). The shared-draft word "publish" is not used.
* Per row it checks that the soft lock is held, that the planning fields are current and that the status is `planned`. It silently re-takes an expired lock that nobody else took when the row is current. Every change of machine or start carries `and status = 'planned'`; Postgres re-checks the predicate after the lock wait, so a save that races an operator's start fails for that row without an advisory lock.
* Save is all or nothing. A refusal returns a typed list of conflicting rows, each with a reason, and writes nothing.
* On success it writes one batched update where `version` matches and the placement differs, bumps the revision, deletes the committed draft rows and their soft locks, and writes `planning.plan.revised`, `planning.job_order.scheduled` and `planning.production_order.soft_lock_changed` to the outbox ([ADR 0014](0014-outbox-event-log-and-pg-boss-jobs.md)).
* Write-back and the autoplan apply take the plant from the draft or the run, never from a default. Write-back consumes committed events only: the connector subscribes to no `planning.draft.*` and no `*.soft_lock_changed` event.
* The board's commit message uses the times the server returns.

### Consequences

* Good, because one command carries every change to the committed plan, so validators, events, audit and write-back cannot differ by source.
* Good, because the plant row lock gives all writers one order, which the race test below checks.
* Good, because imports and quantity reports no longer turn drafts stale.
* Good, because lazy expiry on the database clock needs no cleanup job and no clock agreement between replicas.
* Bad, because planners do not see each other's unsaved moves unless the optional ghost outlines ship.
* Bad, because an order-level lock also blocks a second planner from the other operations of the same order.
* Bad, because confirmable conflicts let the committed plan hold overlaps that a planner accepted with a reason.
* Bad, because all writers of a plant queue on one row. The apply budget of at most 1 s at pilot scale keeps the wait short ([ADR 0028](0028-autoplan-as-a-pure-deterministic-function.md)).
* Neutral, because the release 1 ledger adds 4 to 7 days for draft storage, commit, locks and row statuses ([ADR 0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md)).

### Confirmation

Integration tests run on Postgres from `@testcontainers/postgresql` ([ADR 0041](0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md)); the case ids come from [07-production-planning.md](../plan/07-production-planning.md).

* `draft.int.test.ts` (DR1): A and B each hold a draft at one plant; A saves; only A's changes become job order updates, B's draft is unchanged, and write-back jobs exist only for A's orders. The unique constraint on `(plant_id, owner_user_id)` holds.
* `commit-schedule-changes.int.test.ts` (DR2): one stale row returns `[{ jobOrderId, reason: STALE }]` and changes no job order; an unconfirmed new overlap returns `OVERLAP` naming the other row; with confirmation and a reason it commits and the reason is on the command row; the example validator plugin vetoes with `rejectedBy` and no change rows are written.
* `save-race.int.test.ts` (DR3), two Nest instances: two drafts that overlap on one machine race 20 times; the second save returns `OVERLAP`, and a SQL check finds no unconfirmed overlapping pair.
* `soft-lock.int.test.ts` (DR4): a move, two extensions and a save bump `job_order.version` once and leave one insert and one delete for the lock in the audit trail; two replicas with clocks 5 minutes apart report the same holder; a break with an empty reason is refused; two concurrent takes on a free order give exactly one success; a stale `expectedHolderId` returns a conflict; a viewer's break returns `FORBIDDEN` and one security event.
* `progress.int.test.ts` (DR6): a start bumps the plan revision but not `job_order.version`; a save that moves a job order that started meanwhile changes nothing for that row.
* `changed-rows.int.test.ts` in the connector: a poll that changes one CustomData value leaves every `job_order.version` unchanged, and the draft for that order saves without `STALE`.
* `events.int.test.ts` (DR9) and the connector's `subscriptions.contract.test.ts`: nothing consumes `planning.draft.*` or `*.soft_lock_changed`, so a soft lock enqueues zero write-back jobs.
* `e2e/planning/two-planners.spec.ts`: A's lock expires, B takes over and saves; when A's socket reopens, A's block shows `LOCK_LOST` and `STALE` with B's name.
* A schema test (proposed name `planning-schema.int.test.ts`) fails when `planning.job_order` gains a lock holder or lock expiry column.

## Pros and cons of the options

### Per-planner drafts, order-level soft locks, plant plan revision, one commit command

* Good, because it matches Krister Johansson's decision and the product owner's blocking rule.
* Good, because the lock unit equals the write-back key and the pending-change unit, so an order is never half in a draft and half pending.
* Good, because lock rows in their own table keep the version and audit triggers off `job_order`.
* Bad, because every draft row needs a status and discard and rebase actions, which a shared draft does not need.
* Bad, because the product owner may still ask for operation-level locks.

### One shared draft per plant with per-job-order soft locks and publish

* Good, because the earlier attempt built and tested it, and its lock rules (`judgeMove` with `PINNED`, `LOCKED`, `STARTED`) port as they are.
* Good, because every planner sees every unsaved move.
* Bad, because one planner's publish commits a colleague's unfinished moves, unless publish tracks who owns each row, which is a per-planner draft again.
* Bad, because it contradicts Krister Johansson's decision for per-planner drafts with soft locks.

### Per-planner drafts with lock columns on job_order, a per-row plan revision and an advisory lock

* Good, because it needs no extra tables.
* Bad, because every lock extension fires the version and audit triggers on `job_order`, turns other drafts stale and fills the order's History.
* Bad, because a per-row revision does not see a new overlap with another row, and an advisory lock does not cover a commit hidden behind an autoplan snapshot.

### No drafts: every move commits at once

* Good, because it is the least code.
* Bad, because every drag triggers validators and ERP write-back, and a planner cannot try a sequence of moves before committing.
* Bad, because "B cannot touch it until A has saved" has no meaning without unsaved state.

## More information

* Related ADRs: [0012](0012-commands-as-the-single-write-path.md) commands, [0013](0013-audit-trail-written-in-the-command-transaction.md) audit and lifecycle classes, [0014](0014-outbox-event-log-and-pg-boss-jobs.md) events, [0018](0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md) realtime, [0021](0021-accessibility-target-wcag-2-2-aa.md) accessibility, [0028](0028-autoplan-as-a-pure-deterministic-function.md) autoplan and its apply, [0030](0030-a-planning-board-built-in-house.md) board, [0031](0031-erp-integration-connector-modules-field-ownership-and-pending-changes.md) pending changes, [0033](0033-online-operator-station-in-the-production-start-module.md) operator reports, [0036](0036-agent-proposals-as-planning-records-a-person-commits.md) agent proposals, [0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md) validators.
* Plan: [07-production-planning.md](../plan/07-production-planning.md), sections "Fixed, frozen, held and locked rows", "Drafts, soft locks, the plan revision and Save" and "Conflicts"; [08-pyramid-connector.md](../plan/08-pyramid-connector.md), section 10; [16-open-questions.md](../plan/16-open-questions.md).
* Open for the product owner, with the working default first: soft locks per production order or per operation; admins break locks, and planners too if the product owner agrees; the idle expiry time (not set); save with confirmed conflicts or refuse new overlaps. An answer still missing on 2026-10-30 becomes a setting whose default this ADR records.
* Revisit when the product owner answers, and when the ghost outlines are built or cut.
