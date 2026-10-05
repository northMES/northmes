---
status: "proposed"
date: 2026-10-05
decision-makers: "proposed by the planning session, to be confirmed by Krister Johansson"
consulted: "internal research notes 05, 09, 10, 16 and 32"
informed: "product owner"
release: "1"
needs-confirmation: "product owner (divisor, tool override of cycleSeconds, deadline and lead-time defaults)"
---

# Planned duration formula and override precedence

## Context and problem statement

A job order's planned duration decides where autoplan places it, how long its block is on the board, when the next operation may start and which orders are late. The first brief said "retool time plus quantity times cycle time". A worked example needs more than that: 7 200 pieces, 45 s per cycle, 3 pieces per cycle, 2 700 s retool and an expected OEE of 0.75 give 108 000 s of cycles, 144 000 s after dividing by 0.75 and 146 700 s in total, which is 4 working days plus 27 900 s on a 29 700-second day. The brief's rule gives 326 700 s for the same input. Rates can come from three places: the routing operation, the machine allowed for it (operation equipment) and the tool (operation tool).

Some product owner answers are still missing: what divides run time, whether a tool may override cycle seconds, which instant a deadline date means and whether lead time counts calendar or working time. Any answer still missing on 2026-10-30 becomes a plant or connector setting whose default this ADR records.

This ADR fixes the duration function, its input rules, the override precedence per field, when rates are resolved and frozen, and those defaults. The functions live in `@northmes/planning-domain` ([ADR 0057](0057-scheduling-domain-as-a-pure-package-in-the-planning-module.md)); how autoplan uses them is [ADR 0028](0028-autoplan-as-a-pure-deterministic-function.md).

## Decision drivers

* The worked example comes out exactly: 146 700 s.
* One function for the board preview, autoplan, the send-ahead release, the remaining work of started rows and the server, so they never disagree.
* Ceilings in integers, because Postgres `numeric` arrives as a string and floats round.
* A placed job order keeps its rates when master data changes later, and a later OEE module finds the planned time per piece without a migration.
* A missing answer must not block development.
* OEE targets stay comparable across machines.

## Considered options

* A cycle-quantized duration with a planning factor, per-field override precedence and rates frozen on each job order
* The brief's rule: retool plus quantity times cycle time
* Fractional per-piece arithmetic without cycle rounding, with rates looked up from master data at each computation (the earlier attempt's shape)

## Decision outcome

Chosen option: "A cycle-quantized duration with a planning factor, per-field override precedence and rates frozen on each job order", because it reproduces the worked example, models partial cycles the way a machine produces them, and keeps placed rows stable.

### The formula

```text
setupSeconds            = retoolSeconds + fixedSeconds
runSecondsFor(n, rates) = ceilToSecond( ceil(n * cyclesPerPiece / piecesPerCycle) * cycleSeconds / planningFactor )
plannedSeconds(job)     = setupSeconds + runSecondsFor(job.quantity, job.rates)
```

* Planned seconds are working seconds laid over the machine's availability with `addWork` ([ADR 0025](0025-plant-calendars-shift-patterns-and-the-production-day.md)); breaks and closed time inside the interval extend it. A job order is one contiguous block: setup, then run, interrupted only by calendar closures, never by another job order.
* Retool is not divided by the planning factor, and retool may be interrupted by breaks and nights.
* A piece exists when its cycle completes, so a partial cycle rounds up.
* Each job order carries the full retool time. Consecutive job orders of the same article and operation on one machine do not skip the second setup.
* Quantity 0 gives setup only and no send-ahead release.
* `fixedSeconds` is a fixed time per job order, such as Pyramid's `ExtendedTime` when the connector maps it so.

The same `runSecondsFor` gives the job order's run time, the send-ahead release (setup end plus `runSecondsFor(S)` laid over the releasing machine's availability), the remaining work of an active or paused job order (`runSecondsFor(quantity minus good minus scrap)`) and the backward share bound for split predecessors in `plan()`. The board's move preview calls the same function. No per-piece seconds value exists anywhere.

### Input rules

