# Gantt timeline: the order Gantt, the board additions and the scheduling views

This document specifies the Gantt timeline for NorthMES: one timeline core with two views, the planning board of [07-production-planning.md](07-production-planning.md) and a new order Gantt with one row per production order, operation and job order. On top of both views it specifies four scheduling capabilities: auto-scheduling inside a draft (cascade and plan-this-order), constraints and deadlines, critical chain and float, and resource workload. Working-time calendars already exist in core; this document says how the timeline draws and uses them. It is written for the session that turns it into GitHub issues and for the coding agents that build it. Each rule links to its ADR or carries a marker; rules that wait for an answer carry a working default. Terms follow [GLOSSARY.md](../../GLOSSARY.md), and the new terms this document needs are listed under [Terms](#terms).

The document adds to 07 and never repeats it. Where the board's rules apply to the order Gantt unchanged (block states, cues, the hover card, the grid keyboard model, move paths, drafts, realtime, pause), it says "as the board" and links the section. Where the order Gantt differs, it says so.

## How to read this document

- Decided: the rule comes from an accepted ADR.
- Proposed: the rule comes from a proposed ADR; Krister accepts or changes it through that ADR.
- Open: the product owner, pilot IT or the lawyer must answer. The working default applies until then, and the code keeps the choice behind a setting or a single function.
- Plan proposal: a rule that no ADR covers yet. Most of this document is plan proposals, because no ADR covers the order Gantt, float, the critical chain, cascade or workload. The shaping session confirms each one with the maintainer before a task depends on it, and the ones listed under [Decisions this document needs](#decisions-this-document-needs) become ADRs.
- Examples use synthetic data only: Plant A in `Europe/Stockholm` on the A1 calendar, machines CNC1, CNC2 and Mill 1, production orders numbered from 1001. The fixture `G1` in `modules/planning/domain/fixtures/gantt/g1.json` holds the dataset, and `g1.expected.json` holds every expected value quoted below. Both are generated from one script, so a change to a rate changes every expected value with it.

## Decisions this document relies on

| ADR | Status | What it fixes for the timeline |
|---|---|---|
| [0021](../adr/0021-accessibility-target-wcag-2-2-aa.md) | accepted | WCAG 2.2 AA, the board grid model, 24 px targets, clusters, the Escape stack, the axe gate |
| [0024](../adr/0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md) | proposed | Temporal everywhere, UTC instants, plant wall clock, the clamp resolver, offset-preserving snapping, ticks from instants |
| [0025](../adr/0025-plant-calendars-shift-patterns-and-the-production-day.md) | proposed | Calendar versions, shift patterns, deviations, availability as half-open millisecond windows, `addWork` and `subtractWork`, the production day |
| [0027](../adr/0027-planned-duration-formula-and-override-precedence.md) | proposed | The planned duration formula, rates frozen on the job order, one function for the preview and the server |
| [0028](../adr/0028-autoplan-as-a-pure-deterministic-function.md) | proposed | `plan()` as a pure deterministic function, row classes, the rules between operations, late facts, invariants |
| [0029](../adr/0029-per-planner-drafts-soft-locks-and-the-plan-revision.md) | accepted | Per-planner drafts, soft locks per production order, Save through one command |
| [0030](../adr/0030-a-planning-board-built-in-house.md) | proposed | The board built in house: headless time scale, DOM blocks, TanStack Virtual rows, pointer events, SVG links, the release 1 board and its cuts |
| [0057](../adr/0057-scheduling-domain-as-a-pure-package-in-the-planning-module.md) | proposed | `@northmes/planning-domain` as the pure package that planning server and planning web both import |
| [0061](../adr/0061-presentation-settings-for-dates-clocks-and-numbers-with-one-pinned-locale.md) | accepted | Date, clock and number formats, the pinned base locale, the formatters in `@northmes/contracts/format` |
| [0062](../adr/0062-web-form-contracts-url-view-state-and-module-link-manifests.md) | accepted | View state in the URL, per-key fallback, link builders |
| [0068](../adr/0068-extension-points-declared-by-their-owners-contributions-as-manifest-data-with-code-by-id-and-a-plugin-inventory.md) | accepted | Slot kinds; the board field slots keep their kind on the order Gantt |
| [0077](../adr/0077-visual-regression-snapshots-with-argos-from-the-playwright-specs.md) | proposed | Visual snapshots from the Playwright specs |
| [0079](../adr/0079-design-pages-as-artifacts-on-the-northmes-design-system-with-the-approved-source-in-the-repository.md) | proposed | Design pages as artifacts; the board page D3 is approved and the order Gantt gets its own page |
| [0083](../adr/0083-runs-of-production-orders-of-one-article.md) | proposed | Runs: orders of one article combined and planned together, the saved retools as the run's rule, the earliest deadline, the split |
| [0089](../adr/0089-zoom-levels-and-an-endless-time-axis-that-loads-by-time-chunk-on-the-planning-board-and-the-order-gantt.md) | accepted | Zoom levels, the endless axis, loading by time chunk, the greyed past and the refusal code `PAST` |
| [0090](../adr/0090-a-smooth-zoom-and-a-slim-bar-above-the-timeline-on-the-planning-board-and-the-order-gantt.md) | proposed | A smooth zoom over the levels as bands, the slim bar with Go to now, the order filter and the View menu, the zoom buttons over the time area |

When this document and an ADR disagree, the ADR holds and this document gets fixed. Where this document and 07 disagree, 07 holds for the board and this document holds for the order Gantt and the scheduling views.

## Terms

New terms this document introduces. They go into [GLOSSARY.md](../../GLOSSARY.md) under "Planning work" when the first task that uses them is shaped (plan proposal).

| Term | Definition | Avoid |
|---|---|---|
| timeline core | The headless TypeScript functions and the React pieces that both views share: the time scale, culling, hit testing, row virtualization, block rendering, the drag preview, the link overlay, the keyboard grid model and the move paths. | board core (that is its release 1 name in [ADR 0030](../adr/0030-a-planning-board-built-in-house.md)), Gantt engine |
| order Gantt (Gantt) | The view with one row per production order, one row per operation under it and one row per job order under that, on the same time axis as the board, with links between consecutive operations. | project Gantt, order view (ambiguous with the production order page) |
| page | Which timeline page is open: the board (`/$plant/planning/board`, one row per machine), the order Gantt (`/$plant/planning/order-gantt`, one row per order, operation and job order) or the job order table, each an entry under Planning in the sidebar. | view (the first round's URL key), mode, tab |
| release | Between two consecutive operations of one order: the instant at which the later operation may start its run time, from the earlier operation's rows, the send-ahead quantity and the lead time ([07](07-production-planning.md#rules-between-operations)). The glossary's "release" of an order is the other meaning, and the UI says "released from <operation>" for this one. | dependency, link date |
| link | The drawn relation between consecutive operations of one order: from the earlier operation's release point to the later operation's earliest start, with the lead time as its own segment. Every link is finish-to-start, shortened by the send-ahead quantity and lengthened by the lead time. | dependency, arrow, predecessor link |
| float | The working time a job order can start later without breaking a rule: total float against the order's deadline, free float against its successor and the next reservation on its machine. Measured in working seconds on the job order's machine. | slack (kept for the elapsed time between planned end and deadline), buffer |
| binding constraint | The one rule or reservation that stops a job order from starting earlier: the release from its predecessor, a reservation on its machine, a calendar closure, the frozen window, a hard lock, a started row or the earliest start of its order. | bottleneck (that is a machine), reason |
| critical chain | For one production order: the rows whose free float is zero, walked back from the last operation through each row's binding constraint, across other orders' rows where a reservation binds. For a late order it is why the order is late. | critical path (a project term that assumes unlimited machines; the glossary entry says the chain is resource-constrained) |
| cascade | Moving the later operations of one order in the planner's draft so the rules between operations still hold after a move, never earlier than before, never past a fixed row. | auto-schedule (that is autoplan), push |
| plan this order | Running `plan()` for one production order in the browser against the loaded reservations and writing the result into the draft. | autoplan (that is the plant-wide job) |
| earliest start | An instant before which no job order of a production order may start: material arrival, a customer's release, a tooling date. | release date (ambiguous), start constraint |
| workload | For one machine and one time bucket: the available working seconds from the calendar, the seconds loaded by job orders, their split into setup and run time, and the seconds above availability. | capacity (that is availability alone), utilization (that is one ratio of the workload) |
| bucket | One cell of the workload lane: a shift, a production day, an ISO week or a month, following the band of the zoom. | period, slot (that is a snap step) |
| run | Two or more production orders of one article at one plant that a planner has combined to plan together: a later order's job order of an operation with a retool follows the earlier order's job order of that operation on its machine without a second retool (its fixed time stays), when the operation allows that machine and as soon as its own release allows, while its other job orders keep their setup, and the run is due at the earliest deadline of its orders ([ADR 0083](../adr/0083-runs-of-production-orders-of-one-article.md)). | campaign, merged order, batch |

## Scope

In scope, as additions to the release 1 board and as a new view:

- One timeline core for both views ([Timeline core](#timeline-core)).
- The order Gantt view: tree rows, summary bars, links on every expanded order, the same blocks and states as the board, the same move paths, the same draft ([The order Gantt](#the-order-gantt)).
- Calendars on the timeline: availability shading per row in both views, a shift strip in the time header, segments of a block in closed time, working and elapsed durations side by side ([Working-time calendars on the timeline](#working-time-calendars-on-the-timeline)).
- Constraints and deadlines: the deadline marker and the late band, the frozen window band, the hard lock, the earliest start of an order, and the constraint list of a row ([Constraints and deadlines](#constraints-and-deadlines)).
- Auto-scheduling in a draft: cascade after a move, plan this order, and the preview of both before anything is written ([Auto-scheduling in a draft](#auto-scheduling-in-a-draft)).
- Float and the critical chain: pure functions over the loaded plan, the chain highlight, float on hover and in the detail panel, and the late-order explanation ([Float and the critical chain](#float-and-the-critical-chain)).
- Workload: the workload lane under a machine row on the board and the workload panel in both views, with a text table as the accessible form ([Workload](#workload)).
- Settings, URL state, accessibility, performance budgets, tests and the work breakdown for all of the above.

Not in scope, with the reason:

- Block resize, multi-select of blocks, multi-drag, undo beyond discarding the draft, a minimap: cut from release 1 in [ADR 0030](../adr/0030-a-planning-board-built-in-house.md) and [ADR 0055](../adr/0055-release-1-scope-under-option-b-and-the-scope-rule.md). Resize stays cut even on the order Gantt, because a job order's length follows from quantity, rates and the calendar. The compressed off-hours axis returns as the local option Hide closed time, on by default, which compresses every closed window to a few pixels (Krister, 2026-10-17; [ADR 0030](../adr/0030-a-planning-board-built-in-house.md) is amended). The one multi-select is of order rows on the order Gantt, for [Runs](#runs) (Krister, 2026-10-17).
- Start-to-start, finish-to-finish and start-to-finish links: routings carry finish-to-start with lead time and send-ahead quantity only, and [07](07-production-planning.md#graph-algorithms-with-graphology-later) names branching routings as a later trigger.
- A project-style critical path that ignores machines: it is replaced by the critical chain, which includes reservations.
- People and crews as resources: crew rotation is HR planning ([ADR 0025](../adr/0025-plant-calendars-shift-patterns-and-the-production-day.md)). Workload is per machine. Tools as a contended resource are a later item ([Open points](#open-points)).
- Resource leveling: autoplan places rows and never moves fixed rows; the planner levels by moving rows with the float and workload the timeline shows.
- Baselines (a saved earlier plan to compare against): the plan revision and the audit trail hold history, and a baseline view is a later item.
- A teardown or cleanup time after the run time, as a third part of a job order beside setup and run time: the routing data of release 1 has no such value. It is a later item that extends the duration function.
- Calendar editing: the calendar page of E06-S09 and E06-S10 owns it. The timeline shows the result and links to the page.
- Export to image or spreadsheet: not requested for release 1.

## Where the computation runs

The user's direction for this work: compute in the browser where that is simple, and move to the backend what is heavy. The rule that makes this safe is the one 07 already sets: every scheduling computation is a pure function in `@northmes/planning-domain`, with no clock, no database and plain numbers in and out ([ADR 0057](../adr/0057-scheduling-domain-as-a-pure-package-in-the-planning-module.md), [ADR 0028](../adr/0028-autoplan-as-a-pure-deterministic-function.md)). The browser and the server import the same functions, so a result shown as a preview is the result the server computes at Save. Plan proposal for the split below.

| Computation | Where | Input | Why |
|---|---|---|---|
| Planned duration, release, snapping, `judgeMove`, `validate()` | browser for previews, server at Save | the loaded range | as 07 |
| Cascade | browser, into the draft | the moved row, its order, the loaded reservations on the involved machines | a few rows per move; the server re-runs `validate()` at Save |
| Plan this order | browser, into the draft | one order, the loaded reservations and availability over the order's horizon | one order through `plan()` is a few hundred steps; the horizon is extended by fetch when the order runs past the loaded range |
| Float and the critical chain | browser, on demand for the selected or hovered order and for the rows in the loaded range | the loaded placements and availability | linear in the rows of the loaded range; recomputed on every plan or draft change, memoized per order |
| Workload | browser for the visible buckets; server for the plant-wide workload query | the loaded placements and availability per bucket | per bucket a sum over sorted segments; the plant-wide week table is one query so the table view and a later report can share it |
| Autoplan | server, as 07 | the plant snapshot | the whole plant, with the apply and the revisions |

When the loaded range does not hold what a computation needs (an order whose rows lie outside the range, a chain that leaves the range), the view fetches the missing rows by order id through the same board query and shows "computing" on the affected rows meanwhile. A computation never guesses from partial data; a missing row makes the result "unknown" for the rows that depend on it, shown as such.

## Timeline core

[ADR 0030](../adr/0030-a-planning-board-built-in-house.md) specifies the headless core for the board. The order Gantt reuses it. This section fixes what is shared, what each view supplies, and the three additions the core needs. Everything here is a plan proposal unless marked.

### Shared pieces

- The time scale: `createTimeScale({ range, zoom, pxPerHour, timeZone, widthPx })`, where `zoom` is the band and `pxPerHour` the width of an hour, with `x(instant)`, `instant(x)` and `ticks()`. Proposed ([ADR 0030](../adr/0030-a-planning-board-built-in-house.md)). Hour ticks come from exact instants; day ticks from `startOfDay()` plus one day; snapping uses offset-preserving `ZonedDateTime.round` ([ADR 0024](../adr/0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md)). Proposed. Both views share one scale instance per screen, so switching the view keeps the range and the zoom.
- The zoom levels of [ADR 0089](../adr/0089-zoom-levels-and-an-endless-time-axis-that-loads-by-time-chunk-on-the-planning-board-and-the-order-gantt.md): a ladder that keeps the four presets of the approved board design D3 (`docs/design/planning/planning-221-board.md`: Hours, Day, Week and 4 weeks) as levels under their ids, adds finer and coarser levels. Each level sets its header tiers, snap step and workload bucket, and is a band of the smooth zoom below. Decided; the list of levels is a working default that the design round may change. [ADR 0090](../adr/0090-a-smooth-zoom-and-a-slim-bar-above-the-timeline-on-the-planning-board-and-the-order-gantt.md) (proposed) makes the zoom a continuous width per hour that Ctrl+wheel, a pinch, the zoom buttons and the plus and minus keys change, with the levels as its bands, each band setting what a level sets. It moves the zoom buttons over the time area, and leaves Go to now, the order filter (`q`), My draft while the draft has changes and, on the Gantt only, one View menu above the timeline.
- The smooth zoom as built (#941, under [ADR 0090](../adr/0090-a-smooth-zoom-and-a-slim-bar-above-the-timeline-on-the-planning-board-and-the-order-gantt.md)): the zoom is a width per hour from 0.15 to 240 px, and each level is a band of it whose edges lie at the geometric mean of two natural widths. The band sets the header tiers, the snap step, the workload bucket, the chunk length and the Hours and Day rules; the width sets the scale and which closed windows Hide closed time compresses. During a gesture or an animation the band changes only a factor of 1.1 past an edge, and at its end it is the band the width lies in. Ctrl+wheel, Cmd+wheel, a touch pinch and Safari's trackpad pinch over the time area or the Gantt's workload lanes zoom continuously at the pointer, coalesced to one layout per animation frame (`timeline/use-timeline-zoom.ts`); chunk loads and the URL wait until 150 ms after the last event, and time not requested yet shows the loading band. Zoom in, Zoom out and the plus and minus keys double or halve the width over 150 ms, at once under reduced motion, and a press during the animation compounds from its target. Zoom to fit tries the bands finest first and takes the first width that lies in its band. Zoom out, Zoom in and Zoom to fit are icon buttons over the lower right corner of the time area (`ZoomOverlay`), outside the grid and after it in the tab order; the time scroller reserves their size with `scroll-padding` at its bottom and end.
- The slim bar as built (#939, under [ADR 0090](../adr/0090-a-smooth-zoom-and-a-slim-bar-above-the-timeline-on-the-planning-board-and-the-order-gantt.md)): the page title and the bar share one row (`PageFrame`'s `toolbarBesideTitle`), which wraps at narrow widths, and the status line (the fixture note, "Links shown for the selected order" and the chunk status) sits on the same row, so the grid starts right under it. The bar holds Go to now, the order filter, My draft while the draft has changes, and on the Gantt one View menu at the right end with Hide closed time, Workload, Cascade, the columns and the tree pane widths. The board has no View menu. When the draft drawer closes with no changes left, focus moves to the order filter. Neither view has Earlier, Later, Go to date, a range text or a level menu; with focus in the grid, Alt+Page Up and Alt+Page Down scroll one viewport width earlier and later, and focus moves to the row's first block that starts in the new view, else to the row's first cell: on the Gantt the row, on the board the line's row header. A Not placed job order and a line's empty cell keep focus. The grid's accessible name keeps the span in view. The job order table keeps its Range, Earlier, Now, Later and Go to date.
- The order filter as built (#940, under [ADR 0090](../adr/0090-a-smooth-zoom-and-a-slim-bar-above-the-timeline-on-the-planning-board-and-the-order-gantt.md)): a search field named Filter orders in the bar of both views, which filters 250 ms after the last key, holds at most 100 characters without the spaces around them and empties on Escape or Clear filter. It is the URL key `q`, written with replace; a longer `q` is dropped with ADR 0062's status message. The filter decides what is drawn, never what the move rules see: while there is a filter every page of the row list loads, and the time chunks load every job order, so the overlap check, the cascade, `validate()` and the workload see the whole machine; a second row list loads the matching orders by page through `loadRows({ search }, page)` and says what matches. The view draws the orders whose number holds the text, at once, so a stale page or chunk never shows others. On the Gantt only the matching orders' rows show, and a run keeps only its matching orders; on the board the machine rows stay and only the matching orders' job orders show, the Not placed row included. When the first match in the drawn order changes, the time area scrolls to its span, from the row list when its job orders are not loaded; a link that opens filtered at a start keeps it until the filter changes. The result is announced politely. With no match the page shows "No orders match <filter>" with Clear filter, which brings every order back and keeps the scroll position. No server row query exists yet, so the search argument of its Zod contract comes with it.
- Culling by binary search over blocks sorted by start per row, and hit testing through the scale and the virtualizer offsets. Proposed.
- Rows virtualized with TanStack Virtual; `aria-rowcount` and `aria-rowindex` set; the focused row and the preview row kept mounted ([07](07-production-planning.md#grid-semantics-and-focus)). TanStack Virtual is not in the workspace catalog yet and comes in its own pull request ([AGENTS.md](../../AGENTS.md)).
- Blocks as DOM elements positioned with `transform`, the drag preview in `requestAnimationFrame` with its state outside React, pointer events with `setPointerCapture`. Proposed.
- The block states, cues and accessible name texts of [07](07-production-planning.md#block-states), the density steps and the cluster rule of D3, `textColorFor` for block text, the 1 px `block-border` and the 1 px gap ([06-web-and-ux.md](06-web-and-ux.md)). Decided through [ADR 0021](../adr/0021-accessibility-target-wcag-2-2-aa.md) where it states them, otherwise Proposed.
- The SVG link overlay, the hover card, the detail panel, the block menu, the Move dialog, keyboard move mode, the Escape stack, the announcements ([07](07-production-planning.md#board-accessibility)).
- Availability per machine from core's availability query, memoized per calendar version, in epoch milliseconds ([07](07-production-planning.md#data-loading)).
- Draft overlay, soft locks, realtime subscription, pause, the URL keys `zoom`, `from`, `order` and, under [ADR 0090](../adr/0090-a-smooth-zoom-and-a-slim-bar-above-the-timeline-on-the-planning-board-and-the-order-gantt.md) (proposed), the order filter `q` ([ADR 0062](../adr/0062-web-form-contracts-url-view-state-and-module-link-manifests.md)). Decided for the URL rules of ADR 0062 and the keys `zoom`, `from` and `order`; `zoom` holds the width per hour to three significant digits, as built in #941, and `q` waits for ADR 0090.

### What each view supplies

A view gives the core a row model and a drop model. Everything else is shared.

| | Board | Order Gantt |
|---|---|---|
| Row model | equipment groups and machines, each machine one row | production orders, under each its operations, under each its job orders; three levels |
| Row kinds | group band, machine row, the pinned Not placed row | order row (summary), operation row (summary), job order row (block), the pinned Not placed row |
| What a block row shows | every job order of that machine in range | one job order |
| Summary rows | none | a summary bar per order and per operation, never movable |
| Availability shading | the machine's availability | the job order's machine on a job order row; the plant calendar on summary rows |
| Vertical drag axis | machines (allowed ones) | none: a drag moves in time only; the machine changes through the detail panel or the Move dialog |
| Links | the selected order's, with lead time | every expanded order's, up to a limit, then the selected order's ([The order Gantt](#the-order-gantt)) |
| Left column | machine name and group stripe | the tree table of [Tree columns](#tree-columns) |
| Grid role | `grid` | `treegrid` |

### Additions the core needs

1. Summary bars. A row kind that draws one bar from the earliest start to the latest end of its children, with no block text, the order color at reduced opacity and the same 1 px border, never focusable as a move target and never in a cluster. Its accessible name is the row header plus the span ("Order 1001, Tue 3 Nov 11:30 to Thu 5 Nov 10:45, on time").
2. Vertical markers and bands. Deadline markers, the now line, the frozen window band, the earliest start marker and the late band are drawn in one marker layer over the time area, from marker descriptors `{ kind, atMs or [fromMs, toMs), rowId or all, label, accessibleText }`. The layer draws nothing outside the visible range and merges markers that fall within 1 px of each other into one with a combined label.
3. A lane under a row. The workload lane is a row of fixed height attached under a machine row, drawn with the same scale and culled with the same binary search over its buckets.

## The order Gantt

### Rows and the tree

- Level 1: production order. Row header: order number, article name, quantity in the stock unit, deadline as a plant date, status, late-by when late. Collapsible; collapsed by default when the row list's `totalCount` is above 60 orders, expanded otherwise. Working default.
- Level 2: operation. Row header: display number, operation name, quantity, the allowed machines as a count with the default machine's code ("3 machines, default CNC1"), the hard lock when set. Collapsible; expanded by default.
- Level 3: job order. Row header: machine code, quantity, status. One row per job order, so a split operation shows its halves on separate rows and two halves on different machines never overlap visually. A job order without a machine or without a setup start sits in the pinned Not placed row of the view, under the time header, as on the board; the operation row then shows the count ("1 not placed").
- Sorting: orders by the autoplan order (deadline instant, priority with null last, order number by code units, id) by default; the tree columns sort on their own columns as [Tree columns](#tree-columns) says. Operations by sequence. Job orders by planned start, unplaced last.
- A hand-linked child order ([07](07-production-planning.md#child-orders)) appears under its parent as a level 1 row with an indent marker and a "child of 1001" text in its header, and also in its own place when the sort puts it there. It is drawn once; the second place is a reference row that scrolls to the first. Working default.
- The order Gantt loads orders, not machines. The default rows are every order that is neither finished nor cancelled, which includes every order late at `now`, loaded apart from their job orders' placements, so rows stay put while the planner scrolls and a late order whose rows lie in the past still shows; finished orders join through the "Include finished" filter ([ADR 0089](../adr/0089-zoom-levels-and-an-endless-time-axis-that-loads-by-time-chunk-on-the-planning-board-and-the-order-gantt.md), decided). The filters of the job order table view apply (late only, equipment, status, article, customer order, search by number). Decided for the filter conventions ([ADR 0016](../adr/0016-graphql-list-conventions-connections-relations-filter-sort-search-and-group-by.md)).
- Row heights: order and operation rows 36 px, job order rows 52 px as on the board, the workload lane 40 px. All in `rem` so 200 percent text zoom grows them ([07](07-production-planning.md#reflow-zoom-and-color)).

### Tree columns

The left pane is a TanStack Table over the tree. Columns, all optional except the first, chosen in the same columns menu the job order table uses:

| Column | Level | Content |
|---|---|---|
| Name | all | the row header text above, with the disclosure button at levels 1 and 2 |
| Machine | 3 | machine code; at level 2 the default machine |
| Quantity | all | stock unit quantity |
| Start, End | all | plant time with the zone label rule ([ADR 0061](../adr/0061-presentation-settings-for-dates-clocks-and-numbers-with-one-pinned-locale.md)); at levels 1 and 2 the summary span |
| Working time | 3 | planned seconds as a duration; at levels 1 and 2 the sum |
| Deadline | 1 | the deadline instant |
| Late by | 1 | elapsed time from deadline to planned end when late, else empty |
| Float | 3 | free float as working time; "0" on a critical row; "unknown" while computing |
| Status | all | the status word |
| Lock | 1 to 3 | soft lock holder; hard lock at level 2 |

Sorting on a column sorts level 1 rows and keeps the tree under each. Sortable headers set `aria-sort`. Decided through [ADR 0021](../adr/0021-accessibility-target-wcag-2-2-aa.md) for the table semantics.

The left pane is a locked grid beside the time area, as in Bryntum's Gantt and DHTMLX Gantt (#943). It sticks at the grid's start edge as one block and covers everything the time area draws under it: the now line, the frozen window, the wait and free float lines, the deadline markers, the links, the drag preview and the chunk bands. A splitter between the pane and the time area sets the pane's width, 40 percent of the view by default, at least 160 px and leaving the time area at least 160 px where the view is wide enough for both; the width stays in this browser with the Gantt's other options. The splitter's grip sits over the header row, and the View menu offers a narrow, medium or wide pane in one click, the alternative to the drag (WCAG 2.5.7). The Name column takes what the other shown columns leave of the pane at their default widths, at least 160 px. When the shown columns are wider than the pane, the pane scrolls sideways on its own, with its own scrollbar under the rows, and the time area keeps its own scroll; a sideways wheel or swipe over the pane scrolls the pane, and its vertical part still scrolls the rows.

Every tree column except Name resizes by the handle on its header's end edge, 24 px wide: the pointer drags it, and the edge follows the pointer, since the Name column keeps its width and the columns after it move; Left and Right on the handle, or Alt+Left and Alt+Right on the column's sort button, narrow and widen the column by 8 px. A click on the handle without a drag shows Narrower and Wider buttons beside it, which change the column by 16 px, the one-click alternative to the drag (WCAG 2.5.7). A column never narrows past the least width that keeps its header readable, nor widens past 480 px, and a text value cut short ends in an ellipsis. The widths stay in this browser with the hidden columns in the Gantt's options. The board's machine column resizes the same way by its header edge, from 140 px to what leaves the time area 160 px, with its width kept in this browser; its drag draws a line and resizes on release, since a new width rebuilds the time buffer. The board keeps one Tab stop, so its handle takes none, and Alt+Left and Alt+Right anywhere in the board resize the machine column.

### Blocks, links and the selection

- A job order row shows its one block with the board's fields, density steps, states, hover card and menu. Nothing changes in the block layer.
- Links are drawn for every expanded order while the number of visible links is at most 200; above that, for the selected order only, and the toolbar says "Links shown for the selected order". Working default for the limit, to be set from the spike measurement ([Performance budgets](#performance-budgets)).
- A link goes from the release point of the earlier operation to the earliest start of the later one. The release point is the latest end over the earlier operation's rows, or the instant at which the send-ahead quantity is complete when one is set. The lead time is drawn as a dashed segment from the release point to the release instant, and the solid segment from there to the later operation's start. When the later operation starts before its release (a `LEAD_TIME`, `SEND_AHEAD` or `LAST_PIECE` conflict), the link is drawn in the conflict style with the striped marker at its head, and the accessible text of the later row names it ("starts 45 minutes before its release from 1003.10").
- Selecting any row of an order selects the order, as on the board: the 3 px bar on top of every job order of the order, the links of that order drawn on top of the others, and `order=<id>` in the URL. A single click on a row or its block only selects; a double click opens the row's detail panel, and Enter on the focused row or block is its keyboard path (#884).
- Details of a row is a Sheet from the right over the grid, 320 px wide (Krister, 2026-10-17), and the board opens the same drawer (#917). Its header shows the title with the order number as a link to the order page, the subline (article and quantity) with the status badge, at most one exception line and the actions menu. The exception line of a job order is the first of: a broken constraint, an end after the order deadline ("Ends 6 h after the order deadline"), a material shortage, another planner's hold, a hard lock. The late order's deadline line counts as lateness there, not as a broken constraint, because a late order breaks it on every row as a warning. The menu holds Move, Open order and Show critical chain (Hide chain while it shows), with Lock and Split disabled and described by the reason they wait.
- Under the header, At a glance shows the machine select, the start and end on one line in plant time with the working and elapsed time under it, the order deadline with the free float, the customer, the plant's hover fields that have no place above, and the operations before and after in the order with their end or start. With every section closed, this first view fits the sheet at a 768 px tall viewport and shows no fact twice.
- Four sections start closed, each a button with `aria-expanded` named by its title and summary: "Constraints, n of m hold" ([the constraint list](#the-constraint-list-of-a-row), broken lines first), "Float and timing" with the total float (wait, the binding sentence, earliest start, latest start and end, the release line), "Material, n short" when the operation is short of material, and "Setup and run" with the planned setup and run (the run start and the retool a run saves). Constraints opens by itself on a broken constraint and Material when the shortage is the header's exception.
- An order row's Details has the same header, with the late-by or early flag as its exception line and Combine into a run, Show critical chain, Open order and the disabled Plan this order, Move all later by and Zoom to order in its menu. It shows the order's deadline, span, slack or late-by in working time, the operations, and either the critical chain or "Why late", which names only the cause: the row the chain starts at. A run row and an operation row have the same header and menu.

### Moves on the order Gantt

- A drag moves a job order in time on its machine. Snapping as the board: first to the step of the zoom's band, then forward to the next working instant on the machine ([ADR 0030](../adr/0030-a-planning-board-built-in-house.md)). The preview shows the new span, the frozen window feedback and, with cascade on, the ghost spans of the rows the cascade would move ([Auto-scheduling in a draft](#auto-scheduling-in-a-draft)).
- The machine changes through the detail panel's machine select or the Move dialog, both limited to the operation's allowed machines. Keyboard move mode steps time with Left and Right; Up and Down step through the allowed machines as on the board, so the keyboard path can change the machine without the dialog.
- Every move goes through `judgeMove` and lands in the draft as `moveJobOrderInDraft`, as the board. Refusals and confirmable conflicts are the board's ([07](07-production-planning.md#fixed-frozen-held-and-locked-rows)).
- Summary rows cannot be dragged. Dragging an order or operation row does nothing and the row's menu offers "Zoom to fit" (the order's span, as [ADR 0089](../adr/0089-zoom-levels-and-an-endless-time-axis-that-loads-by-time-chunk-on-the-planning-board-and-the-order-gantt.md) decides), "Show critical chain", "Plan this order" and "Move all later by" ([Auto-scheduling in a draft](#auto-scheduling-in-a-draft)), and "Combine into a run" when two or more orders of one article are selected ([Runs](#runs)).

### Other row rules

- Cancelled job orders and cancelled orders are not drawn in either view. The job order table lists them under the status filter. Working default.
- Progress: a job order row shows the board's progress bar once started. An operation row shows reported good plus scrap over its quantity as a thin bar inside its summary bar; an order row shows its last operation's progress. The accessible name carries the numbers ("240 of 600 pcs reported").
- Split: the job order row's menu offers Split, which writes the draft change of kind `split` from [07](07-production-planning.md#splitting-and-hard-locking-by-hand-plan-proposal). The new job order appears as a new row under the operation, in the Not placed row until it is moved, with its own full retool.
- Hand-set deadline and priority of a NorthMES-owned order are edited in the order's detail panel through `planning.updateProductionOrder`; an ERP-owned order shows them read-only with "from the ERP".

## Runs

Plan proposal, from Krister Johansson's decision of 2026-10-17 and [ADR 0083](../adr/0083-runs-of-production-orders-of-one-article.md). A run is two or more production orders of one article at one plant that a planner has combined to plan together: a later order's job order of an operation with a retool follows the earlier order's job order of that operation on its machine without a second retool (its fixed time stays), when the operation allows that machine and as soon as its own release allows, while its other job orders keep their setup, and the run is due at the earliest deadline of its orders. The orders are at one plant by construction: the Gantt page is a plant's page and loads that plant's orders only. The ADR holds the rules; this section says how the order Gantt offers, reviews, draws and undoes a run. The design frames PR1 to PR3 of the planning pages round (issue 689) show the review step and the run on the Gantt.

### Selecting the orders

- Order rows can be multi-selected: Shift+click adds an order row to the selection, and in row focus mode Shift+Space does the same; a click or Space without Shift selects that one row, as the treegrid pattern. Blocks and operation rows are never multi-selected ([Scope](#scope)). `order=<id>` in the URL keeps naming one selected order, the first of the selection; the rest of the selection stays local.
- "Combine into a run" is in the order row's menu and in the Details drawer of an order row. It is enabled when two or more orders of one article are selected. With one order selected it says why it is disabled ("Select another order of Bracket L"); with orders of different articles selected it says "The selected orders are of different articles". An order with a job order in the Not placed row, or with a started, held or hard-locked job order, cannot join (ADR 0083 rule 1): the review step then refuses with the reason. The action needs `planning.jobOrder:schedule`.

### The review step

A dialog named "Combine into a run" opens before anything is written (frame PR1). It lists:

- the orders in the run's order, each with its number, quantity, deadline and owner (the ERP or NorthMES);
- the saved retools, one line per job order whose retool the run saves ("1005.10 follows 1001.10 on CNC 1, saves 30 min of retool");
- the run's deadline and, for each order whose own deadline is later, the early warning ("1005 is due Fri 13 Nov 15:00; the run is due Fri 6 Nov 15:00, 7 days earlier");
- the run's planned span and whether it is late against the run's deadline;
- every break the combine creates, worded as the My draft list will word it ("1005.10 overlaps 1003.10 on CNC 1").

Combine writes the run into the draft; Cancel writes nothing. The dialog takes focus on its first element and returns it to the row's menu button on close; it is on the Escape stack of the board.

### The run on the Gantt

- The run is a row above its orders (frame PR2): a level 1 row "Run of Bracket L" with the summed quantity, the orders' numbers, the run's deadline and late-by, and its own summary bar from the earliest setup start to the latest end over its orders, in the first order's color at reduced opacity with the run cue, a doubled left edge. Its orders are indented under it as its children and keep their operation and job order rows; `aria-level` grows by one under a run. Collapsed, the run row shows the summary bar only.
- A job order whose retool the run saves draws no retool hatch (a fixed time keeps its part of the hatch). Its accessible name, its hover card and Details show the setup that remains, the fixed time, and name the saved retool: "setup 0 min, retool saved by the run (30 min)" for `1005.10`, which has no fixed time, or "setup 10 min, retool saved by the run (30 min)" for a row with 10 min of fixed time (ADR 0083 rule 4).
- An order flagged early shows "early by 7 days" in its row header beside the deadline, in the warning token with a glyph, as late-by shows.
- The run row's menu offers "Split run" and "Zoom to fit" ([ADR 0089](../adr/0089-zoom-levels-and-an-endless-time-axis-that-loads-by-time-chunk-on-the-planning-board-and-the-order-gantt.md), decided). Plan this order and Move all later by apply to the run as a whole once `plan()` exists.
- The My draft list shows the run as one change ("Run of Bracket L: 1001 and 1005, 2 rows moved, 1 retool saved") with Split run as its action, and the breaks it creates as their own lines with the usual actions.
- Split run removes the run. In the draft it discards the run and its moves; on a committed run it writes the moves of `splitRun` into the draft: every row the combine moved back to the placement the run record holds, every saved retool back.
- Sorting places a run by its deadline among the orders; a filter that matches any of its orders shows the run with that order.

### What the domain computes

`combineIntoRun(orders, context)` and `splitRun(run, context)` in `@northmes/planning-domain` (ADR 0083, rule 9). A combine returns the run record (its orders in run order, the deadline, the saved retools, the early orders, and the placement each moved row had before the combine), the moves as the cascade reports them, and the conflicts. The web writes the moves into the draft as draft changes and keeps the run record beside them.

Case G1 `GT10`: `1001` (Bracket L, 600 pcs, deadline Fri 6 Nov 15:00) and `1005` (Bracket L, 600 pcs, NorthMES-owned, deadline Fri 13 Nov 15:00, placed in week 46) are combined. `1001` comes first, because its first row starts Tue 11:30. `1005.10` is laid on CNC1 directly after `1001.10`, Wed 08:00 to Wed 13:45, with no retool (30 min saved); it overlaps `1003.10`, which is reported as `OVERLAP`. `1005.20` follows the cascade rules on CNC2: released Wed 14:45, past `1001.20` and the locked `1002.10`, Fri 06:00 to Mon 9 Nov 07:45. The run's deadline is Fri 6 Nov 15:00; `1005` is early by 7 days; the run ends Mon 9 Nov 07:45 and is late by 2 days 16 h 45 min against its deadline. Split run puts both rows back to their week 46 placements, the 30 min retool of `1005.10` with them.

### Open product owner questions

- PO-81: may a run hold an order with a started, held or hard-locked job order? Working default: no for all three, the review step refuses with the reason.
- PO-82: does the ERP learn of a run, as a note or a field on the orders, or is it NorthMES-internal? Working default: internal.
- PO-83: may a planner set the run's deadline by hand, or is it always the earliest of its orders? Working default: the earliest.
- PO-84: does a run save the whole retool, or does a run of one article still need a shorter changeover, such as a fixture change? Working default: the whole retool; the fixed time of the operation stays.
- PO-85: does the run take every operation of its orders, or only the operations with a setup to save? Working default: every operation of the orders sits under the run, and the setup is saved where there is one.

## Working-time calendars on the timeline

Calendars, versions, shift patterns, breaks, deviations and the availability function are core's ([ADR 0025](../adr/0025-plant-calendars-shift-patterns-and-the-production-day.md), [07](07-production-planning.md#calendars-and-shift-patterns)). The timeline reads availability and never computes it from the pattern. The rules below are plan proposals except where marked.

### Shading and the shift strip

- Every job order row (both views) shades the closed time of its machine: the complement of the machine's availability windows in the visible range, in the `off-time` token. A machine row on the board does the same. Summary rows on the order Gantt shade the plant calendar (the plant's default calendar with plant-wide deviations only), so an order whose operations run on machines with different calendars still has a readable background.
- The time header gets a shift strip, one tier under the ticks, that draws the plant calendar's shifts as labelled bands ("Day" 06:00 to 15:00) and breaks as gaps, at `day` and every finer zoom level. At `week` and every coarser level the strip shows working days as bands and plant-wide non-working deviations with their reason as the label. The strip is off by default and switched on in the View menu; the choice stays local.
- A deviation is visible as a change of shading on the rows it applies to. An overtime deviation on one machine shows as open time on that row only; a plant-wide holiday shows on every row and in the strip. The hover card of shaded time names the reason when a deviation causes it ("Non-working: Maintenance, Mon 9 Nov"), and the detail panel of a block that touches a deviation links to it ("Open deviation"), which opens the calendar page on that record for a plant admin and read-only for a planner. The hover card is the board's, so it opens on focus too.
- `core.calendar.availability_changed` refetches availability for the overlapping visible range in both views, as the board ([07](07-production-planning.md#realtime)). Accepted through [ADR 0018](../adr/0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md).

### Blocks across closed time

- A job order is one contiguous block on its machine: setup, then run time, interrupted only by calendar closures ([ADR 0027](../adr/0027-planned-duration-formula-and-override-precedence.md)). Proposed. The block is drawn from setup start to end as one target with one accessible name, and the closed segments inside it are drawn hollow (the lane color inside the block's border), so a block across a weekend reads as one job that pauses. At `week` and every coarser zoom level, hollow segments narrower than 2 px are not drawn.
- The block's hover card and detail panel show both durations: working time ("3 h working") and elapsed time ("2 days 18 h elapsed"), each with its unit, never the sum without a word. One field names one unit ([ADR 0061](../adr/0061-presentation-settings-for-dates-clocks-and-numbers-with-one-pinned-locale.md)). Accepted.
- The setup part of a block (retool plus fixed time) is drawn as a hatched leading segment when the block is at least 66 px wide, and named in the accessible text ("setup 30 min, run 5 h").

Case G1 `1006.10` (`GT7`): Mill 1, 600 pieces at 18 s, 10 800 s of work from Fri 2026-11-06 13:00. The block runs Fri 13:00 to 15:00 and Mon 2026-11-09 06:00 to 07:00: one block, one hollow segment from Fri 15:00 to Mon 06:00, working 3 h, elapsed 66 h. With a plant-wide non-working deviation on Mon 9 Nov the end moves to Tue 10 Nov 07:00. With Saturday overtime 06:00 to 10:00 on Mill 1 the end moves to Sat 7 Nov 07:00.

### Snapping and the calendar

- A dropped block snaps first to the step of the zoom's band, then forward to the next working instant on the target machine, never backward ([ADR 0030](../adr/0030-a-planning-board-built-in-house.md)). Proposed. The order Gantt uses the same rule.
- A keyboard step (Left or Right in move mode, Earlier or Later in the detail panel) moves one snap step and then applies the same forward snap, so a step that lands in a break lands at the break's end. The step message names the landing instant ([07](07-production-planning.md#moving-without-dragging)).
- Durations in the move preview come from the domain package's duration function over the target machine's availability, so a move onto a machine with a longer night changes the block length in the preview ([ADR 0027](../adr/0027-planned-duration-formula-and-override-precedence.md)). Proposed.

### Time zone and clock changes

- Both views show plant time with the zone label rule and follow every rule of [07](07-production-planning.md#time-and-dst-rules): 25 hour ticks on 2026-10-25 and 23 on 2027-03-28, offset-preserving snapping, formatting through `formatPlantTime` only. Proposed through [ADR 0024](../adr/0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md).
- Temporal is the only date and time library. Luxon, date-fns and `Date` arithmetic are not used, and the domain lint of [ADR 0057](../adr/0057-scheduling-domain-as-a-pure-package-in-the-planning-module.md) keeps the domain package to `@northmes/contracts`. The timeline works in epoch milliseconds inside loops and uses Temporal at the edges. Proposed.

## Constraints and deadlines

A constraint is a rule that bounds where a job order may lie. NorthMES already has most of them as domain rules; this section names them as one list so the timeline can draw each one, explain each one in the detail panel and report each break through `validate()` and `judgeMove`. One new constraint, the earliest start of an order, is added as a plan proposal and needs a decision ([Decisions this document needs](#decisions-this-document-needs)).

### The constraint kinds

| Kind | Bounds | Source of the value | Drawn as | Break reported as |
|---|---|---|---|---|
| Deadline | the order's last end, at or before the deadline instant | `deadline_date` plus the plant's `deadlineRule` ([07](07-production-planning.md#settings)) | a marker on the order row and, on the board, on every block of the order when selected; a late band from the deadline to the planned end when late | the order is late; a warning, never a conflict ([07](07-production-planning.md#conflicts)) |
| Earliest start | no job order of the order starts before it | `earliest_start_at` on the production order, nullable; set by a planner or by the ERP when it sends a start date (plan proposal) | a marker on the order row; shading before it on the order's rows | `EARLIEST_START`, confirmable on Save like `LEAD_TIME` (plan proposal) |
| Release from the predecessor | the later operation's run start (or setup start when `retoolOverlapsLeadTime` is false) at or after the release | the rules between operations ([07](07-production-planning.md#rules-between-operations)) | the link | `LEAD_TIME`, `SEND_AHEAD` |
| Last piece | each later row ends no earlier than the earlier operation's latest end plus lead time plus one cycle | the same rules | the link head when broken | `LAST_PIECE` |
| Hard lock | the row stays where it is | `is_locked` on the operation | the padlock cue | `PINNED` on a move; `LOCKED_IN_PAST` from autoplan |
| Started | machine and actual start stay | status other than `planned` | the play cue and the progress bar | `STARTED` on a move |
| Frozen window | setup start inside [now, now + `frozenHours`) keeps its machine and order | `frozenHours` | a band from `now` to the fence over every row, in the `off-time` token at half opacity with a dashed left edge | `FROZEN_WINDOW`, confirmable |
| Held | rows of an order under another planner's live soft lock | soft locks | the initials badge and dashed border | `LOCKED` on a move |
| Allowed machines | the row's machine is one of the operation's allowed machines | operation equipment | the machine select and the Move dialog list only these; during a drag or move mode on the board the rows of machines the operation cannot use are greyed out with a hatch, their row headers say "not allowed for Turn", and a drop there is refused with the machines the operation runs on; on the order Gantt the workload lanes of those machines are greyed out the same way ([07](07-production-planning.md#moving-without-dragging)) | refused before a draft change is written; a committed row on a machine that is no longer allowed shows the conflict cue with "machine not allowed" (plan proposal) |
| One job at a time | no two rows overlap on one machine | `validate()` | the striped edge on both rows | `OVERLAP` |
| Calendar | a row's work lies in its machine's availability | availability | hollow segments; a committed row with work in closed time shows the conflict cue with "work in closed time" (plan proposal, arises after a calendar change) | `CLOSED_TIME` (plan proposal) |
| Not plannable | a row on non-plannable equipment is not placed by autoplan | `is_plannable` | the row in the Not placed row with its reason | `notPlannable` in the run result |

The constraint kinds a planner can set by hand are the deadline (on a NorthMES-owned order), the earliest start, the hard lock and the allowed machines (master data). Everything else is derived. This is on purpose: a planner says what must hold and moves rows, and NorthMES reports what breaks; it never silently repairs ([07](07-production-planning.md#conflicts)).

### Deadlines on the timeline

- The deadline instant comes from the server with the order (`deadlineInstant` in the board read model, plan proposal for the field), computed with the plant's `deadlineRule`. The browser never derives it from the date, so a rule change shows the same instant everywhere.
- On the order Gantt the deadline is a marker on the order row: a 2 px line with a flag glyph at the row's top edge, labelled with the plant time at Hours and Day zoom. On the board it is drawn on every block of the selected order as a flag at the deadline's x position inside the row, and in the time header as a marker labelled with the order number while the order is selected.
- When the planned end is after the deadline, the late band runs from the deadline to the planned end on the order row, hatched in the `late` token, and the row header shows "late by 15 h 15 min". Late-by is elapsed time; the detail panel adds the working time on the last row's machine ("15 min of working time") because that is what a planner has to find.
- Under `prefers-reduced-motion` nothing animates; in forced colors the marker keeps its glyph ([06-web-and-ux.md](06-web-and-ux.md)). Decided.

Case G1 `1003` (`GT9`): deadline date 2026-11-04. Under `endOfShift` the deadline instant is Wed 15:00 and the order ends Thu 06:15, late by 54 900 s elapsed (15 h 15 min) and 900 s of working time on Mill 1. Under `startOfDay` the deadline is Wed 00:00 and the order is late by 108 900 s (1 day 6 h 15 min). Order `1001` is on time under both rules: it ends Thu 10:45 against Fri 15:00 or Fri 00:00.

Case G1 `GT8`: with `now` Mon 2 Nov 09:40 and `frozenHours` 24 the fence is Tue 3 Nov 09:40 and no row of G1 lies inside it. With `now` moved to Tue 3 Nov 09:40 the band covers Tue 09:40 to Wed 09:40, `1001.10` (setup start Tue 11:30), `1003.10` (Wed 08:00) and `1001.20` (Wed 09:00) are frozen: a pointer move of any of them asks for confirmation, the cascade of GT3 stops at `1003.10` before it starts, and the chain of GT2 ends at `1003.10` with root `frozenWindow`.

### The earliest start of an order

Plan proposal. A nullable `earliest_start_at` instant on `production_order`, set through `planning.updateProductionOrder` and importable when a connector maps an ERP start date. Autoplan treats it as a lower bound on the first operation's setup start in the backward pass (`notBefore = max(fence, release from fixed predecessors, earliestStartAt)`) and as the start of the forward pass. `validate()` reports a row before it as `EARLIEST_START`. The timeline draws it as a marker on the order row and shades the order's rows before it. The product owner decides whether the pilot needs it; until then the column exists, the UI hides the field, and the fixture `G1` sets none (`PO-nn` to be assigned in [16-open-questions.md](16-open-questions.md)).

### The planner anchor

Plan proposal that needs a decision ([Decisions this document needs](#decisions-this-document-needs)). Today a free row a planner placed by hand and saved is free again for the next autoplan run, which may move it back ([07](07-production-planning.md#row-classification)); the only way to keep it is the hard lock, which also stops the planner's colleagues. Planners who drag a row to Thursday expect it to stay no earlier than Thursday. The proposal:

- A hand move (pointer, keyboard, detail panel, Move dialog) records on the draft change, and at Save on the job order, `anchored_not_before_at` = the dropped setup start and `anchored_by` = the planner. Cascade moves and plan this order record no anchor; autoplan clears none.
- Autoplan treats the anchor as a lower bound on the row's setup start in both passes (`notBefore = max(fence, release from fixed predecessors, earliestStartAt, anchoredNotBeforeAt)`). It may still move the row later and onto another allowed machine; it never moves it earlier than the anchor.
- The anchor is shown as a small pin glyph at the block's start edge and in the constraint list ("Placed by Anna Berg on Tue 3 Nov, not before Thu 5 Nov 06:00"). The row's menu offers "Release anchor". Breaking a colleague's anchor needs no permission beyond `schedule`, because the anchor is a hint to autoplan, not a lock.
- Behind the plant setting `plannerAnchors` (default off until the decision), so the fixture and the release 1 tests run without it.

### The constraint list of a row

The detail panel of a job order row lists every constraint kind that applies to it, in the order of the table above, each as one line: the kind, its value in plant time, and whether it holds. A broken one carries the conflict code and the other row or order it involves. The list is built from the loaded plan and the draft overlay by one pure function, `constraintsOf(row, context)`, in the domain package, so the panel, the hover card's one-line summary ("2 constraints, 1 broken") and the MCP tool that explains a row can share it. Lines are plain text with `lang` on article names, as block names are built ([07](07-production-planning.md#grid-semantics-and-focus)).

## Auto-scheduling in a draft

Autoplan plans the plant on the server and applies the result ([ADR 0028](../adr/0028-autoplan-as-a-pure-deterministic-function.md)). The timeline adds two smaller forms of automatic placement that run in the browser and write into the planner's own draft, so a planner can see the consequence of a move before Save and never has to fix successors by hand. Both are plan proposals.

### Cascade

Cascade keeps the rules between operations after a move of one job order, by moving the later operations of the same order later when the move broke a rule.

Rules:

1. Cascade runs after a draft move (pointer, keyboard, detail panel or Move dialog) when the switch "Cascade" in the View menu is on. The switch is on by default and the choice stays local. Working default.
2. Scope: the rows of the moved row's production order only, in operation sequence after the moved row's operation. Rows of other orders never move; a collision with another order's row is reported as `OVERLAP`, not resolved.
3. Direction: later only. A successor whose release moved earlier stays where it is. "Move all earlier" is the compaction a planner gets from plan this order, not from cascade.
4. Per successor row, in sequence order, then by planned start, then id: compute its release from the (possibly moved) predecessor rows with the rules of [07](07-production-planning.md#rules-between-operations), including the send-ahead quantity and the last-piece rule. If the row's run start is at or after its release and its end satisfies the last-piece bound, it stays. Otherwise its new setup start is the earliest working instant on its current machine at or after the release (less its own retool when `retoolOverlapsLeadTime` is true), moved further right to the first position where it overlaps no reservation on that machine, and further right until the last-piece bound holds. The row keeps its machine.
5. Fixed rows stop the cascade: a successor row that is hard-locked, started, held, or inside the frozen window is not moved. Its broken rule is reported as the conflict it is, and rows after it are not visited, because their bound is the fixed row's unchanged end. The preview names the stop ("Stops at 1003.20: locked").
6. A cascade that runs past the loaded range fetches the rows it needs by order id; a cascade that cannot place a row within the horizon rule of [ADR 0025](../adr/0025-plant-calendars-shift-patterns-and-the-production-day.md) leaves that row where it is and reports it.
7. Every moved successor becomes its own draft change through `moveJobOrderInDraft`, under the same soft lock (the order's). The move command accepts a list so the cascade is one round trip, and the draft shows each row as "mine in draft".
8. Preview before write: during a drag the ghost spans of the rows cascade would move are drawn in the draft style at reduced opacity, with a count in the drag tooltip ("+1 row moves"). In keyboard move mode the step message carries the same count. Nothing is written until the drop or Enter.
9. Cascade off: the move is written alone and `validate()` reports the broken rule on both rows, as today.
10. Dropping a row before its own release: with cascade on, the drop snaps forward to the release (after the calendar snap), and the drag tooltip and the step message say "snapped to release from 1003.10". With cascade off the raw position is kept and the conflict is reported. A row can therefore be made early only on purpose, with the switch off, and Save still asks for a reason.

`cascade(order, movedRow, context): CascadeResult` is a pure function in `@northmes/planning-domain`. `context` holds the reservations on the involved machines, their availability, `now`, the fence and the plant settings. The result lists the moves, the stop (if any) and the conflicts that remain. It is deterministic and permutation-invariant like `plan()`.

Case G1 `GT3`: the planner drags `1003.10` on CNC1 from Wed 08:00 to Wed 09:00. It now ends Wed 13:30. `1003.20` on Mill 1 is planned from Wed 12:45 with lead time 0, so its release moved past its start. Cascade moves `1003.20` to Wed 13:30, ending Thu 07:00; two draft changes are written and the order is late by 57 600 s instead of 54 900 s. With cascade off, one draft change is written and `validate()` reports `LEAD_TIME` on `1003.10` and `1003.20`.

Case G1 `GT4`: `1004.10` on CNC1 from Thu 06:00 with 30 min retool and send-ahead 300; `1004.20` on Mill 1 with lead 30 min and a 20 s cycle. The release of 300 pieces is Thu 09:15 (setup ends 06:30, 9 000 s of run across the 08:30 break), plus the lead time Thu 09:45. Placed forward from the release, `1004.20` would end Fri 07:55, before `1004.10` ends (Fri 08:15) plus lead plus one cycle, Fri 08:45:20: a `LAST_PIECE` break. Cascade and plan this order therefore place `1004.20` from Thu 10:20:20 to Fri 08:45:20, and no conflict remains.

### Resolving a break in the draft

Plan proposal. Nothing is repaired silently and nothing is modal; the planner resolves a break where it appears.

- The My draft tab of the docked inspector (approved in D3) lists every conflict the draft creates, one line per conflict with the two rows it involves, the broken rule and the instant that clears it ("1003.20 starts 45 min before its release from 1003.10; clears at Wed 13:30"). The list is the one `validate()` returns for the draft over the committed rows, so it equals what Save will show.
- Each line offers the actions that fit the kind: Cascade from here (runs the cascade for that order from the earlier row), Move back (discards that draft change), Plan this order, Move (the Move dialog for the later row), and Keep (the conflict stays and Save asks for a reason). A refusal kind (`PINNED`, `LOCKED`, `STARTED`) offers Move back and Open order only.
- Choosing a line focuses the first row and scrolls both views to it. The list is a semantic list with the actions as buttons; the count is announced politely when it changes ("2 conflicts in your draft").
- This list covers the planner's own draft only. A plant-wide conflict navigator stays cut ([ADR 0030](../adr/0030-a-planning-board-built-in-house.md)).

### Plan this order

Plan this order runs `plan()` for one production order in the browser, against the loaded reservations as fixed rows, and writes the placements into the draft.

Rules:

1. Available from the order row's menu and the detail panel of any row of the order, and from the job order table's row menu. Permission `planning.jobOrder:schedule`.
2. Input: a snapshot built in the browser with the same shape `plan()` takes on the server ([07](07-production-planning.md#snapshot)): `now`, the plant zone and settings, availability per machine the order may use, the order with its operations and job orders, and every other loaded row on those machines as a fixed reservation. Rows of the order that are fixed by class (started, hard-locked, inside the fence, held) stay fixed. The browser extends the loaded range by fetch until the order's horizon is covered: backward from the deadline for the planned seconds of the order plus two weeks, forward the same when the backward pass fails.
3. The result is previewed before it is written: the order's rows are drawn at their new positions in the draft style, the detail panel lists the moves with old and new spans, whether the forward fallback ran, whether the order is late and by how much, and any conflict with fixed rows. The planner confirms with Apply, which writes the moves as draft changes, or cancels.
4. "Move all later by" on an order row is the same preview with a fixed offset: every free row of the order is shifted by the chosen working time on its machine with the cascade rules; it is for the case "this customer accepted a week's delay".
5. The server re-validates at Save as for every draft. Plan this order never bypasses `judgeMove`, soft locks or the frozen window.
6. Determinism: the browser and the server run the same `plan()` on the same snapshot shape; a test runs the G1 cases through both entry points and asserts deep-equal placements.

Case G1 `1001` (`GT1` latest placement): deadline Fri 15:00, `1001.20` 36 000 s on CNC2 and `1001.10` 19 800 s on CNC1 with a 1 h lead time between them. The backward pass places `1001.20` Thu 13:15 to Fri 15:00 and `1001.10` Thu 06:00 to Thu 12:15. CNC2 holds the locked `1002.10` Thu 11:30 to 15:00; `1001.20` starts after it, so no conflict. Plan this order from the committed placement (Tue 11:30 and Wed 09:00) therefore proposes two moves, both later, and the order stays on time.

## Float and the critical chain

Autoplan places orders backward from their deadlines, so a just-in-time order has no float against its deadline on any row. A project critical path (every row with zero float against the end date) would mark every row of such an order and tell the planner nothing. What a planner needs is different: for a row, how much later may it start before it hurts something, and for a late order, which rows and which other orders' rows make it late. This section defines both as pure functions over the loaded plan. Plan proposal throughout.

### Definitions

For a job order row `r` on machine `m` with planned setup start `s`, end `e` and planned seconds `w`, over the availability `av(m)`. All times inside the functions are epoch milliseconds; all floats and waits are working seconds on `m`.

- Earliest start `ES(r)`: the first working instant on `m` at or after the largest of the fence, the order's earliest start, and the release from the predecessor operation's rows at their planned positions (with `retoolOverlapsLeadTime` the release bounds the run start, so `ES` is the release less the row's retool laid backward). Reservations of other orders are ignored on purpose. A started row's `ES` is its actual start.
- Wait `W(r)`: `workBetween(av(m), ES(r), s)`. It is the working time the row waits after it could have started: for its machine, for the fence, or because a planner put it there. It is the per-operation wait time the late facts of [07](07-production-planning.md#result) report against the run time.
- Latest end `LE(r)`: for a row of the last operation, the deadline instant; otherwise `latestEnd(P, N, order)` of [07](07-production-planning.md#algorithm), computed from the successor operation's latest starts, not its planned starts. `LE` is computed backward through the operations once per order.
- Latest start `LS(r) = subtractWork(av(m), LE(r), w).start`.
- Total float `TF(r)`: `workBetween(av(m), s, LS(r))` when `s <= LS(r)`, otherwise minus `workBetween(av(m), LS(r), s)`. A negative total float says by how much working time this row alone is past its latest start.
- Successor bound `SB(r)`: the latest end of `r` that keeps every successor row at its planned start: `latestEnd` computed from the successors' planned starts.
- Machine bound `MB(r)`: the setup start of the next reservation on `m` after `e`, of any order and any class, or the end of the loaded horizon.
- Free float `FF(r) = min(max(0, workBetween(e, SB(r))), max(0, workBetween(e, MB(r))), max(0, TF(r)))`.
- Binding constraint `BC(r)`: what stops `r` from starting earlier than `s`, the first that applies in this order: `started` (actual start), `hardLock`, `frozenWindow` (`s` is the first working instant at or after the fence), `earliestStart` (`s` is the first working instant at or after the order's earliest start), `release` (`s`, or the run start when retool overlaps the lead time, equals the release from the predecessor; the row names the predecessor row that sets the release, the latest-ending one or the one that completes the send-ahead quantity), `machine` (a reservation on `m` ends at `s`, within one snap step; the row names it), `calendar` (the release lies in closed time and `s` is the next working instant), `free` (none of the above: a planner or autoplan put the row there with room before it).
- Critical row: `TF(r) <= 0`. Delaying it by any working time delays the order past its deadline, or further past it.
- Critical chain of an order: start at the row of the last operation with the latest end. Follow `BC` backward: from a `release` to the predecessor row it names, from a `machine` to the blocking row it names, which may belong to another order. Stop at a row whose `BC` is `started`, `hardLock`, `frozenWindow`, `earliestStart`, `calendar` or `free`: that row is the root and its kind is the root cause. The chain lists each row with `W`, `TF`, `FF` and `BC`, and stops after 20 rows (working default) with "chain continues". The chain exists for every order; for an on-time order it says why the order lies where it lies, for a late order it says why it is late.
- Slack of an order: the elapsed time from the planned end to the deadline, negative when late. It is the "late by" of 07 with its sign, and it is elapsed, not working, time.

Ties are broken by code units of the display number, then by id, as everywhere in the domain package ([ADR 0028](../adr/0028-autoplan-as-a-pure-deterministic-function.md)).

### Mapping to the words of project planning tools

Planners who know project tools will look for these words. The table says which NorthMES rule each one is, so the UI never needs the project word.

| Project tool word | NorthMES rule |
|---|---|
| finish no later than | the order's deadline |
| start no earlier than | the order's earliest start |
| must start on, must finish on | the hard lock on an operation |
| as late as possible | autoplan's backward pass, and plan this order |
| as soon as possible | autoplan's forward fallback; "Move all earlier" is not offered, plan this order is |
| finish-to-start with lag | the release with lead time |
| transfer batch, overlap | the send-ahead quantity |
| manually scheduled task | a hard-locked, started or frozen row |
| inactive task | a cancelled job order |
| early start, late start, total slack, free slack | earliest start, latest start, total float, free float, in working seconds on the machine |
| critical path | the critical chain, which includes machine reservations |
| resource histogram | the workload lane |

### What the timeline shows

- Hover card and detail panel of a row: wait, free float, total float, the binding constraint as one sentence ("Waits 6 h 50 min for CNC1: 1001.10 ends 08:00, this row starts 08:00"), the earliest and the latest start as plant instants.
- The Float column of the order Gantt shows free float. A critical row shows "0" with the chain glyph; a row past its latest start shows its negative total float ("minus 15 min").
- Free float is drawn as a thin line from the block's end to `e + FF` on the row, in the block's text color at reduced opacity, at Hours and Day zoom when it is at least 4 px long. Wait is drawn the same way before the block, from `ES` to `s`, when the binding constraint is `machine` or `free`. Both are hints, not targets, and have no accessible name of their own; the numbers live in the row's name.
- "Show critical chain" in the order row's menu and in the detail panel highlights the chain: every chain row gets a 2 px inner outline in the `late` token for a late order (the foreground token for an on-time order), the chain's links are drawn solid and on top, and rows of other orders in the chain are scrolled into view on the board or fetched into the Gantt as reference rows. The highlight is a mode on the Escape stack and ends with Escape. The chain of a late order is shown by default when the order is opened from the "Late only" filter. Working default.
- While the chain highlight is on, every row of the order shows a tick at its latest start and a second one at its latest end, in the foreground token, so the planner sees how far each row may slip; on a late order the ticks lie left of the block and the gap is the negative float.
- The explanation in the detail panel is the chain as text, one sentence per row built from `BC`, `W` and the floats: "1003 is late by 15 h 15 min. 1003.20 on Mill 1 starts when 1003.10 ends. 1003.10 on CNC1 waits 6 h 50 min for 1001.10. 1001.10 is free and has 11 h 45 min of total float." Each row name is a link that focuses the row. The last sentence is the lead the planner follows.
- On the board the same highlight works from a selected block's menu; the chain rows lie on several machines, which is where the board view earns its place.

### Functions

`floatOf(order, context): FloatResult` and `criticalChain(order, context): ChainResult` live in `@northmes/planning-domain`, next to `plan()`, and reuse `latestEnd`, `addWork`, `subtractWork` and the release functions. `context` is the loaded plan: placements with their class, reservations per machine sorted by start, availability per machine, `now`, the fence and the settings. Both are pure, deterministic and permutation-invariant, compare by code units and end on id, and work in epoch milliseconds. The late facts of `plan()` ([07](07-production-planning.md#result)) gain the chain of each late order when the maintainer accepts it ([Decisions this document needs](#decisions-this-document-needs)); until then the browser computes it from the loaded plan.

Case G1 `GT1` (order `1001`, committed placement, `now` Mon 2 Nov 09:40, fence Tue 3 Nov 09:40): `1001.10` CNC1 Tue 11:30 to Wed 08:00, `1001.20` CNC2 Wed 09:00 to Thu 10:45, `1002.10` locked on CNC2 Thu 11:30 to 15:00, deadline Fri 15:00. Latest placement: `1001.20` Thu 13:15 to Fri 15:00, `1001.10` Thu 06:00 to 12:15. `1001.10`: earliest start Tue 09:40, wait 4 800 s, total float 42 300 s, free float 0 (its end plus the 1 h lead is `1001.20`'s start), binding constraint `free`. `1001.20`: earliest start Wed 09:00, wait 0, total float 43 200 s, free float 900 s (the machine: `1002.10` starts 15 min after it ends), binding constraint `release` from `1001.10`. No row is critical; the order has 101 700 s of slack. The chain is `1001.20` (release from `1001.10`), `1001.10` (free, root), and the panel says "On time, slack 1 day 4 h 15 min".

Case G1 `GT2` (order `1003`): `1003.10` CNC1 Wed 08:00 to 12:45, `1003.20` Mill 1 Wed 12:45 to Thu 06:15, deadline Wed 15:00, late by 54 900 s elapsed. Latest starts: `1003.20` Wed 12:30, `1003.10` Wed 07:45. Total float: both minus 900 s; free float: both 0; both critical. `1003.10`: earliest start Tue 09:40, wait 24 600 s, binding constraint `machine`, `1001.10` on CNC1. `1003.20`: wait 0, binding constraint `release` from `1003.10`. Chain: `1003.20`, `1003.10`, then `1001.10` of order `1001` as the root with kind `free` and 42 300 s of total float. The what-if in the fixture shows `1003.10` placed first on CNC1 at Tue 11:30 ending Wed 06:30, and `1003.20` ending Wed 09:15, on time; the timeline does not perform that swap, it shows the planner where to look.

## Workload

Workload is machine load against availability per bucket. In NorthMES one machine runs one job order at a time, so load above availability means an overlap or work in closed time, both of which are conflicts already. The workload views therefore answer two other questions: where is free capacity, and which days are full. Plan proposal throughout. People and tools are out of scope ([Scope](#scope)).

### Definition

For a machine `m` and a bucket `[a, b)`:

- `availableS`: working seconds of `av(m)` inside `[a, b)`.
- `loadedS`: the sum over every job order on `m` of its working segments inside `[a, b)`, overlapping rows counted twice. Draft moves count at their draft position; the committed position of a moved row does not count.
- `setupS` and `runS`: the split of `loadedS` by the setup and run time parts of each row.
- `freeS = max(0, availableS - loadedS)`: the working time still open in the bucket, which is what a planner looks for when placing work.
- `overloadS = max(0, loadedS - availableS) + closedS`, where `closedS` is work laid in closed time (only after a calendar change on committed rows).
- `utilization = loadedS / availableS` as a permille integer; undefined when `availableS = 0` (shown as "closed").
- Buckets follow the zoom level ([ADR 0089](../adr/0089-zoom-levels-and-an-endless-time-axis-that-loads-by-time-chunk-on-the-planning-board-and-the-order-gantt.md), decided): `day` and every finer level bucket by shift (from the plant calendar's shifts, plus one bucket per overtime deviation outside a shift), `week` by production day, `4weeks` and `quarter` by ISO week, `year` by month. The production day boundary is the plant's `production_day_start` ([ADR 0025](../adr/0025-plant-calendars-shift-patterns-and-the-production-day.md)). The fixture buckets by production day with day start 06:00 on a calendar whose shifts lie inside one date, so the buckets equal plant dates there.

### The workload lane

- On the board, the View menu offers "Workload under machines". When on, every machine row gets a 40 px lane under it with one bar per bucket: height proportional to utilization (full height at 100 percent), setup part hatched, overload drawn above the lane's top edge in the `late` token with the striped pattern. Buckets with `availableS = 0` draw nothing and are named "closed".
- On the order Gantt, where machines are not rows, the workload is a panel docked at the bottom of the time area ("Workload" in the View menu): one lane per machine the visible orders use, sorted by equipment group then code, with the same bars and the same scale. Collapsible per machine. The panel is capped at 40 percent of the view height and scrolls inside.
- On the board a collapsed equipment group band shows the group's lane: available and loaded seconds summed over its machines, so a planner reads a group's free capacity without expanding it.
- Lane bars are not interactive targets. Each lane has one focusable element, its row header button "Workload on CNC1", which opens the lane's text table as a popover: one row per bucket with available, loaded, setup, run, free, utilization and overload, with the bucket's span in plant time, and a totals row over the visible range. The popover is the accessible form, so the lane itself is `aria-hidden` and the table carries `aria-describedby` from the lane's name. Decided for the pattern through [ADR 0021](../adr/0021-accessibility-target-wcag-2-2-aa.md) (a visual form with a text alternative that has every value).
- Hovering a bar shows the same values for that bucket in the hover card, on focus too.
- A bar's color is the lane's foreground token; utilization is read from height and from the number, never from a hue, so no state maps to a color ([07](07-production-planning.md#block-states)).
- The lane follows the draft: dragging a row updates the two affected buckets in the drag preview's frame.
- During a move on the order Gantt, the lanes of the machines the job order's operation does not allow are greyed out: the lane's time part takes the board's veil and hatch under its bars, and the lane button's accessible name says "not allowed for Turn", until the move ends (#944).

### The workload query

`planningWorkload(plantId, from, to, bucket: shift | productionDay | isoWeek | month, equipmentIds?)` returns the rows of the table above for the committed plan, computed on the server with the same domain function over the same availability. It serves the plant-wide week table in the job order table view ("Workload" tab) and a later report; the lanes in the browser compute from the loaded range so the draft is included. A test asserts that the browser and the server agree on the committed plan for the G1 week.

Case G1 `GT5`, production days in week 45:

| Day | CNC1 loaded of 29 700 s | CNC2 | Mill 1 |
|---|---|---|---|
| Mon 2 Nov | 0 | 0 | 0 |
| Tue 3 Nov | 12 600 (setup 1 800), 424 permille | 0 | 0 |
| Wed 4 Nov | 21 600, 727 permille | 19 800, 667 permille | 8 100, 273 permille |
| Thu 5 Nov | 29 700 (setup 1 800), 1 000 permille | 28 800, 970 permille | 15 880, 535 permille |
| Fri 6 Nov | 8 100, 273 permille | 0 | 16 220, 546 permille |

Case `GT6`: adding a row `1007.10` of 3 600 s on CNC2 at Thu 12:00, over the locked `1002.10`, gives `loadedS` 32 400 against 29 700, `overloadS` 2 700, and an `OVERLAP` conflict on both rows. The lane draws the 2 700 s above its top edge; the conflict is what the planner fixes.

## Data loading

Plan proposal, following the board's rules in [07](07-production-planning.md#data-loading).

- `planningGantt` splits into two queries ([ADR 0089](../adr/0089-zoom-levels-and-an-endless-time-axis-that-loads-by-time-chunk-on-the-planning-board-and-the-order-gantt.md), decided). The row query returns production orders with their operations and their job orders without placements, in deadline order, as a Relay connection ([ADR 0016](../adr/0016-graphql-list-conventions-connections-relations-filter-sort-search-and-group-by.md)); decided for the list conventions. The chunk query returns the job orders whose span overlaps one time chunk. Job orders come as the same GraphQL type the board query returns, so Apollo's normalized cache holds one entry per job order for both views and a draft move shows in both without a refetch.
- The axis is endless and loads by time chunk ([ADR 0089](../adr/0089-zoom-levels-and-an-endless-time-axis-that-loads-by-time-chunk-on-the-planning-board-and-the-order-gantt.md)): the view draws a fixed buffer of three viewport widths, moves it by one viewport width near an edge with the scroll position corrected in the same frame, and loads job orders per chunk of plant time while the row list loads apart. `from` in the URL is the visible start. Decided. The time scroller contains its overscroll (`overscroll-behavior: contain`), so a sideways swipe at an edge never navigates the browser (plan proposal, from the test of 2026-10-17).
- The row list has no range. It pages through its Relay connection into the virtualized rows, loading its pages in order from the first, and a row list with more than `ganttMaxOrders` (working default 1 250) orders, counted on its first page, fails with `planning.gantt.too_many_orders` and the toolbar says "Narrow the filter". The limit is a guard: 1 250 orders is the row model SP3b measures, and its verdict may lower it ([ADR 0089](../adr/0089-zoom-levels-and-an-endless-time-axis-that-loads-by-time-chunk-on-the-planning-board-and-the-order-gantt.md), decided).
- Rows a computation needs outside the loaded set (a chain root in another order, a plan-this-order horizon) are fetched by production order id through `planningProductionOrder` and the board query for the extra range, and merged into the same cache.
- Availability comes from core's availability query for every machine the loaded rows use, memoized per calendar version. Instants stay ISO strings in the cache and become epoch milliseconds once at the data edge ([ADR 0024](../adr/0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md)). Proposed.
- Realtime: the Gantt subscribes to `planningBoardChanged(plantId)` like the board, debounces 250 ms, and refetches by ids when the changed ids fall in its loaded chunks, the chunks in view when the ids are null, and the row list when a production order is created, finished or cancelled; `core.calendar.availability_changed` refetches availability ([ADR 0018](../adr/0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md)). Accepted. Pause live updates works as on the board.
- `planningWorkload` is the one new server computation ([Workload](#the-workload-query)); it runs the domain function over the committed plan.

## Settings, options and permissions

Plan proposal.

| Setting or option | Where | Values | Default |
|---|---|---|---|
| the page | route | the board, the Gantt and the job order table under `/$plant/planning/` | the board |
| Cascade | View menu, local | on, off | on |
| Hide closed time | View menu, local | on, off | on |
| Workload under machines, Workload panel | View menu, local | on, off | off |
| Shift strip | View menu, local | on, off | off |
| Links | View menu, local | expanded orders, selected order | expanded orders, falling back above the link limit |
| `ganttMaxOrders` | plant setting | 50 to 1 250 | 1 250 |
| `earliestStartEnabled` | plant setting | boolean | false until the product owner answers |
| `plannerAnchors` | plant setting | boolean | false until the decision in [Decisions this document needs](#decisions-this-document-needs) |
| Tree columns | columns menu, local | as [Tree columns](#tree-columns) | Name, Machine, Start, End, Deadline, Late by, Float |

No new permission. Moves, cascade, plan this order and Move all later by need `planning.jobOrder:schedule`; the hard lock needs `planning.jobOrder:lock`; setting a deadline or an earliest start on a NorthMES-owned order needs `planning.productionOrder:update` ([07](07-production-planning.md#permissions)).

## URL state

[ADR 0062](../adr/0062-web-form-contracts-url-view-state-and-module-link-manifests.md). Accepted for the rules; the new keys are a plan proposal.

- The board, the Gantt and the job order table are separate routes under `/$plant/planning/`, each an entry under Planning in the sidebar (Krister, 2026-10-17). `zoom`, `from` and `order` keep their meaning on every page, and a link from one page to another, such as "Show on board" in Details, carries them, so the range and the selected order survive the switch, except that the job order table opens at the nearest preset and at the plant date of a date-time `from`. `?view=gantt` on the board route, the first round's key, is dropped and the board opens (Krister, 2026-10-31: no old URL redirects).
- `chain=1` with `order=<id>` opens the view with that order's critical chain highlighted, so "look at why 1003 is late" is one link. Without `order` the key is dropped with the polite status message the ADR prescribes.
- The table view's filter keys apply to the Gantt unchanged.
- The job order table keeps the four presets as its Range. A link from the board or the Gantt at another level opens it at the nearest preset: `quarter-hours` at `hours`, and `quarter` and `year` at `4weeks` ([ADR 0089](../adr/0089-zoom-levels-and-an-endless-time-axis-that-loads-by-time-chunk-on-the-planning-board-and-the-order-gantt.md), decided). Under [ADR 0090](../adr/0090-a-smooth-zoom-and-a-slim-bar-above-the-timeline-on-the-planning-board-and-the-order-gantt.md) (proposed) it opens at the preset of the zoom's band.
- `zoom` holds a zoom level id, and `from` holds the visible start as a plant-local date-time (`2026-11-03T13:20`); a plain date opens at the start of that day ([ADR 0089](../adr/0089-zoom-levels-and-an-endless-time-axis-that-loads-by-time-chunk-on-the-planning-board-and-the-order-gantt.md), decided). Under [ADR 0090](../adr/0090-a-smooth-zoom-and-a-slim-bar-above-the-timeline-on-the-planning-board-and-the-order-gantt.md) (proposed) `zoom` holds the width per hour (`zoom=37.5`), a level id still opens, and `q` holds the order filter.
- Collapsed rows, the cascade switch, the workload and shift strip options, the tree columns and the link mode stay local. Earlier and Later replace the history entry; under [ADR 0090](../adr/0090-a-smooth-zoom-and-a-slim-bar-above-the-timeline-on-the-planning-board-and-the-order-gantt.md) (proposed) Earlier, Later and Go to date leave the board and the Gantt, and the options move into the Gantt's View menu.
- No path literal in code; link builders only.

## Accessibility

[ADR 0021](../adr/0021-accessibility-target-wcag-2-2-aa.md). Accepted: WCAG 2.2 AA. Every rule of [07](07-production-planning.md#board-accessibility) applies to the order Gantt; this section adds what the tree changes.

### Tree grid semantics

- The order Gantt is `role="treegrid"` named after plant, filter and range. Outside a run, order and operation rows carry `aria-level` 1 and 2 and job order rows `aria-level` 3; inside a run ([Runs](#runs)) the run row is level 1 and its orders, operations and job orders are levels 2, 3 and 4. Order, operation and run rows carry `aria-expanded`, `aria-setsize` and `aria-posinset`. Each row has a `rowheader` (the Name cell) and the tree columns as `gridcell`s, then one `gridcell` for the time area that holds the block or the summary bar.
- Row focus mode, as the ARIA Authoring Practices treegrid pattern: Up and Down move between rows, Right expands a collapsed row or moves into its first cell, Left collapses an expanded row or moves back to the row, Home and End go to the first and last row, Page Up and Page Down move a screenful, Enter opens the detail panel of the row. Inside a row, Left and Right move between cells, and the time area cell holds the block, which takes the block keys of the board (M for move mode, the menu key, Shift+F10).
- Move mode on a job order row: Left and Right step one snap slot in time; Up and Down step through the operation's allowed machines; the step message names the machine, the span and the cascade count ("Mill 1, Wed 4 Nov 13:30 to Thu 5 Nov 07:00. 1 row moves with it. Not saved."). Enter commits, Escape cancels, focus stays on the block and returns to it by id after a commit.
- A summary bar cell is focusable for its name only; it has no move keys. Its name carries the span, the status and, for an order row, the slack or late-by.
- Links are not focusable. The relation lives in the successor row's name ("released from 1003.10 at Wed 12:45, starts on time") and in the constraint list.
- Roving tabindex, one Escape stack (hover card, popover, chain highlight, move mode, docked panel), `scroll-padding` for the sticky header and the tree pane: as the board.
- The splitter is a focusable `separator` named "Resize the tree pane", the window splitter of the ARIA Authoring Practices: `aria-valuenow` is the pane's share of the view in percent, between `aria-valuemin` and `aria-valuemax`. Left and Right move it by 2 percent, Home and End to the least and the most width. It sits over the grid's edge, outside the treegrid, whose rows hold only cells. Every tree column header is a Tab stop, by its sort button or its resize handle (a focusable `separator` named "Resize the Deadline column", with the width in pixels as `aria-valuenow`), and a header that takes focus scrolls the pane to show it, so the keyboard reaches every shown column without the pane's scrollbar, which takes no Tab stop.

### The workload lane and the chain

- The lane is `aria-hidden`; the lane's header button opens the table with every value, as [Workload](#the-workload-lane) says. The table is a semantic table with the bucket span in plant time as its row header.
- Turning the chain highlight on announces politely "Critical chain of 1003 shown, 3 rows, root 1001.10 on CNC1", and the chain rows get "on the critical chain" in their names while the highlight is on. Escape ends it and announces "Chain hidden".
- The free float and wait lines have no name; the numbers are in the row name and the Float column.

### Reflow, targets and color

- Under 640 px of width the tree pane and the time area become two tabs ("Orders", "Timeline") over the same rows; the view keeps the selected row across the tabs. Above it the tree pane takes the width its splitter sets, 40 percent by default, and its columns scroll inside it, so the time area keeps at least 160 px. The time area is the 1.4.10 excepted section and scrolls in both directions inside its own container.
- Every target is at least 24 px: blocks, the disclosure buttons, the lane header button, the deadline marker's hit area in the row header (the marker itself is decorative). Row heights and fonts are in `rem`.
- No state maps to a hue: the chain outline, the late band, the overload hatch and the summary bar all carry a shape or a pattern besides their token, and forced colors keep them ([06-web-and-ux.md](06-web-and-ux.md)). Decided.
- Under `prefers-reduced-motion` the cascade ghost spans appear without animation and the chain highlight does not pulse.

### Gates

- `e2e/a11y/gantt.axe.spec.ts` over the states populated, expanded order with links, chain highlight, a focused block with its description, workload lane with its table open, move mode, the review step of a run, the run row and the 640 px tabs, in `ci / a11y`.
- `e2e/planning/gantt-keyboard.spec.ts`: expand an order with Right, enter move mode on a job order row, step a machine with Down and two snaps with Right, Enter; the moved block is focused, lies inside the scroller, and the spoken text matches the server's start and names the cascade count.
- One manual NVDA pass on the order Gantt on the pilot planner-class PC, with the board's pass.

## Performance budgets

The SP3 criteria of [ADR 0030](../adr/0030-a-planning-board-built-in-house.md) apply to the order Gantt view: 60 fps while scrolling at Day zoom, p95 frame time at most 33 ms while dragging at Week zoom with the cascade preview on, no long task over 50 ms, keyboard move mode steps one snap and one machine. The volumes are the board's: pilot scale about 40 machines and 1 600 job orders over 8 weeks, stress scale 60 machines and 5 000 job orders. Plan proposal for the rows below.

| Measure | Budget |
|---|---|
| Gantt rows at pilot scale (500 orders, about 2 000 rows) virtualized, scroll at Day zoom | 60 fps on the planner PC class |
| `floatOf` and `criticalChain` for one order | at most 5 ms on the CI runner |
| `floatOf` for every order in the loaded range (500 orders) | at most 100 ms on the CI runner, computed off the frame in an idle callback and memoized per plan revision and draft version |
| `cascade` preview per drag frame | at most 8 ms, so the frame stays under 33 ms with rendering |
| Workload buckets for 60 machines over 8 weeks by production day | under 30 ms in the browser under the polyfill, as the availability budget of [ADR 0024](../adr/0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md) |
| Links drawn | at most 200 before the view falls back to the selected order |
| The Gantt's row query, one page of 100 orders with its count | at most 200 ms server time at pilot scale |
| `planningWorkload` for the plant over 8 weeks by production day | at most 300 ms |
| Writing an identical Gantt result twice | zero extra block layer renders |
| A Ctrl+wheel zoom gesture across the `hours` to `4weeks` bands, on the board and the Gantt ([ADR 0090](../adr/0090-a-smooth-zoom-and-a-slim-bar-above-the-timeline-on-the-planning-board-and-the-order-gantt.md)) | p95 frame time at most 33 ms and no long task over 50 ms on the planner PC class, measured by `e2e/planning/zoom-gesture.perf.spec.ts` with `NORTHMES_PERF=1`, at G1 until the SP3 and SP3b volumes have a fixture |

The board spike harness (E01-S04-T01) gains a Gantt row model once SP3 has passed (spike SP3b, plan proposal): the same 5 000 blocks laid out as 1 250 orders of two operations with two job orders each, with links on for 60 expanded orders, measured on the planner PC class. Its verdict decides the link limit and `ganttMaxOrders`. `e2e/board-perf.spec.ts` gains the Gantt scenario as a nightly regression check.

## Tests

Tests are written first ([ADR 0041](../adr/0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md)). Case ids `GT1` to `GT10` serve as requirement ids; every expected value is in `modules/planning/domain/fixtures/gantt/g1.expected.json`, generated with `g1.json` from one script, and a test that loads both files is the first failing test of each function. File paths are plan proposals.

### Domain unit tests (`modules/planning/domain`)

- `fixtures/gantt/g1.test.ts`: `g1.json` parses into the snapshot shapes; the placements in `g1.expected.json` equal `addWork` over the A1 calendar for every row (a regression guard for the fixture itself).
- `float.test.ts`: GT1 and GT2 values for earliest start, wait, latest start, latest end, total float, free float and the binding constraint of all four rows; a row past its latest start has negative total float; a started row's earliest start is its actual start; permutation invariance of the input arrays; `TZ=UTC`, `Europe/Stockholm` and `Pacific/Chatham` give identical results.
- `critical-chain.test.ts`: GT1 chain (release, then free root); GT2 chain (release, machine naming `1001.10`, free root in another order) with both `1003` rows critical; a chain that reaches a hard-locked row stops with root `hardLock`; a chain that reaches the fence stops with root `frozenWindow`; a chain longer than 20 rows ends with "chain continues".
- `cascade.test.ts`: GT3 with cascade on (two moves, `1003.20` Wed 13:30 to Thu 07:00) and off (one move, `LEAD_TIME` on both rows); GT4 (last-piece bound places `1004.20` at Thu 10:20:20); a successor that is hard-locked stops the cascade and is reported; a successor whose release moved earlier does not move; a drop before the release snaps to the release with cascade on.
- `plan-this-order.test.ts`: `plan()` with every other loaded row fixed places `1001` at the GT1 latest placement; the browser snapshot builder and the server snapshot loader give deep-equal snapshots for G1; Move all later by 1 day of working time shifts both rows and keeps the rules.
- `workload.test.ts`: GT5 (every bucket of the three machines for the five production days, setup split); GT6 (overload 2 700 s and the `OVERLAP` pair); a bucket with no availability is "closed"; draft positions count and committed positions of moved rows do not; buckets by shift and by ISO week sum to the same totals as buckets by production day.
- `constraints-of.test.ts`: the constraint list of `1004.20` names release, last piece, allowed machines and calendar as holding; of a row dropped before its release names `LEAD_TIME` with the instant that clears it; of a row of a locked operation names `hardLock`; with `earliestStartEnabled` and an earliest start after the row's start names `EARLIEST_START`; with `plannerAnchors` on, a row anchored at Thu 06:00 is not placed earlier by `plan()` and the list names the anchor and the planner.
- `run.test.ts`: GT10 (the run of `1001` and `1005`: the placements, the saved retool, the run's deadline, the early flag, the overlap); the orders and their rows shuffled give the same result; the first order's rows stay, every later row lies on an allowed machine at or after its release, a row with a saved retool starts at or after the end of the row it follows; `splitRun` puts every moved row back and restores every saved retool.
- `domain-imports.test.ts`: unchanged, and the new files pass it.

### Time and calendar tests

- GT7 goes to `modules/core` `availability.test.ts` as CAL12: `1006.10` from Fri 13:00 ends Mon 07:00 with one closed segment; with the plant holiday Tue 07:00; with Saturday overtime Sat 07:00.
- `apps/web/src/modules/planning` `time-scale.test.ts` (the web code of a module lives in apps/web since [ADR 0070](../adr/0070-one-nestjs-backend-with-one-graphql-schema-and-one-static-web-app.md)) keeps TIME4 and TIME5; the order Gantt uses the same scale instance.

### Web tests (`apps/web`, planning module)

- `gantt-search.test.tsx`: `/$plant/planning/order-gantt?zoom=week&from=2026-11-02&order=<id>&chain=1` opens the Gantt with the order's chain highlighted; `zoom=37.5` opens at 37.5 px an hour, `zoom=week` at 16, `zoom=abc` at 16, `zoom=1000` at 240 and `zoom=26` in the Week band; `chain=1` without `order` is dropped with the status message; a link to the board page keeps `zoom`, `from` and `order`; `?view=gantt` on the board route stays on the board.
- `gantt-tree.test.tsx`: the G1 dataset renders 6 orders, 10 operations and 10 job order rows; a split operation shows two job order rows; an unplaced job order sits in the Not placed row and the operation row says "1 not placed"; collapsing an order hides its rows and keeps `aria-setsize`.
- `gantt-links.test.tsx`: links for expanded orders; the lead time as a dashed segment; a row before its release draws the conflict style and names it; above 200 links only the selected order's links are drawn and the toolbar says so.
- `cascade-preview.test.tsx`: dragging `1003.10` to Wed 09:00 shows one ghost span at Wed 13:30 and the tooltip "+1 row moves"; with cascade off no ghost.
- `workload-lane.test.tsx`: the lane's table equals GT5; the lane is `aria-hidden`; the bar for Thu 5 Nov on CNC1 is full height; GT6 draws the overload above the top edge.
- `board-drag-feedback.test.tsx`: dragging `1003.10` dims every machine row that is not CNC1 and the drop on Mill 1 is refused with the tooltip naming the machine; with `plannerAnchors` on, the drop records the anchor and the block shows the pin glyph.
- `draft-conflicts.test.tsx`: after GT3 with cascade off the My draft tab lists one `LEAD_TIME` line with the clearing instant Wed 13:30; Cascade from here removes it and adds the second draft row.
- `deadline-markers.test.tsx`: `1003` shows the late band from Wed 15:00 to Thu 06:15 and "late by 15 h 15 min"; `1001` shows the marker and no band.
- `gantt-run.test.tsx`: Shift+click selects `1001` and `1005`; Combine into a run opens the review step with the saved retool, the run's deadline and the early warning; Combine draws the run row above its orders with `1005.10` without a setup hatch; the My draft list shows the run as one change; Split run removes it.

### Integration tests (`apps/backend`, Testcontainers)

- `gantt-query.int.test.ts`: the row query returns G1 in deadline order with nested rows and no placements; the chunk query returns every job order whose span overlaps the chunk, `1006.10` in both ISO weeks it touches; a page holds at most 100 orders; with `ganttMaxOrders` set to 50, 51 orders fail with `planning.gantt.too_many_orders` and 50 pass, and the setting's default is 1 250; a viewer reads, a planner reads, a user of another plant gets no rows.
- `workload.int.test.ts`: `planningWorkload` for G1 by production day equals the browser's GT5 table; a calendar deviation changes the available seconds of its buckets only.
- `cascade-save.int.test.ts`: a cascade of two moves writes two draft changes under one soft lock; Save commits both or neither; the server's `validate()` finds no `LEAD_TIME` after GT3 with cascade on and one with cascade off.

### End-to-end and accessibility (Playwright)

- `e2e/planning/gantt-cascade.spec.ts`: drag `1003.10` on the Gantt; two rows show "changed in your draft"; Save; the committed spans equal GT3.
- `e2e/planning/gantt-chain.spec.ts`: Late only, open `1003`; the chain is highlighted with three rows and the panel text names `1001.10` as the lead; Escape hides it; the same link opens with `chain=1`.
- `e2e/planning/gantt-keyboard.spec.ts` and `e2e/a11y/gantt.axe.spec.ts` as [Gates](#gates).
- `e2e/board-perf.spec.ts`: the Gantt scenario, nightly.

## Work breakdown

The epic id is assigned by the planning session when the roadmap takes it in; the stories below are thin vertical slices in the roadmap's form ([13-delivery-and-github.md](13-delivery-and-github.md), [ADR 0049](../adr/0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md)). The domain functions come first, as in E03, because every screen slice needs them and they need no platform. Depends on E03 (the domain package), E06-S11 (availability), E07-S09 (the board range query and late facts) and E08-S01 to E08-S05 (the timeline core on the board).

| Story | Behaviour a planner or a test can see | Key tests |
|---|---|---|
| S01 domain: Compute float, wait and the critical chain | `floatOf` and `criticalChain` pass GT1 and GT2 | `float.test.ts`, `critical-chain.test.ts` |
| S02 domain: Cascade a move and plan one order | `cascade` passes GT3 and GT4; `plan()` for one order with fixed context passes GT1 latest | `cascade.test.ts`, `plan-this-order.test.ts` |
| S03 domain: Compute workload per bucket and the constraint list | GT5, GT6, the constraint list cases | `workload.test.ts`, `constraints-of.test.ts` |
| S04 planning: Draw the order Gantt tree with summary bars and blocks | the Gantt page shows the G1 tree in plant time with availability shading, the Not placed row and the tree columns | `gantt-tree.test.tsx`, `gantt-search.test.tsx`, `gantt-query.int.test.ts` |
| S05 planning: Show links, deadlines and the constraint list | links with lead time, the late band, the marker, the constraint list in the panel | `gantt-links.test.tsx`, `deadline-markers.test.tsx` |
| S06 planning: Move a job order on the Gantt by pointer and without dragging | drag in time, detail panel, Move dialog, move mode with machine steps | `gantt-keyboard.spec.ts` |
| S07 planning: Cascade after a move with a preview | GT3 end to end, cascade switch, snap to release | `cascade-preview.test.tsx`, `cascade-save.int.test.ts`, `gantt-cascade.spec.ts` |
| S08 planning: Plan this order and Move all later by | preview, Apply writes draft changes, the forward fallback is named | `plan-this-order.test.ts` through the panel |
| S09 planning: Show float, wait and the critical chain in both views | Float column, hover values, the chain highlight, `chain=1`, the late-order explanation | `gantt-chain.spec.ts` |
| S10 planning: Show workload under machines and in the Gantt panel | the lane, the table popover, the group lane, `planningWorkload` | `workload-lane.test.tsx`, `workload.int.test.ts` |
| S11 core and planning: Calendar strip, hollow segments and both durations | the strip, hollow segments, working and elapsed durations, CAL12 | `availability.test.ts` CAL12 |
| S12 planning: Earliest start of an order | the column, the field behind the setting, the marker, `EARLIEST_START` in `validate()` and `plan()` | `constraints-of.test.ts`, `plan.test.ts` addition |
| S13 planning: Accessibility gates and the NVDA pass for the Gantt | the axe states, the keyboard spec, the pass | `gantt.axe.spec.ts` |
| D5 design: The order Gantt page | frames for the tree at 1440, 1280, 1920 and 320, links and conflict link, cascade preview, chain highlight, workload lane and table, deadline band, calendar strip, light and dark, keyboard and focus frames | approval in `docs/design/project/README.md` |

Order: S01 to S03 can start when E03 lands; D5 runs beside them; S04 waits for E08-S01 and E07-S09; S05 to S13 follow in the table's order, S12 only after the product owner's answer.

## Decisions this document needs

These become ADRs at status `proposed`, from `docs/adr/template.md`, before a task depends on them. Plan proposal for the list.

1. The order Gantt as a second view on the timeline core, and whether any of this document is release 1 scope under the scope rule of [ADR 0055](../adr/0055-release-1-scope-under-option-b-and-the-scope-rule.md). Recommendation: S01 to S03 (domain functions) and S10 (the workload lane) are release 1 candidates only if the ledger runs at or above the 1x line at M2; the order Gantt itself is the first item after release 1. Krister decides (`M-nn`).
2. Float, wait, binding constraint and the critical chain as domain functions, and the chain in the late facts of `plan()` (amends [ADR 0028](../adr/0028-autoplan-as-a-pure-deterministic-function.md)).
3. Cascade and plan this order in the browser, a list input for `moveJobOrderInDraft`, and the cascade switch (amends [ADR 0029](../adr/0029-per-planner-drafts-soft-locks-and-the-plan-revision.md)).
4. The earliest start of a production order, its effect in `plan()` and `validate()`, and its ERP mapping (amends [ADR 0027](../adr/0027-planned-duration-formula-and-override-precedence.md) and [ADR 0028](../adr/0028-autoplan-as-a-pure-deterministic-function.md); product owner question `PO-nn`).
5. Workload as a domain function and a query, and the bucket rules (new ADR, or an amendment to [ADR 0030](../adr/0030-a-planning-board-built-in-house.md)).
6. The new conflict kinds `EARLIEST_START` and `CLOSED_TIME` and the "machine not allowed" state (amends the conflict table of [07](07-production-planning.md#conflicts)).
7. The planner anchor: a hand move records a not-before bound that autoplan honors (amends [ADR 0028](../adr/0028-autoplan-as-a-pure-deterministic-function.md) and [ADR 0029](../adr/0029-per-planner-drafts-soft-locks-and-the-plan-revision.md); the alternative is to keep the hard lock as the only way to pin a row). Product owner question on whether planners want it.
8. The conflict navigator stays cut ([ADR 0030](../adr/0030-a-planning-board-built-in-house.md)); the per-row constraint list and the Save summary cover release 1. Reopening it is a separate decision.

## Open points

| Point | Who answers | Working default |
|---|---|---|
| Does the pilot need an earliest start on orders, and does the ERP send a start date for it? | product owner | the column exists, the field is hidden behind `earliestStartEnabled` = false |
| Do planners want a hand move to anchor a row against autoplan (the planner anchor), or is the hard lock enough? | product owner | off, behind `plannerAnchors` |
| Is cascade on by default acceptable to planners, or do they want to see breaks first? | product owner; working default confirmed by Krister 2026-10-17 | on by default, local switch |
| Should Save refuse a row before its release, or confirm with a reason as for overlaps (PO-43)? | product owner; working default confirmed by Krister 2026-10-17: Save never refuses a draft for a broken rule, the conflict stays visible so the planner can fix it later | confirm with a reason |
| Workload buckets at Hours and Day zoom: per shift, or per production day always? | product owner; working default confirmed by Krister 2026-10-17, with the bucket kinds kept as an extensible list | per shift |
| Are tools a contended resource the workload must show (two job orders using one tool at the same time)? | product owner | not in scope; a later item that adds a tool reservation check to `validate()` |
| The link limit and `ganttMaxOrders` | SP3b measurement | 200 links, 1 250 orders |
| The planner PC and browser for SP3b and the Gantt NVDA pass | pilot IT | as SP3 |
| Release placement of each story | Krister | as [Decisions this document needs](#decisions-this-document-needs), item 1 |
| The run questions of [Runs](#runs), PO-81 to PO-85: a started, held or hard-locked order in a run, the ERP, a hand-set run deadline, the saved retool's size, which operations a run takes; the rules of ADR 0083, M-94 | product owner; Krister | as the section's working defaults |

## Provenance

The fixture `g1.json` and its expected values `g1.expected.json` were generated by one calculator script on the A1 calendar (Monday to Friday 06:00 to 15:00 with breaks 08:30 to 08:45 and 11:00 to 11:30, `Europe/Stockholm`, no clock change in the range). The script was checked against the cases of [07-production-planning.md](07-production-planning.md) first: TC1 (146 700 s, ending Fri 2026-11-06 14:30), TC4, TC6, TC9b and TC10 come out as that document states them. The script is not part of the repository; once the domain package has `addWork`, the fixture test regenerates every placement from it and fails if the files drift.

This document was written from the repository (the plan documents, the ADRs, the glossary and the approved board design record) and from public documentation of commercial Gantt products, read for behavior only. No package, type declaration, repository or source file of a third-party Gantt component was opened while writing it, it names no such product and no option, class, action or style name of one, and it contains no text copied from one. The constraint words in the mapping table are the common vocabulary of project planning tools. The team that builds from this document keeps to the same rule: it does not open third-party Gantt source, and a question that neither this document nor the repository answers goes into the pull request as an open question.

## Related documents

- [07-production-planning.md](07-production-planning.md): the planning domain, the board and its accessibility, the tests this document extends.
- [06-web-and-ux.md](06-web-and-ux.md): tokens, state cues, the accessibility rules and the presentation settings.
- [14-roadmap.md](14-roadmap.md): E03, E06, E07 and E08, which this document's stories depend on.
- [16-open-questions.md](16-open-questions.md): where the open points above get their ids.
- `docs/design/planning/planning-221-board.md`: the approved board design D3, whose presets, densities and frames the order Gantt reuses.
- `modules/planning/domain/fixtures/gantt/g1.json` and `g1.expected.json`: the fixture and its expected values.
