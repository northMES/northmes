---
status: "proposed"
date: 2026-10-30
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: Krister Johansson (the zoom ladder with Ctrl+wheel and Zoom to fit on both views, the endless axis, loading by time chunk, the greyed past, the timeline built in house, 2026-10-29; the answers to M-100 to M-104, 2026-10-30); the trial of the order Gantt on 2026-10-29 (findings F6, #883, and F8, #882); public documentation of DHTMLX Gantt, DayPilot Scheduler, Bryntum Scheduler and Gantt, and Syncfusion Gantt
informed: contributors and coding agents
release: "1"
needs-confirmation: ""
---

# Zoom levels and an endless time axis that loads by time chunk, on the planning board and the order Gantt

## Context and problem statement

[ADR 0030](0030-a-planning-board-built-in-house.md) gives the planning board and the order Gantt a linear axis with four zoom presets (Hours, Day, Week, 4 weeks), and [plan 18](../plan/18-gantt-timeline.md#data-loading) grows the loaded range by one preset span when the planner scrolls near an edge (#685). The trial of 2026-10-29 found the order Gantt hard to trust. After sideways scrolling, the axis drifted from the toolbar's week, day labels stacked on each other inside collapsed closed time, and the rows looked empty (F6, #883). On main e8f15015, six scrolls to the right edge at Week zoom grew the range from one week to seven, while the toolbar still said W45. The tree cells also scrolled out of view, because each row box is as wide as the grid's client width (1126 px) while its tracks add up to 5707 px, and a sticky cell cannot leave its row box.

Krister Johansson decided on 2026-10-29 that the timeline zooms through a ladder of levels with Ctrl+wheel and zoom to fit, the way Bryntum's timeline does, on both views. The axis scrolls without end so a planner can look far ahead, job orders load only for the time in view, and time before now is greyed and cannot take a move. He also confirmed that the timeline stays built in house, as ADR 0030 decides.

This ADR covers the timeline core in `apps/web/src/modules/planning/timeline/`, the board and Gantt screens, the shared range controls, the URL keys `zoom` and `from`, the `GanttDataSource` seam, and the planned `planningGantt` query. It replaces ADR 0030's four presets and plan 18's range growth. It does not change ADR 0030's cuts of resize and of undo beyond discarding the draft.

## Decision drivers

* A planner looks from the next hours to the next months on one screen, without choosing a range first.
* The axis, the header and the toolbar's range text never disagree, however often and in whichever direction the planner scrolls.
* Every header label is readable: no label overlaps another, and none is drawn inside or under a collapsed gap.
* Only what is in view is drawn and loaded, so the far future costs nothing until the planner goes there.
* Rows stay where they are while the planner scrolls sideways.
* Work that has happened cannot be moved, and work that should have started stays visible.
* Both views share one time scale ([18](../plan/18-gantt-timeline.md#shared-pieces)), and the frame budgets of SP3 still hold ([ADR 0030](0030-a-planning-board-built-in-house.md)).
* Every pointer gesture has a keyboard path ([ADR 0021](0021-accessibility-target-wcag-2-2-aa.md)), and the view state lives in the URL ([ADR 0062](0062-web-form-contracts-url-view-state-and-module-link-manifests.md)).

## Considered options

* A ladder of zoom levels, an endless axis over a fixed buffer, and loading by time chunk
* The four presets with the range growth fixed
* Free zoom to any pixels per hour, with header tiers chosen from the density
* A ladder of zoom levels over a range that keeps growing at its edges

## Decision outcome

Chosen option: "A ladder of zoom levels, an endless axis over a fixed buffer, and loading by time chunk", because it gives the planner the zoom Krister asked for, its buffer cannot run away, and its chunks keep loading bounded at every level.

### Zoom levels

* A zoom level is the timeline's unit of zoom. It sets the top and bottom header tiers (unit, count, a long and a short label format), the natural width in pixels per hour, the snap step and the workload bucket. The levels form one ordered list, the ladder, in the timeline core.
* The working default ladder keeps D3's four presets as levels, under the ids the code uses (`hours`, `day`, `week`, `4weeks`), so existing links still open:

  | Level id | Top tier | Bottom tier | Snap step | Workload bucket |
  |---|---|---|---|---|
  | `quarter-hours` | hour | 15 min | 5 min | shift |
  | `hours` | day | 1 h | 15 min | shift |
  | `day` | day | 3 h | 1 h | shift |
  | `week` | day | 6 h | 4 h | production day |
  | `4weeks` | ISO week | day | 1 day | ISO week |
  | `quarter` | month | ISO week | 1 day | ISO week |
  | `year` | year | month | 1 day | month |

  The design round sets the natural widths and may change the list. A new bucket kind (month) joins the extensible list of plan 18.
* Ctrl+wheel or Cmd+wheel over the time area, and a trackpad pinch where the browser reports it as a Ctrl+wheel event, steps one level per gesture. The instant under the pointer stays at the same x. The page does not zoom while the pointer is over the time area. A plain wheel scrolls as before.
* The toolbar has Zoom out, Zoom in, a menu of the levels, and Zoom to fit. Each zooms around the centre of the view. With focus inside the grid, the minus and plus keys step a level too; the browser's own zoom keys stay untouched.
* Zoom to fit picks the finest level whose natural width fits a span, with one snap step of that level on each side, into the time area, and centres that span. The span is the selected order or run, which replaces "Zoom to order" and "Zoom to run". With nothing selected, it is every loaded row on the Gantt and every loaded job order on the board. When no level fits, it picks the coarsest level and centres the span's start.
* Rules that plan 18 ties to "Hours and Day zoom" (the deadline's time label, the wait and free float lines, buckets per shift) apply at `day` and every finer level. Rules it ties to "Week and 4 weeks zoom" (the shift strip's working days, the 2 px rule for hollow segments) apply at `week` and every coarser level.
* The URL key `zoom` holds the level id.
* The job order table view keeps the four presets as its Range. A link from the board or the Gantt at another level opens the table at the nearest preset: `quarter-hours` at `hours`, and `quarter` and `year` at `4weeks` (Krister, 2026-10-30).

### Header tiers

* Each tier uses its long label format where the label fits its cell, then the short format, and draws no label where neither fits.
* With Hide closed time on, each tier's cells are clipped to the open segments of the axis. A label starts at its cell's first open segment, a cell wholly inside a gap has no label, and gaps are drawn behind the labels. DHTMLX hides non-working cells "for all the scales" in the same way, so no tier keeps a label inside hidden time.
* A gap narrower than one pixel at the current level is not drawn, and a closed window is compressed only where its natural width is wider than the gap, so Hide closed time never widens the axis at a coarse level.

### The endless axis

* The axis has no start or end. The view draws a buffer of three viewport widths of drawn axis (pixels at the current level, gaps included), centred on the view, and culls ticks, blocks, links and shading to it.
* When the view comes within a quarter of a viewport width of a buffer edge, the buffer moves by one viewport width in that direction, and `scrollLeft` is corrected by the moved pixels in the same frame. The buffer is at least the viewport plus both trigger margins plus one move (three widths against two and a half), so one move cannot trigger another. This is the pattern of DayPilot's infinite scrolling, which rejects settings where the timeline is not wider than the viewport plus both edge margins.
* A change of level, Now, Go to date, Earlier and Later rebuild the buffer around their anchor instant. Earlier and Later scroll by one viewport width. A resize of the time area rebuilds the buffer around the visible start, and a hidden time area (width 0) keeps no buffer until it shows.
* The toolbar's range text names the visible span and follows the scroll. `from` in the URL is the visible start as a plant-local date-time (`2026-11-03T13:20`), written with replace when scrolling stops, so a reload or a shared link opens the same view. A plain date still opens at the start of that day.

### Loading by time chunk

* Job orders load per time chunk: a fixed span of plant time, aligned to plant dates (midnight, ISO weeks from Monday, calendar months and quarters), whose length follows the level (working default: one ISO week up to `week`, one month at `4weeks` and `quarter`, one quarter at `year`). A chunk holds every job order whose span from setup start to end overlaps the chunk's half-open span, and a job order in two chunks is merged by id. Chunks do not move with the scroll, so a cached chunk stays valid within its chunk length; a level change that changes the chunk length loads the buffer's chunks again.
* The view loads the chunks the buffer touches, the chunks in view first, and the next chunk on each side ahead of time. It drops chunks more than two buffer widths away, except a chunk that holds the focused job order or a job order of the selected order. A chunk that is still loading shows a loading band in its rows' time cells, with a polite status message. A chunk that fails to load shows an error band with Try again in its rows' time cells and a status message, so a failed load never looks like empty rows. A workload bucket that touches a chunk not yet loaded shows as loading, never as a partial sum.
* The order Gantt loads its rows apart from its blocks. The row list holds each production order with its operations, its job orders without their placements (id, number, machine, status, quantity), its span (first setup start to last end), its deadline and its status. Its default set is every order that is neither finished nor cancelled, which includes every late order. Finished orders join through the "Include finished" filter, for the chunks loaded. So with the default set rows never appear or move while the planner scrolls, and an order far in the future already shows its summary span before its job orders load.
* A job order without a placement has no time, so no chunk holds it: on the Gantt it comes with the row list, and on the board the Not placed row loads apart from the chunks.
* The board's rows are machines, so only its blocks load per chunk. The board's range limit (`planning.board.range_too_large`) applies per time chunk. A refused chunk shows a band in its rows' time cells that says to narrow the filter or zoom in, with a polite status message (Krister, 2026-10-30).
* The row list pages through its Relay connection (pages of at most 100, [ADR 0016](0016-graphql-list-conventions-connections-relations-filter-sort-search-and-group-by.md)) into the virtualized rows, as ADR 0030 decides for rows: the view reserves `totalCount` rows and loads the pages the virtualizer's window touches, one page ahead. A row carries no placements, so the pilot's 500 orders are five small pages (Krister, 2026-10-30).
* `ganttMaxOrders` stays as a guard against a filter that matches far more orders than a planner reads, at a working default of 1 250: the largest row model spike SP3b measures (1 250 orders, 5 000 blocks) and two and a half times the pilot's 500 orders. A row list above it fails with `planning.gantt.too_many_orders`.
* The `GanttDataSource` seam gets `loadRows(filter)` and `loadChunk(from, to, filter)` in place of one `load` per range, and the mock source answers both from fixture G1. On the server, the planned `planningGantt` query splits into a row query (a Relay connection, [ADR 0016](0016-graphql-list-conventions-connections-relations-filter-sort-search-and-group-by.md)) and a chunk query that returns job orders of the same GraphQL type as the board's.
* Computations that need rows outside the loaded chunks fetch them by order id, as plan 18 says. Realtime refetches changed ids that fall in loaded chunks, refetches the chunks in view when the changed ids are null ([ADR 0018](0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md)), and refetches the row list when a production order is created, finished or cancelled.

### Time before now

* The time area before the now line has a flat past tone, drawn behind blocks and shading. The frozen window band stays from now to the fence.
* A move whose setup start would fall before now is refused with the refusal code `PAST`, next to `STARTED`, in the drag preview, in keyboard move mode and in the Move dialog. A drop before now lands on the first snap step at or after now, then snaps forward to working time as every drop does. Started and finished job orders stay fixed, as today.
* `PAST` refuses the move itself and does not join `judgeMove`. At Save, a setup start that passed while the move waited in the draft shows as a `PAST` conflict, which the planner confirms with a reason, because Save never refuses a draft for a broken rule (Krister, 2026-10-17, in [plan 18](../plan/18-gantt-timeline.md#open-points); Krister, 2026-10-30).
* Finished job orders are drawn muted, with a finished cue besides colour and "finished" in their accessible name, as every block state has ([07](../plan/07-production-planning.md#block-states)). An overdue job order (planned, with its planned start passed) keeps its own state cue and is never muted, because it is the work the planner most needs to see. It may move to now or later.

### Consequences

* Good, because the axis cannot run away: the buffer has a fixed size, and one edge crossing moves it once.
* Good, because the far future costs one row list and nothing more until the planner scrolls there.
* Good, because rows stand still while the planner scrolls, which also keeps virtualizer offsets and link positions stable.
* Good, because the four preset ids stay valid levels, so links, tests and the board keep working while the ladder grows.
* Bad, because the coarse levels (`quarter`, `year`) put many job orders into a few pixels, which needs the culling and virtualization of ADR 0030 before they ship, and may need the coarse levels to draw summary spans only.
* Bad, because a split row query and chunk query are two server queries where plan 18 has one.
* Bad, because the D3 board design and the D5 Gantt frames show four preset buttons, so the toolbar needs a design round.
* Neutral, because the row list has no time bound: at pilot scale (500 orders, [07](../plan/07-production-planning.md)) it pages through its connection, and `ganttMaxOrders` (1 250) is only a guard, where the time range kept the old set small.

### Confirmation

* `time-scale.test.ts`: stepping a level with an anchor x keeps the anchor instant within 1 px of that x, at every pair of adjacent levels, across the DST days 2026-10-25 and 2027-03-28.
* `timeline/time-buffer.test.ts`, a fast-check property over random scroll sequences in both directions: the buffer moves at most once per edge crossing, the buffer stays at least the viewport plus both margins plus one move, and the range text equals the span the test computes from the scroll position and the level's width per hour.
* `e2e/planning/gantt-scroller.spec.ts` scrolls repeatedly to both edges at every level. The Name cell's left edge stays at the grid's left edge, the toolbar's range text matches the header, and no two labels of a tier overlap or sit inside a gap (bounding boxes).
* `gantt-chunks.test.tsx`, with a counting mock source: scrolling across four chunks loads each chunk once, scrolling back within two buffer widths loads nothing, and a chunk whose load fails shows the error band with Try again.
* `gantt-move.test.ts`: a drag or a keyboard step to before now is refused with `PAST`, and an overdue row dropped on the now line at `week` with now at 09:40 lands at 12:00.
* `gantt-search.test.tsx`: `zoom=week` and `hours`, `day` and `4weeks` open their levels, and an unknown id falls back to `week`.

## Pros and cons of the options

### A ladder of zoom levels, an endless axis over a fixed buffer, and loading by time chunk

* Good, because zoom levels with their own header tiers are how Bryntum and Syncfusion zoom: Bryntum steps one level of its zoom levels per zoom in or out (a 2019 forum answer), and a Syncfusion level is a top tier, a bottom tier and a cell width, with Zoom in, Zoom out and Zoom to fit.
* Good, because a fixed buffer bounds the DOM and the scale at every scroll position.
* Bad, because the pointer anchor and the buffer correction need care at each level change. A Bryntum forum answer reports that its wheel zoom did not keep the pointer's date out of the box, so this part is NorthMES's own work.

### The four presets with the range growth fixed

* Good, because it is the smallest change and keeps D3 as approved.
* Bad, because it does not give the zoom Krister asked for, and a growing range still grows the DOM and the scale with every extension.

### Free zoom to any pixels per hour

* Good, because it feels smooth.
* Bad, because snap steps, workload buckets and the zoom-dependent rules of plan 18 need fixed steps, which free zoom would rebuild as thresholds anyway.
* Bad, because ADR 0030 cut continuous zoom for its cost, and nothing here lowers that cost.

### A ladder over a range that keeps growing

* Good, because it reuses the range growth of #702.
* Bad, because the growth is what runs away in F6, and each extension reloads and re-analyses the whole range.

## More information

* Related ADRs: [0016](0016-graphql-list-conventions-connections-relations-filter-sort-search-and-group-by.md) list conventions, [0021](0021-accessibility-target-wcag-2-2-aa.md) accessibility, [0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md) time, [0030](0030-a-planning-board-built-in-house.md) the board built in house, [0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md) the scope rule, [0062](0062-web-form-contracts-url-view-state-and-module-link-manifests.md) URL view state.
* Plan: [18-gantt-timeline.md](../plan/18-gantt-timeline.md), sections "Timeline core", "Data loading" and "URL state"; [07-production-planning.md](../plan/07-production-planning.md), sections "Planning board in release 1" and "Data loading", which this ADR amends for the board; the approved board design D3 in `docs/design/planning/planning-221-board.md`.
* Krister answered open questions M-100 to M-104 in [16-open-questions.md](../plan/16-open-questions.md) on 2026-10-30, and this ADR holds the answers.
* Sources, read 2026-10-29: DHTMLX Gantt [skip_off_time](https://docs.dhtmlx.com/gantt/api/config/skip_off_time/) and [custom scale](https://docs.dhtmlx.com/gantt/guides/custom-scale/); DayPilot Scheduler [infinite scrolling](https://doc.daypilot.org/scheduler/infinite-scrolling); Bryntum forum threads on [zoom levels](https://forum.bryntum.com/viewtopic.php?p=63353) and [wheel zoom](https://forum.bryntum.com/viewtopic.php?p=81634); Syncfusion Blazor Gantt [zooming](https://help.syncfusion.com/gantt-sdk/blazor/gantt-chart/zooming).
* Revisit when the coarse levels are measured against the SP3 budgets, and when the design round sets the toolbar.