Quantities and rates are parsed into scaled integers at the snapshot boundary, and every ceiling is taken in integers; nothing calls `parseFloat` before arithmetic. Zod rules in the snapshot: `quantity >= 0`, `cyclesPerPiece > 0`, `piecesPerCycle > 0`, `cycleSeconds >= 0`, `planningFactor` in (0, 2]. A violation gives that row an "invalid rates" result while the other rows are planned. The connector maps an OEE of 0 or empty to null (inherit) with an import warning.

### The planning factor

The plant setting `planningFactorSource` picks the divisor: `oeeTarget` divides by the operation's OEE target, `factor` by one plant-wide `planningFactor` in (0, 2], `none` by 1. The OEE target comes only from the operation, so every machine is measured against the same number.

### Override precedence

Base values come from the production order operation, which copied the routing operation at release. Overrides come from the operation equipment and operation tool rows of the source routing operation when the job order is placed.

| Field | Routing operation | Operation equipment | Operation tool |
|---|---|---|---|
| `cycleSeconds` | base | may override | no, until the product owner confirms |
| `piecesPerCycle` | base | may override | may override, and wins over equipment |
| `cyclesPerPiece` | base | may override | no |
| `retoolSeconds` | base | may override | no |
| `fixedSeconds` | only source | no | no |
| `oeeTarget` | only source | refused | refused |

Where both may override a field, the order is tool, then operation equipment, then routing operation. A null override inherits. An equipment override of `oeeTarget` is refused with a validation error.

### Resolved once, frozen on the job order

Rates are resolved when a job order is placed and frozen on it: `cycle_time_s`, `pieces_per_cycle`, `cycles_per_piece`, `retool_time_s`, `fixed_time_s` and `planning_factor`, plus `planned_setup_s`, `planned_run_s` and `ideal_seconds_per_piece` (cycle seconds times cycles per piece divided by pieces per cycle, without the planning factor). Fixed rows never change their rates; free rows pick up master data on the next autoplan run or move. A later OEE module reads the frozen ideal time per piece and the separate setup and run seconds, so it needs no migration. The Pyramid connector upserts a routing operation keyed by (article, operation number) that respects "do not update", so overrides have a base level for imported orders ([ADR 0032](0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md)).

### Defaults for missing product owner answers

| Question | Setting or rule | Default |
|---|---|---|
| What divides run time | `planningFactorSource` (plant) | `oeeTarget` |
| May a tool override cycle seconds | precedence table above | no |
| Which instant a date-only deadline means | `deadlineRule` (plant): `startOfDay` or `endOfShift` | `startOfDay`, 00:00 plant time, as Pyramid sends `00:00:00` |
| Is lead time calendar or working time | `leadTimeBasis` (plant): `elapsed` or `working` | `elapsed`, because cooling continues at night |
| Is retool divided by the planning factor | rule | no |
| Does each job order carry the full retool | rule | yes |

`deadlineRule` applies only when the source gives a date without a time. The connector's lag-to-lead and setup-row rules are connector settings ([ADR 0032](0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md)). The pilot acceptance criteria agreed on the same date are in [01-product-and-scope.md](../plan/01-product-and-scope.md#pilot-acceptance-criteria-draft).

### Consequences

* Good, because the worked example, autoplan and the board preview agree to the second.
* Good, because integer ceilings and Zod limits make bad rates visible per row instead of breaking a run.
* Good, because frozen rates keep fixed rows stable and give OEE its planned time per piece.
* Bad, because a master data change does not reach rows that are already fixed; a planner moves them to pick it up.
* Bad, because the defaults may not match the pilot until the product owner answers; each one sits in one setting or one rule.
* Bad, because operations need more fields (pieces per cycle, cycles per piece, fixed time, OEE target) from the ERP or a person.

### Confirmation

`duration.test.ts`, `release.test.ts` and `deadline.test.ts` in `modules/planning/domain` use the A1 calendar fixture (Plant A in `Europe/Stockholm`, Monday to Friday 06:00 to 15:00, breaks 08:30 to 08:45 and 11:00 to 11:30, 29 700 s per day) and TC1 rates (7 200 pieces, 45 s cycle, 3 pieces per cycle, 1 cycle per piece, planning factor 0.75, retool 2 700 s, fixed 0 s):

