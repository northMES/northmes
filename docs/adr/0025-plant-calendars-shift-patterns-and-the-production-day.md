---
status: "proposed"
date: 2026-10-05
decision-makers: "proposed by the planning session, to be confirmed by Krister Johansson"
consulted: "internal research notes 10, 11 and 32"
informed: "product owner"
release: "1"
needs-confirmation: "product owner (shift and break times, week rule, deviation precedence, production day start)"
---

# Plant calendars, shift patterns and the production day

## Context and problem statement

Autoplan and the planning board need the working time of every machine. Calendars must express crews that rotate over several weeks, night shifts, deviations for unplanned stops and planned overtime, and schedules that start in the future. A schedule that has taken effect cannot change, because an OEE report printed earlier must give the same number later. A new schedule that starts on a day other than Monday asks for confirmation. Shift and break times are not given yet.

A weekly table is not enough. Night shifts cross midnight. On the nights when clocks change, a Saturday overtime night lasts 7 or 9 hours and a production day 23 or 25 hours. ISO 2026 has 53 weeks, so 2026-W53 and 2027-W01 are both odd. Easter Sunday 2027 falls on 2027-03-28, the spring DST night, so a plant-wide holiday and equipment overtime can meet on the same night.

This ADR covers the calendar tables in core, how availability is computed, deviation precedence, version freezing and the production day. Time storage and the clamp resolver are [ADR 0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md); the home of the window functions is [ADR 0057](0057-scheduling-domain-as-a-pure-package-in-the-planning-module.md).

## Decision drivers

* Reproducible shift figures: a calendar version in effect never changes ([ADR 0051](0051-regulated-readiness-no-regret-rules.md), rule 9).
* Correct availability across midnight and on both DST nights.
* The planner's intent survives tzdata updates, so definitions stay wall-clock values.
* A plant-wide holiday must not cancel a machine's overtime without anyone noticing.
* Calendar expansion stays within 300 ms at pilot scale ([ADR 0028](0028-autoplan-as-a-pure-deterministic-function.md)).
* Product owner answers are missing; defaults must be safe, and each choice sits in one place.

## Considered options

* Versioned calendars with anchored N-week cycles and wall-clock rows, availability as millisecond windows expanded in TypeScript, and deviation precedence by scope, then kind
* The same model with precedence by kind only: non-working always wins, plant-wide deviations included
* Shift instances materialized as `tstzrange` rows in SQL, with ISO week parity for rotations

## Decision outcome

Chosen option: "Versioned calendars with anchored N-week cycles and wall-clock rows, availability as millisecond windows expanded in TypeScript, and deviation precedence by scope, then kind", because it expresses the product owner's rules, keeps one TypeScript implementation for the server and the board, and keeps a machine's overtime on a plant holiday unless someone removes it.

### Tables (core)

| Table | Columns |
|---|---|
| `calendar` | `plant_id`, `name`; `equipment.calendar_id` points to one calendar, by default the plant calendar |
| `calendar_version` | `calendar_id`, `effective_from date`, `cycle_weeks int default 1`, `cycle_anchor date` (a Monday), `week_rule` (`anchored`, or `isoParity` as an explicit option) |
| `calendar_shift` | `version_id`, `week_index`, `iso_weekday`, `start_time`, `end_time`, `label`; `end_time <= start_time` means the end is on the next date |
| `calendar_break` | `shift_id`, `start_time`, `end_time`; a time before the shift start is on the next date |
| `calendar_deviation` | `plant_id`, `kind` (`overtime` or `non_working`), `starts_local`, `ends_local` (`timestamp` pairs in the plant zone), `applies_to_all`, `reason` |
| `calendar_deviation_equipment` | `deviation_id`, `equipment_id` |

### Rules

