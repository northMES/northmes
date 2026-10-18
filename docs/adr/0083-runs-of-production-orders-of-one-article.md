---
status: "proposed"
date: 2026-10-17
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: Krister Johansson (runs of any number of orders of one article, one job order per order, the saved retools as the run's rule, the earliest deadline with the early warning, the split, 2026-10-17)
informed: contributors, coding agents, the product owner
release: "later"
needs-confirmation: "maintainer (any number of orders in a run; each order keeps its own job orders; the saved retools as the run's rule; the earliest deadline with the early warning; the split as the reverse; the run as a draft record until Save, then a committed grouping); product owner (a started or hard-locked order in a run; whether the ERP learns of a run; a hand-set run deadline; the retool as what a run saves, the fixed time kept)"
---

# Runs of production orders of one article

## Context and problem statement

A plant often has several production orders of one article open at once: the ERP creates one per customer order line or per stock need, and each one carries the full retool time of every operation ([plan 07, Planned duration](../plan/07-production-planning.md#planned-duration)). When they run after each other on one machine the machine is set up once in practice, but the plan counts the setup for every order, and a planner who wants them together moves each order's job orders by hand. On 2026-10-17 Krister Johansson asked for runs: planners may combine orders of one article into a run that is planned together. This ADR proposes what a run is, how its rows are placed and how it is undone; the rules are a proposal until Krister Johansson accepts it (M-94). It covers the planning module: the domain package, the order Gantt, and later the plan server and the board.

## Decision drivers

* Each order keeps its own job orders, so each order's quantity, demand rows, progress and write-back key stay its own ([ADR 0029](0029-per-planner-drafts-soft-locks-and-the-plan-revision.md)).
* The retool is saved where it is saved in practice: on the second and later orders of the run, on the same machine, after the previous order's row of the same operation.
* A run is reversible, in the planner's draft and in the committed plan.
* The run has one deadline a planner can read, so the run is late or on time as one thing.
* Every scheduling computation is a pure function in `@northmes/planning-domain`, deterministic and permutation-invariant ([ADR 0057](0057-scheduling-domain-as-a-pure-package-in-the-planning-module.md), [ADR 0028](0028-autoplan-as-a-pure-deterministic-function.md)).

## Considered options

* A run as a planning record over the orders, with each order's own job orders and the saved retools as the run's rule
* Merging the orders into one production order with the summed quantity
* A plant setting that skips the setup for consecutive job orders of one article on one machine, with no run

## Decision outcome

Chosen option: "A run as a planning record over the orders, with each order's own job orders and the saved retools as the run's rule", because it keeps each order's quantity, demand rows and progress its own, which the ERP and the operators expect, and makes the saved retool an explicit choice of the planner that can be undone.

### Rules

1. A run holds two or more production orders of one article at one plant. Any number of orders may join; they need not follow each other in number or deadline. Every job order of every order in the run is placed: an order with a job order in the Not placed row cannot join, and the review step refuses with the reason, because the ranking of rule 3 and the placement it keeps both need a placed row. An order with a started, held or hard-locked job order cannot join either (PO-81, working default).
2. Each order keeps its job orders. A run creates, deletes or merges no job order; the orders' quantities, demand rows, progress reports and write-back keys are untouched.
3. The orders of a run are ranked by the setup start of their first placed job order, then by the autoplan order (deadline instant, priority with null last, order number by code units, id). The first order keeps its placement. For each later order, in that rank, a row of an operation with a retool time is laid on the machine of the previous order's row of the same operation (matched by sequence number), when the operation allows that machine, with no retool, starting at the later of that row's end and the row's own release from its predecessor, so the release of rule 9 holds and the row follows the previous one directly whenever its release allows. Its rows of the other operations follow the cascade rules of [plan 18](../plan/18-gantt-timeline.md#cascade) on their own machine, with their own setup: released from the predecessor, past every reservation, under the last-piece bound. A row of an operation the previous order lacks, or whose machine the operation does not allow, keeps its own setup and follows the cascade rules too.
4. The saved retools are the run's rule: the run record names each job order whose retool it saves and the seconds saved. A run saves the retool, the machine's changeover, and keeps the fixed time of the operation (plan 07: the setup is retool plus fixed time; a first-piece check or a document step is due for every order), as PO-84's working default. The job order's rates keep the retool time; its planned setup is its fixed time alone while the rule holds, so a row with a fixed time still draws that part of its setup hatch. The working default of plan 07, that consecutive job orders of the same article and operation on one machine do not skip the second setup, holds for every job order outside a run.
5. The run's deadline is the earliest deadline of its orders. The run is late when its last row ends after it. An order whose own deadline is later than the run's is flagged early, with the elapsed time between the two deadlines, in the review step and on the order's row, so the planner sees that the run pulls it forward. The orders' own deadlines do not change.
6. A run reports what it breaks and repairs nothing: an overlap with another order's row on the machine, a successor it could not place, a fixed row it stops at. The review step lists them before the combine, and the My draft list holds them after it, with the actions of [plan 18, Resolving a break in the draft](../plan/18-gantt-timeline.md#resolving-a-break-in-the-draft).
7. Splitting a run reverses it: the run record holds the placement every row the combine moved had before, and the split puts each of those rows back there, on its machine, with its retool back, so the orders are as they were before the combine; the run record then goes. A run that exists only in the planner's draft is split by discarding its changes, which has the same effect.
8. A run is a planning record in the planner's draft until Save. Save commits it as a grouping on the plan under the orders' soft locks, as a draft change of kind `run` beside `move` and `split` ([plan 07, Splitting and hard-locking by hand](../plan/07-production-planning.md#splitting-and-hard-locking-by-hand-plan-proposal)). The plan server's tables follow when the plan server is built; until then the run lives in the browser's in-memory draft of the order Gantt on mock data.
9. `combineIntoRun(orders, context)` and `splitRun(run, context)` are pure functions in `@northmes/planning-domain`, tested against the fixture case GT10 and with property tests: deterministic, permutation-invariant in the orders and in their rows; the first order's rows keep their placements; every row of a later order lies on a machine its operation allows, at or after its release; a row with a saved retool starts at or after the end of the row it follows and has its fixed time as its setup; and the split gives every moved row its earlier placement and every saved retool back.

### Consequences

* Good, because a planner combines orders in one action and sees the saved retools, the run's deadline and the breaks before anything is written.
* Good, because the orders stay what the ERP and the operators know: their numbers, quantities and progress.
* Good, because a saved retool is a recorded choice, visible on the Gantt as a block without a retool hatch, and reversible.
* Bad, because matching operations by sequence number assumes the orders share a routing. Orders released from different routing versions may match wrongly; the review step lists the operations so the planner can see it.
* Bad, because a run is one more record and draft change kind that the plan server, the write-back and the audit trail must carry.
* Bad, because the run's rows may land over another order's rows, which the planner then resolves. Placing them past every reservation instead would make the saved retool a fiction.

### Confirmation

* `modules/planning/domain/test/run.test.ts`: GT10 (1001 and 1005 combined: 1005.10 directly after 1001.10 on CNC1 with no retool, 1005.20 after the locked 1002.10 on CNC2, the run's deadline Fri 6 Nov 15:00, 1005 early by 7 days, the overlap with 1003.10 reported); a property test over shuffled orders and rows for the invariants of rule 9; `splitRun` puts both rows back to their week 46 placements with the retool of 1005.10, and restores every member of any run.
* `modules/planning/domain/fixtures/gantt/g1.test.ts`: the placements of GT10 equal `addWork` over the A1 calendar.
* `apps/web/test/modules/planning/gantt-run.test.tsx`: the multi-select, the review step, the run row with its summary bar, the saved-retool cue, Split run, and the My draft list with the run as one change.
* `e2e/a11y/gantt.axe.spec.ts`: the review step and the run row.

## Pros and cons of the options

### A run as a planning record over the orders

* Good, because nothing of the orders changes, and the record can be dropped.
* Bad, because it is one more record and draft change kind.

### Merging the orders into one production order

* Good, because the board and the Gantt see one order and need no new row kind.
* Bad, because the ERP owns the orders and their numbers: a merged order has no write-back key, and the demand rows and progress of each order would have to be split again afterwards.

### A plant setting that skips the setup for consecutive job orders

* Good, because it needs no action from the planner.
* Bad, because it is a guess: the machine may need the setup anyway (a tool change between the orders, another fixture), and it changes every plan at once instead of the orders the planner chose. The product owner's answer to the working default of plan 07 is still open.

## More information

Krister Johansson's direction of 2026-10-17, written up as this proposal; M-94 holds the maintainer's confirmation and PO-81 to PO-85 the product owner's questions in [16-open-questions.md](../plan/16-open-questions.md). [Plan 18, Runs](../plan/18-gantt-timeline.md#runs) holds the Gantt behaviour, [plan 07, Planned duration](../plan/07-production-planning.md#planned-duration) the working default this ADR excepts, and the design frames PR1 to PR3 of the planning pages round (issue 689) show the review step and the run on the Gantt. Open for the product owner: whether a run may hold an order with a started or hard-locked job order (PO-81, working default: no); whether the ERP learns of a run (PO-82, working default: NorthMES-internal); whether a planner may set the run's deadline by hand (PO-83, working default: always the earliest); whether a run saves the whole retool or a run of one article still needs a shorter one, with the fixed time kept either way (PO-84, working default: the whole retool, the fixed time kept); whether a run takes every operation of its orders (PO-85, working default: yes). Revisit when the plan server takes the draft ([ADR 0029](0029-per-planner-drafts-soft-locks-and-the-plan-revision.md)) and when the product owner answers.
