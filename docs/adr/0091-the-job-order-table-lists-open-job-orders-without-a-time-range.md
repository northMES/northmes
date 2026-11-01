---
status: "proposed"
date: 2026-11-01
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: Krister Johansson (the job orders page without weeks, open job orders by default, sorted by start, no Start filter yet, 2026-11-01, after trying the page on main)
informed: contributors and coding agents
release: "1"
needs-confirmation: "maintainer (the ADR as a whole)"
---

# The job order table lists open job orders without a time range

## Context and problem statement

The job order table view is the main screen-reader path through the plan and a second view for every planner ([ADR 0030](0030-a-planning-board-built-in-house.md)). Plan 18 put it on a page of its own, Job orders, which took the board's range: a zoom preset (Hours, Day, Week, 4 weeks), `from`, Earlier, Now, Later and Go to date, so a link from the board or the Gantt opened the table at the same range. [ADR 0089](0089-zoom-levels-and-an-endless-time-axis-that-loads-by-time-chunk-on-the-planning-board-and-the-order-gantt.md) kept the four presets as the table's Range, and [ADR 0090](0090-a-smooth-zoom-and-a-slim-bar-above-the-timeline-on-the-planning-board-and-the-order-gantt.md) kept its range controls.

Krister Johansson tried the page on main on 2026-11-01 and asked why a list of job orders has weeks at all. Hours and Day are drawing scales for a time area, which the table does not have, and a planner looking for a job order must first guess the week it runs in. The other lists of the planning module (production orders, customer orders) have no range: a search, Late only, filters with counts, Group by and a sort. This ADR covers the job orders page in `apps/web/src/modules/planning/screens/job-orders/`, its URL keys, and the link to it from the board.

## Decision drivers

* A planner finds a job order by its number, its order, its machine or its status, not by its week.
* The table holds the same content as the board for screen readers ([ADR 0021](0021-accessibility-target-wcag-2-2-aa.md)), so it must not hide open work outside a window.
* The planning lists behave alike: one toolbar, one set of URL rules ([ADR 0062](0062-web-form-contracts-url-view-state-and-module-link-manifests.md)), one list convention ([ADR 0016](0016-graphql-list-conventions-connections-relations-filter-sort-search-and-group-by.md)).
* `planningJobOrders` in plan 07 already filters by `late`, `equipment`, `status` and `startAtProductionDay` and pages through a connection, with no range argument.

## Considered options

* A work list of open job orders, without a range
* The four presets kept as the Range (ADR 0089)
* A from and to date filter in place of the presets

## Decision outcome

Chosen option: "A work list of open job orders, without a range", because it is how a planner looks for a job order, it shows every open job order to a screen reader, and it matches the other planning lists and the query plan 07 already describes.

### The rows

* By default the table lists every open job order of the plant: planned and started, placed or not. A job order without a machine shows Not placed in Machine and has no start or end.
* Finished job orders show only when the Status filter picks Finished. Cancelled job orders join that filter once the snapshot carries them, as plan 18 says.
* The rows read the plan with the planner's draft applied, as before.

### The toolbar

* The toolbar is the order lists' toolbar: a search field named "Search job orders", Late only, and filter menus with counts for Machine, Status and Article, with their chips and Clear filters under them.
* The search matches the job order number, the production order number and the article, as a case-insensitive part of the text.
* The Machine filter offers each machine of the plant that a row has, and Not placed.
* Group by and Columns sit in the table's header row (#875). Group by offers Machine and Start day. Machine groups follow the plant's machine order with Not placed last; Start day groups are the plant date of each job order's setup start, in date order, with Not placed last. Each group's header names it and counts its job orders.
* The range controls leave the page: the Range presets, Earlier, Now, Later, Go to date, the range text and the empty state's "Show the next range".
* The default sort is Start, ascending, with job orders without a start last and the job order number breaking ties. Every sortable column keeps its sort.

### URL keys

* The page keeps its view in `q`, `late`, `machine`, `status`, `article`, `group` and `sort`, each with its default stripped and each falling back on its own ([ADR 0062](0062-web-form-contracts-url-view-state-and-module-link-manifests.md)). `machine`, `status` and `article` hold comma lists, as on the order lists, and `machine` uses `none` for Not placed.
* `zoom` and `from` mean nothing on this page. A link that still carries them opens the default view, with no redirect.
* The board's "Open the job table" on its error state carries the board's order filter `q` instead of the range. The page's own menu leads to the Gantt and the board with its search as their order filter, and each row's menu leads to them at the row's start with its order selected.

### Data