1. A shift belongs to the date it starts, is shorter than 24 hours and may cross midnight. Breaks sit inside their shift.
2. A shift uses the version in force on its start date, so a Sunday 22:00 shift belongs to the old version when a new one starts on Monday.
3. A version is frozen once `effective_from <= (now() AT TIME ZONE p.time_zone)::date`, the plant's local date, read from a settable `core.clock_now()`. A trigger refuses changes to a frozen version and to its shift and break rows. A correction is a new version.
4. A new version that starts on a day other than Monday returns a confirmation reason; the command runs once the person confirms.
5. The week index is `floor(days(cycle_anchor, monday of date) / 7) mod cycle_weeks`. ISO week parity is only an explicit option.
6. Deviations exist per equipment and plant-wide. A plant holiday is a plant-wide non-working deviation.
7. Precedence goes by scope first, then by kind. An equipment deviation overrides a plant-wide one; within one scope, non-working beats overtime, overtime beats break and break beats shift. Availability is sorted, disjoint, half-open millisecond windows: `plant = ((shifts minus breaks) plus plant-wide overtime) minus plant-wide non-working`, then `equipment = (plant plus equipment overtime) minus equipment non-working`.
8. The public function takes an instant range: `availability(calendar, equipment, fromMs, toMs)`. It expands from the local date of `from` minus one day to the local date of `to` and clips, so a range that starts at local midnight keeps the night shift that began the evening before. SQL selects deviations with `starts_local < local(to) + 1 day` and `ends_local > local(from) - 1 day`; TypeScript clips exactly.
9. Expansion runs once per calendar version (pattern plus plant-wide deviations) with a per-(zone, date) offset cache, then applies equipment deviations. `resolveWallClock` runs only on dates with a zone transition.
10. `addWork(av, from, work)` and `subtractWork(av, until, work)` return a placement with `start`, `end` and the working `segments`, or `null` when the horizon runs out; the caller expands four more weeks and retries up to a fixed limit, so a machine without capacity cannot loop forever.
11. `CoreApiModule` exposes a per-plant calendar revision that every calendar write bumps. Core emits `core.calendar.availability_changed { plantId, equipmentIds or all, fromLocal, toLocal }`, and the board refetches availability for the overlapping visible range ([ADR 0018](0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md)).
12. Crew rotation (who works which shift) is HR planning, not release 1 capacity.

### The production day

Each plant has `production_day_start`, a local time stored as a `core.plant` column next to `time_zone`, not as a field of a settings schema. `productionDayOf(instant) = (local(instant) minus production_day_start).date` on the wall clock. A night shift that crosses midnight belongs to the production day it started on, and shift figures are attributed by shift start date. The value is validated against the zone's transitions for the next 10 years, so a start inside the spring gap or the repeated autumn hour is refused. A versioned plant setting (`plant_setting_version`) waits until the product owner says whether the day start can change. A company user works one plant at a time in release 1 ([ADR 0007](0007-tenancy-company-plants-and-the-scope-tree.md)); when a two-plant production-day report is built, `CoreApiModule` exposes each plant's `time_zone` and `production_day_start`.

### Working defaults until the product owner answers

| Question | Working default |
|---|---|
| Shift, break and night shift times | none in code; tests use the A1 calendar fixture (Monday to Friday 06:00 to 15:00, breaks 08:30 to 08:45 and 11:00 to 11:30) |
| Even and odd weeks: ISO parity or strict alternation | `anchored` cycle |
| Deviation precedence | scope first, then kind; if the product owner keeps "non-working always wins", `createDeviation` returns the warning `OVERTIME_FULLY_CANCELLED` and the editor shows it |
| Do overtime nights carry breaks | a break inside overtime is entered as two overtime rows; a yes adds an optional `shift_template_id` on overtime deviations |
| Does a schedule in effect also lock past deviations | open; the freeze trigger covers versions, shifts and breaks only |
| Production day start: 00:00, 06:00 or 07:00 | no default; the value is required when a plant is created |

### Consequences

* Good, because a version in effect is immutable, so earlier shift figures and OEE numbers can be recomputed.
* Good, because one millisecond window model serves availability, autoplan and the board.
* Good, because a machine's overtime on a holiday is kept, and the warning path is ready if the product owner prefers the older rule.
* Good, because expansion cost grows with calendar versions and transition dates, not with machines times days.
* Bad, because wall-clock definitions are resolved on every read, which puts the resolver and its offset cache on a hot path.
* Bad, because any change to a pattern in effect needs a correction version, which is more work for an admin than editing in place.
* Bad, because crews and rotations stay outside release 1; the calendar only models machine time.

### Confirmation

