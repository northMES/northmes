---
status: "proposed"
date: 2026-10-05
decision-makers: "proposed by the planning session, to be confirmed by Krister Johansson"
consulted: "internal research notes 07, 09, 10, 11, 15, 16, 17, 18, 22 and 32"
informed: "product owner"
release: "1"
needs-confirmation: "product owner (frozen window, overdue rows, apply path, child orders)"
---

# Autoplan as a pure deterministic function

## Context and problem statement

Autoplan places a plant's free job orders on machines, backward from their deadlines, when a planner asks for it. The product owner's rules already form a dispatching heuristic: plan backward from the deadline, earliest deadline first with priority breaking ties, keep locked rows where they are. The earlier attempt's placement code had six known defects: it sorted by priority before deadline, released a successor from one row of a split predecessor, did not turn a backward placement into the past into a forward fallback, skipped rows without a machine, lacked the last-piece rule and checked overlaps in quadratic time. It blocked the Node event loop for 2.8 s at 500 rows. A stress test also showed that treating every row before now plus the frozen window as fixed freezes rows that were planned in the past and never started, and the ERP sample files hold many such rows.

Autoplan runs while planners edit drafts, the ERP imports changes and operators report progress, so its result must never overwrite newer work.

This ADR covers the `plan()` contract, row classes, rules between operations, the autoplan background job and its apply, the performance budget, material projection, child orders and the working defaults for open planning questions. The duration function is [ADR 0027](0027-planned-duration-formula-and-override-precedence.md); drafts, soft locks and the plan revision are [ADR 0029](0029-per-planner-drafts-soft-locks-and-the-plan-revision.md).

## Decision drivers

* Planners must be able to predict and explain the result.
* Same input, same output, for tests, idempotent re-runs and a later solver behind the same port.
* Pilot scale (40 machines, about 1 600 job orders) on one 4 vCPU host without blocking the API.
* A newer committed change is never overwritten.
* Rows planned in the past move; started rows keep their machine and actual start.
* Missing product owner answers become settings or working defaults.

## Considered options

* A pure, deterministic greedy heuristic `plan(snapshot)` in TypeScript, one order at a time, backward with a whole-order forward fallback, behind a `Scheduler` port
* A constraint solver (OR-Tools CP-SAT or Timefold Solver)
* An incremental engine that reads through a data provider and persists each order's placements before it plans the next

## Decision outcome

Chosen option: "A pure, deterministic greedy heuristic", because it implements the product owner's rules directly, gives results planners can follow, placed 1 549 job orders in 4 to 7 ms in a spike on a lean model, and keeps a solver possible behind the same port.

### Contract and order of planning

`plan(snapshot): PlanResult` lives in `@northmes/planning-domain` ([ADR 0057](0057-scheduling-domain-as-a-pure-package-in-the-planning-module.md)). `now` is part of the snapshot; nothing inside reads the database or a clock or uses randomness. The snapshot holds plain numbers (epoch milliseconds, scaled integers). Comparators compare code units and end on `id`. `plan()` has a step budget and returns `budget_exceeded` when it runs out. No solver ships in release 1.

Orders with at least one free job order are planned one at a time, sorted by deadline instant, then order priority (lower first, null last), then order number by code units, then id. Priority 1 gets the just-in-time slot and priority 2 goes late under shortage. Each order is planned backward from its deadline; if a row would start before its allowed start, the whole order is planned forward instead and listed under `fallbacks`. An order is late when its planned end is after its deadline, whether or not the fallback ran. Hand-linked child orders plan right after their parent.

### Row classes

| Class | Rows | Treatment |
|---|---|---|
| Finished | status `finished` | keep the actual interval |
| Active, paused | status `active` or `paused` | keep machine and actual start; end = `addWork` from max(now, actual start) for the remaining quantity; when good plus scrap reaches the quantity, end = now and flag `finishPending` |
| Active without actual start | imported active rows | start = max(planned start, now) on the same machine; flag `actualStartUnknown` |
| Overdue | `planned`, planned start before now, not hard-locked | free, keeps its machine, flagged `overdue`, placed with `notBefore = now + frozenHours` |
| Frozen | setup start in [now, now + frozenHours) | keep machine and order on it; shift right to max(planned start, projected end of the previous fixed row), never left |
| Held | job orders of a production order under another planner's live soft lock; an expired draft change does not hold a row | as frozen; listed with reason "held" |
| Hard-locked | operation `isLocked` | stay put; a conflict when they overlap or lie in the past ("locked in the past") |
| Free | all others | placed by the passes |