* In phase 1 the page reads the snapshot that the other planning record pages read, through the same data seam. A server source answers `planningJobOrders` with the filters above and pages through its connection, as plan 07 says; the query takes no range.

### Parts of other ADRs this decision changes

#### Changes to ADR 0089

[ADR 0089](0089-zoom-levels-and-an-endless-time-axis-that-loads-by-time-chunk-on-the-planning-board-and-the-order-gantt.md), zoom levels and the endless axis:

| Section | Before | After |
|---|---|---|
| Zoom levels | "The job order table view keeps the four presets as its Range. A link from the board or the Gantt at another level opens the table at the nearest preset" | The job order table has no range; a link to it carries no zoom ([The rows](#the-rows), [URL keys](#url-keys)) |
| Confirmation | `job-orders-search.test.tsx`: a link with `zoom=quarter-hours` opens the table at `hours`, and one with `zoom=quarter` or `zoom=year` at `4weeks` | `job-orders-search.test.tsx` checks this ADR's keys, as its [Confirmation](#confirmation) says |

#### Changes to ADR 0090

[ADR 0090](0090-a-smooth-zoom-and-a-slim-bar-above-the-timeline-on-the-planning-board-and-the-order-gantt.md), the smooth zoom and the slim bar:

| Section | Before | After |
|---|---|---|
| The bar above the timeline | "The job order table view keeps its Range presets, Earlier, Now, Later and Go to date" | The job order table view has none of them ([The toolbar](#the-toolbar)) |
| The URL key zoom | "A link to the job order table view opens it at the preset of the zoom's band" | A link to the job order table view carries no zoom |
| Confirmation | `job-orders-search.test.tsx`: `zoom=37.5` opens the table at `day`, `zoom=200` at `hours` and `zoom=0.5` at `4weeks` | `job-orders-search.test.tsx` checks this ADR's keys |

### Consequences

* Good, because a planner finds a job order by number, machine, status or article without knowing its week.
* Good, because every open job order is in the table, so a screen reader user sees the same work as the board shows across its whole axis.
* Good, because the page uses the same toolbar, chips and URL rules as the production orders and customer orders lists.
* Bad, because a link from the board no longer opens the table at the board's dates; the planner sorts or groups by start instead.
* Bad, because at pilot scale the table holds every open job order, so it depends on the server paging of plan 07 once a server source answers it.
* Neutral, because a Start filter by production day (plan 07's `startAtProductionDay`) can come later as one more filter menu, without a range control.

### Confirmation

* `job-orders-search.test.tsx`: each key parses and falls back on its own; `machine`, `status` and `article` read comma lists; `zoom` and `from` are dropped; the default sort leaves `sort` out.
* `job-orders-screen.test.tsx`, on the fixture G1 and on snapshots built from it: the table lists every open job order sorted by start; a finished job order shows only with Status Finished; a job order without a machine shows Not placed and sorts last; the search, Late only and the Machine filter narrow the rows and write the URL; Clear filters clears the filter menus and keeps the search and Late only, as on the order lists; Group by Machine and Group by Start day put the rows under their headers; and the page has no Range, Earlier, Now, Later or Go to date.
* `planning-board-states.test.tsx`: the board's "Open the job table" link carries `q` and no `zoom` or `from`.
* `e2e/a11y/job-orders.axe.spec.ts`: `checkA11y` passes on the job orders page with its rows, a row's late facts open, a sort, Late only, the Machine filter menu open, the rows grouped by machine, the Columns menu and a row menu open, and with no row that matches. The web test covers the error and empty states, which the fixture G1 never reaches in a browser.

## Pros and cons of the options

### A work list of open job orders, without a range

* Good, because it answers the planner's question by the record, not by the calendar.
* Good, because it matches the query plan 07 describes and the other planning lists.
* Bad, because the table grows with the plant's open work, which server paging answers.

### The four presets kept as the Range (ADR 0089)

* Good, because a link from the board opens the table at the same dates.
* Bad, because a planner must know a job order's week to find it, and open work outside the window is hidden.
* Bad, because Hours and Day are scales of a time area the table does not have.

### A from and to date filter in place of the presets

* Good, because it keeps a time window without drawing scales.
* Bad, because the window still hides open work by default, and it needs a date range control the other lists do not have.

## More information

Plan 07, the job order table view and the `planningJobOrders` query ([07-production-planning.md](../plan/07-production-planning.md#job-order-table-view)). Plan 18, the pages of the timeline ([18-gantt-timeline.md](../plan/18-gantt-timeline.md)). Open question M-102 recorded the table's Range ([16-open-questions.md](../plan/16-open-questions.md)). Revisit the Start filter once planners have used the list.