* `availability.test.ts` in core:
  * CAL1: a weekday night shift 22:00 to 06:00 and a range from Tuesday 00:00 local include Monday night 00:00 to 06:00.
  * CAL2: CNC1 with one-row Saturday overtime 22:00 to 06:00 on 2026-10-24 over [2026-10-24T22:00Z, 2026-10-25T11:00Z) gives [2026-10-24T22:00Z, 2026-10-25T05:00Z), 25 200 s.
  * CAL3: the same on 2027-03-27 over [2027-03-27T23:00Z, 2027-03-28T10:00Z) gives [2027-03-27T23:00Z, 2027-03-28T04:00Z), 18 000 s.
  * CAL4: plant-wide non-working [2027-03-26 00:00, 2027-03-30 00:00) local plus CNC1 overtime [2027-03-27 22:00, 2027-03-28 06:00) gives CNC1 [2027-03-27T21:00Z, 2027-03-28T04:00Z) (7 h) and CNC2 0; under the older rule the command result carries `OVERTIME_FULLY_CANCELLED`.
  * CAL5: Saturday 2026-10-24 overtime as one row gives 9 h; as two rows with a 02:00 to 02:30 gap, 8.5 h.
  * CAL6: overtime 22:00 to 02:00 and 02:30 to 06:00; on 2026-10-24, 8 h forward from 22:00 ends 05:30 +01 (04:30Z) and 8 h backward to 06:00 starts 22:30 +02 (20:30Z); on 2027-03-27, 6 h forward ends 05:00 +02 (03:00Z) and 6 h backward starts 23:00 +01 (22:00Z).
  * CAL11: the seeded pilot-scale fixture (40 machines, 3 calendars, 20 weeks) makes at most about 3 400 `resolveWallClock` calls.
* `calendar-version.int.test.ts` on Testcontainers Postgres: CAL7, a version effective 2026-10-25 with a Sunday 05:00 shift cannot be edited at 2026-10-24T22:30Z; TC13, versions effective Thu 2027-08-12 and Sun 2027-08-15 return the confirmation reason and Mon 2027-08-16 does not, an edit of a version in effect is refused and an edit of a future version is allowed.
* `week-rule.test.ts` (TC14): ISO parity gives two odd weeks for 2026-W53 and 2027-W01, while the anchored cycle alternates.
* `production-day.test.ts`: CAL8, `Europe/Stockholm` refuses 02:30 and accepts 06:00; CAL9, with a 06:00 start the production day 2026-10-24 is [2026-10-24T04:00Z, 2026-10-25T05:00Z) (25 h) and 2027-03-27 is [2027-03-27T05:00Z, 2027-03-28T04:00Z) (23 h).
* `windows.test.ts` in `@northmes/contracts`, with fast-check: work is conserved; no segment lies in non-working time; `subtractWork(addWork(s, d).end, d)` starts at or after `s`; `null` only when availability is short; `addWork` is additive and monotonic in work.
* Spring DST fixtures that include Swedish holidays assert non-zero availability where equipment overtime applies, so they cannot pass at 0 h.
* `e2e/planning/availability-live.spec.ts`: planner B's board shows CNC1's new Saturday overtime within 5 s without a reload.
* The calendar suites run under the time zone and polyfill matrix of [ADR 0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md).

## Pros and cons of the options

### Versioned calendars, millisecond windows, precedence by scope then kind

* Good, because it expresses rotations, night shifts, future versions and both deviation scopes.
* Good, because the server and the board share one implementation.
* Neutral, because ISO parity stays available as an explicit option for a plant that means the calendar week number.
* Bad, because precedence by scope departs from the simpler "non-working always wins" and needs the product owner's confirmation.

### Precedence by kind only

* Good, because it is easy to explain: a holiday closes everything.
* Bad, because a plant-wide holiday silently cancels overtime planned on one machine, for example CNC1 over Easter 2027.

### Materialized tstzrange rows with ISO week parity

* Good, because exclusion constraints and BI tools could read shift instances directly.
* Bad, because computing instants in SQL resolves the repeated autumn hour to its second occurrence ([ADR 0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md)).
* Bad, because the rows must be rebuilt after every version, deviation or tzdata change.
* Bad, because ISO parity puts two odd weeks back to back at 2026-W53 and 2027-W01 and leaves the rotation inverted for all of 2027.

## More information

* Related ADRs: [0007](0007-tenancy-company-plants-and-the-scope-tree.md), [0018](0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md), [0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md), [0027](0027-planned-duration-formula-and-override-precedence.md), [0028](0028-autoplan-as-a-pure-deterministic-function.md), [0051](0051-regulated-readiness-no-regret-rules.md), [0057](0057-scheduling-domain-as-a-pure-package-in-the-planning-module.md), [0061](0061-presentation-settings-for-dates-clocks-and-numbers-with-one-pinned-locale.md) (screens keep Monday as the first day of the week and label ISO weeks, because the cycle anchors are Mondays).
* Plan: [07-production-planning.md](../plan/07-production-planning.md#calendars-and-shift-patterns) (tables, rules and the CAL cases), [16-open-questions.md](../plan/16-open-questions.md).
* Revisit when the product owner answers the questions above, when shift reports and OEE arrive (materialized shift instances may then be added as a cache rebuilt from the definitions), and when an HR planning module needs crews.
* Background: internal research note 11.