`frozenHours` are elapsed hours.

### Rules between operations

For consecutive operations P and N, lead time L sits on N and the send-ahead quantity S on P.

* Without S, N is released at the latest end over all of P's job orders plus L. With S, N is released when P's job orders together have produced S pieces, plus L; piece times come from `runSecondsFor`.
* Retool may overlap the lead time: the release bounds N's run start. The plant setting `retoolOverlapsLeadTime` (default true) moves the bound to N's setup start when false.
* Last piece: every N job order ends no earlier than P's latest end plus L plus one N cycle.
* Each operation splits into fixed and free rows. Fixed rows bound the neighbouring operations in both passes; free rows are placed within those bounds.
* A job order keeps its machine. One without a machine chooses among the operation's plannable equipment: the latest feasible start backward, the earliest finish forward; ties go to the default machine, then equipment code, then id.
* Autoplan never splits, never changes quantities and never deletes or recreates a job order. Job orders on non-plannable equipment come back under `notPlannable`. Conflicts are reported; a fixed row is never moved to repair one.

The pseudocode is in [07-production-planning.md](../plan/07-production-planning.md#algorithm).

### Result and invariants

`PlanResult` holds placements (machine, setup start, run start, end, planned seconds, resolved rates), `fallbacks`, `late` with facts per order (deadline rule in use, `asOf`, planned end, delay, fallback, fixed or locked rows, conflicts, material warnings, wait time against run time per operation), `conflicts`, `unplaced`, `notPlannable`, `invalidRates`, `held`, the row flags, `stats` and `budgetExceeded`.

Invariants for `plan()` and any later `Scheduler`: no free row overlaps any row; overlaps between fixed rows appear in conflicts; send-ahead and last-piece bounds hold; active rows keep machine and actual start; late orders are flagged, not dropped; any permutation of the input arrays gives a deep-equal result; apply, reload and plan again with the same `now` changes zero rows.

### The autoplan job and its apply

* Queue `planning.autoplan` with pg-boss policy `stately`, `singletonKey` = plant id, `retryLimit: 0` (a person requests again), `heartbeatSeconds` 10 and `expireInSeconds` from the measured run time plus a margin, so a killed worker frees the plant within 30 s ([ADR 0014](0014-outbox-event-log-and-pg-boss-jobs.md)).
* `planning.autoplan_run(id, plant_id, requested_by, status, snapshot_revision, applied_revision, attempts, stats, result, error)` with status `queued`, `running`, `applied`, `superseded` or `failed`. The board gets run status through its subscription; MCP read tools read the latest result. A second request while one is queued returns "already queued by <user>" and writes no audit row.
* Job data carries only the principal reference, credential id, correlation id, plant and request time. The worker re-resolves the principal and runs `can()`; when the role is gone the run fails with a `permission.denied` security event and changes nothing.
* The snapshot loads in one `REPEATABLE READ READ ONLY` transaction, passed to `CoreApiModule` query methods through an explicit `ReadContext`, and records the plan revision and the calendar revision. `plan()` runs outside any transaction.
* The apply runs `planning.commitScheduleChanges(source: autoplan)` as one command in one transaction, with surface `job` and the request's correlation id. It re-reads both revisions under the plan state row lock; if either moved, it rolls back and recomputes, at most 3 times, then reports "plan changed during autoplan". It writes one batched `update ... from (values ...)` where `version` matches, the placement differs and `status = 'planned'`.
* Every run publishes `planning.autoplan.finished { moved, skippedBeingEdited, late, conflicts, unplaced }` to the requester.

### Performance budget

| Scale | Measure | Budget |
|---|---|---|
| Pilot: 40 machines, 500 orders, about 1 600 job orders, 8 weeks, 4 vCPU, Node 26 | snapshot load, calendar expansion, `plan()`, apply | 500 ms, 300 ms, 1 s, 1 s |
| Pilot | request to board refetch | 5 s at p95 |
| Stress: 60 machines, 5 000 job orders, 16 weeks | `plan()`, whole run, hard cap | 5 s, 15 s, 60 s |
| Seeded pilot fixture | `resolveWallClock` calls | at most about 3 400 |
| 5 000-row run | event loop delay max, `/health/live` answer | under 100 ms, under 200 ms |

`plan()` moves to a worker thread only if the budget fails.

### Material projection and child orders

The connector emits canonical movements of kind consumption or output with `productionOrderId` and `articleId` and keeps the ERP date as a fallback; NorthMES-created orders get the same links from their materials. One pure function, `projectMaterial(placements, movements, now)`, derives dates when read: consumption at the earliest setup start among the consuming operation's job orders, output at the latest end of the last operation, the ERP date for an unplaced order, and now when overdue. It sorts by (instant, incoming before outgoing, id), sums per article over the plant's mapped warehouses and returns warnings per job order. `plan()`, the board read model and the board's draft overlay call it. Pyramid's consumption and output stock rows (T and R) are re-dated, never ignored. A material warning is a warning, not a conflict.

The Pyramid order file has no parent reference, so imported orders plan independently by their ERP deadlines. A planner may link a child to a parent by hand; linked children leave the top-level sort. A child production order is always in its parent's plant. NorthMES does not explode BOMs into new child orders in release 1.

### Working defaults until the product owner answers

| Question | Working default |
|---|---|
| Frozen window basis: elapsed hours, working hours or through the end of the next production day | elapsed hours; `frozenHours` has no default and is required when a plant is created |
| May overdue rows jump the frozen window | no: `notBefore = now + frozenHours` |
| Apply directly, or write a proposal into the requester's draft | direct apply; the proposal path would commit through the same `commitScheduleChanges` |
| Child orders | planned independently; links by hand only |
| Purchase requisitions (Pyramid A rows) in the material warning | open; planning setting `countPurchaseRequisitions` with no default |
| Where `isLocked` lives | on the production order operation, as in Pyramid |
| Operation priority | breaks ties between operations competing for one machine; defaults to the order priority |
| Splits | a job order holds part of one operation's quantity on one machine; the next operation waits for the sum of pieces over the previous operation's rows |
| Operator list per machine | sorted by planned start, priority shown as a field |
| Paused job orders | as active: keep machine and actual start |

The earlier attempt's placement, calendar, lock, operation and readiness rules are ported test-first with the six defects fixed; the worked example from ADR 0027 (TC1) gives the first failing tests.

### Consequences

* Good, because the result is reproducible and explainable: the same snapshot gives the same plan.
* Good, because the revision check and the held class keep autoplan from overwriting an open draft or a newer import.
* Good, because rows planned in the past move forward instead of freezing.
* Bad, because a greedy heuristic can leave capacity that a solver would use; planners adjust by hand or lock rows.
* Bad, because until the product owner picks the apply path, one click can move about 1 600 job orders and queue write-back for about 500 orders with no preview.
* Neutral, because deadline-first sorting can start a later-deadline order before an earlier one; planners lock rows to change that.

### Confirmation

* `plan.test.ts` in `modules/planning/domain` (AP1 to AP12 in [07-production-planning.md](../plan/07-production-planning.md#domain-unit-tests-modulesplanningdomain)): TC1 through `plan()` with now Mon 2026-11-02 05:00, `frozenHours` 0 and deadline Wed 2026-11-04 15:00 falls back, starts Mon 06:00, ends Fri 2026-11-06 14:30 and is late; two orders due Fri 2026-11-06 15:00 with priorities 1 and 2 on one machine (29 700 s each) give priority 1 Fri 06:00 to 15:00 and priority 2 Thursday; a row planned Mon 2026-11-02 06:00 to 15:00 without reports, run at Mon 2026-11-09 06:00, keeps its machine, is flagged overdue and leaves the past; an active row with quantity 1 000, good 1 000 and scrap 5 gets end = now and `finishPending`; an active row overrunning into a frozen row shifts it right; a tiny step budget returns `budget_exceeded`.
* A split case: op 20 split 3 600 + 3 600, row A locked on CNC1 from Tue 2026-11-10 06:00 for 74 700 s, row B free on CNC2, op 30 free (2 h), deadline Fri 2026-11-20 15:00: B is placed and op 30 is released from the later of A's and B's ends.
* `plan.contract.test.ts` runs `autoplanStrategyContract` from `@northmes/testing`, and a strategy that ignores send-ahead fails it; `plan.property.test.ts` checks permutation invariance and determinism.
* `domain-imports.test.ts` fails on Nest, Kysely, `pg` or `process.env` imports, and a Biome rule bans `localeCompare` and `Intl.Collator` in domain code.
* `project-material.test.ts`: with stock 5, a parent consuming 8 at op 20's start and a child output of 10, there is no warning when the child ends first and a warning on the job order when op 20 starts first.
* `autoplan-job.int.test.ts` with two Nest instances on Testcontainers Postgres: 10 concurrent requests during a run give one queued run and two executed runs; a throwing worker ends its run `failed`; a killed worker lets a new run start within 30 s; a revoked role fails the run with one security event and no change; an import that adds an overlapping job order during compute makes the apply re-snapshot once and leaves no overlap; a calendar deviation added during compute forces a recompute; 20 operator reports during compute do not stop the first apply; a 1 600-row apply issues one `UPDATE` in 1 s or less; planner A's draft on order 1001 stays current while planner C runs autoplan.
* `release.int.test.ts`: a child order in another plant fails with `core.crossScopeReference`.
* `plan.bench.ts` runs nightly on the CI runner against the budget table and records fallback and late counts; a counter allows at most about 3 400 `resolveWallClock` calls on the seeded fixture.

## Pros and cons of the options

### A pure, deterministic greedy heuristic

* Good, because it implements the stated rules; open source planners such as frePPLe and Carbon also place one order at a time.
* Good, because it is a pure function, so every rule is a unit test.
* Bad, because it does not optimize the plan as a whole.

### A constraint solver

* Good, because it can find plans with less lateness or a shorter makespan.
* Bad, because Timefold needs a JDK and CP-SAT has only unofficial Node ports, so either adds a runtime to the one-host install, and planners cannot predict its plans.

### An incremental engine that persists per order

* Good, because each step holds little in memory.
* Bad, because it is not a function of one snapshot: half-applied runs are visible, and the result cannot be checked against one plan revision.

## More information

* Related ADRs: [0014](0014-outbox-event-log-and-pg-boss-jobs.md), [0018](0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md), [0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md), [0025](0025-plant-calendars-shift-patterns-and-the-production-day.md), [0027](0027-planned-duration-formula-and-override-precedence.md), [0029](0029-per-planner-drafts-soft-locks-and-the-plan-revision.md), [0030](0030-a-planning-board-built-in-house.md), [0031](0031-erp-integration-connector-modules-field-ownership-and-pending-changes.md), [0032](0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md), [0036](0036-agent-proposals-as-planning-records-a-person-commits.md), [0057](0057-scheduling-domain-as-a-pure-package-in-the-planning-module.md).
* Plan: [07-production-planning.md](../plan/07-production-planning.md#autoplan) (algorithm, job, budgets, material warnings, child orders), [16-open-questions.md](../plan/16-open-questions.md).
* Public sources: [frePPLe planning algorithm](https://frepple.com/docs/current/developer-guide/planning-algorithm.html), [OR-Tools job shop example](https://developers.google.com/optimization/scheduling/job_shop).
* Revisit when the product owner answers the questions above, when the budget fails (worker thread), when a customer needs optimization (a solver plugin behind `Scheduler`), and when binding-constraint attribution for late orders is wanted.
* Background: internal research notes 09 and 10.