| Case | Expected |
|---|---|
| TC1, start Mon 2026-11-02 06:00 | 2 400 cycles; total 146 700 s; retool 06:00 to 06:45; end Fri 2026-11-06 14:30 local (13:30Z) |
| TC2, planning factor 1.0 | total 110 700 s; end Thu 2026-11-05 12:45 |
| TC3, 1 piece per cycle and 2 cycles per piece | 14 400 cycles; total 866 700 s |
| TC4, 7 201 pieces | 2 401 cycles; total 146 760 s; end Fri 2026-11-06 14:31 |
| TC5, tool at 8 pieces per cycle | 900 cycles; total 56 700 s; end Tue 2026-11-03 14:15 |
| TC5b, operation 3, CNC2 override 7, tool T8 at 8 pieces per cycle | CNC1 with T8 56 700 s; CNC2 without a tool 1 029 cycles and 64 440 s; CNC2 with T8 56 700 s; an equipment override of `oeeTarget` is refused; editing the CNC2 override afterwards leaves the placed job order unchanged |
| TC6, 3 600 each on CNC1 and CNC2 | each 74 700 s; both end Wed 2026-11-04 10:30 |
| TC7, previous operation ends Mon 10:00, lead 5 h, retool 2 700 s | `elapsed`: lead ends Mon 15:00, retool Mon 14:15 to 15:00, first piece Tue 06:00; `working`: lead ends Tue 06:30 |
| TC8, previous operation ends Mon 07:00, lead 2 h, retool 2 700 s | retool 08:00 to 08:30 and 08:45 to 09:00; first piece 09:00 |
| TC9b, send-ahead S from Mon 06:00 | S = 318 releases at 08:46 (106 cycles, 6 360 s); S = 319 at 08:47 (107 cycles, 6 420 s) |
| TC9c, 7 050 pieces remaining | run 141 000 s |
| TC10, 146 700 s, deadline Fri 2026-11-13 | `startOfDay`: latest start Fri 2026-11-06 06:30; `endOfShift`: Mon 2026-11-09 06:30 |
| TC11, regression | asserts 146 700 s, which the brief's rule (326 700 s) fails |
| TC12, 7 200 pieces at 420 pieces per hour, 1 piece per cycle, factor 0.75 | run 82 286 s |

Also: quantity 0 gives setup only and no send-ahead release; an OEE of 0 marks that row `invalidRates` while the other rows are planned; a fast-check property on 6-decimal inputs compares `runSecondsFor` with an exact integer ceiling; the board preview test asserts that the preview and `plan()` give the same end for the same move.

## Pros and cons of the options

### Cycle-quantized duration, per-field precedence, frozen rates

* Good, because it matches the worked example and the way machines complete pieces.
* Good, because integer ceilings are exact and the same in the browser and on the server.
* Bad, because more operation fields must be filled for a correct plan.

### The brief's rule

* Good, because it is simple and needs only two fields.
* Bad, because it gives 326 700 s instead of 146 700 s for the worked example and has no pieces per cycle, tool override, fixed time or planning factor.

### Fractional per-piece arithmetic with live rates

* Good, because there is no rounding step.
* Bad, because a send-ahead release computed from a fractional piece time can fall inside a cycle that has not completed.
* Bad, because a master data edit silently changes rows that are already placed, including fixed rows that autoplan must not move.

## More information

* Related ADRs: [0023](0023-si-units-with-a-northmes-unit-catalog.md) (cycle time entry and the ratio unit), [0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md), [0025](0025-plant-calendars-shift-patterns-and-the-production-day.md), [0026](0026-planning-domain-names-aligned-with-isa-95.md), [0028](0028-autoplan-as-a-pure-deterministic-function.md), [0032](0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md), [0057](0057-scheduling-domain-as-a-pure-package-in-the-planning-module.md).
* Plan: [07-production-planning.md](../plan/07-production-planning.md#planned-duration) (formula, precedence, worked example), [07-production-planning.md](../plan/07-production-planning.md#settings) (planning settings), [16-open-questions.md](../plan/16-open-questions.md).
* Revisit when the product owner answers the divisor, tool override, deadline and lead-time questions, when the OEE module reads the frozen rates, and if sequence-dependent setups (a setup matrix) are wanted later.
* Background: internal research notes 09 and 10.
