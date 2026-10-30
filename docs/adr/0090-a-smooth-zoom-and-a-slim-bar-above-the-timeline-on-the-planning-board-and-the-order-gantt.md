---
status: "proposed"
date: 2026-10-30
decision-makers: Krister Johansson
consulted: Krister Johansson (a smooth zoom, the level menu removed, Go to now and an order filter above the timeline, one View menu, the zoom buttons over the time area, both views, 2026-10-30, after trying the zoom of #896 on main)
informed: contributors and coding agents
release: "1"
needs-confirmation: ""
---

# A smooth zoom and a slim bar above the timeline, on the planning board and the order Gantt

## Context and problem statement

[ADR 0089](0089-zoom-levels-and-an-endless-time-axis-that-loads-by-time-chunk-on-the-planning-board-and-the-order-gantt.md) gives the planning board and the order Gantt a ladder of seven zoom levels. Ctrl+wheel, a pinch, the toolbar and the minus and plus keys step one level at a time, and the toolbar holds Zoom out, Zoom in, a menu of the levels, Zoom to fit, Earlier, Now, Later, Go to date and the visible span as text, followed by Hide closed time, My draft, Columns and Board options. Krister Johansson tried it on main on 2026-10-30 (#896). The zoom jumps from Day to Week instead of following the hand, and the controls above the timeline take room from the chart.

He decided the same day that the zoom is smooth on both views, that the level menu goes, and that the bar above the timeline holds only Go to now and an order filter, with the other tools in one View menu and the zoom buttons over the time area.

ADR 0089 rejected "Free zoom to any pixels per hour" because snap steps, workload buckets and plan 18's zoom rules need fixed steps, and because [ADR 0030](0030-a-planning-board-built-in-house.md) cut continuous zoom for its cost. This ADR answers both reasons. It covers the timeline core in `apps/web/src/modules/planning/timeline/`, the board and Gantt screens, the shared range controls, and the URL keys `zoom` and `q`. The endless axis, loading by time chunk and the greyed past of ADR 0089 stay as decided.

## Decision drivers

* The zoom follows the gesture: a small pinch gives a small change, and the instant under the pointer stays under it.
* Snap steps, workload buckets, chunk lengths and plan 18's zoom rules keep fixed values, so the move model, the workload lanes and the chunk cache do not change.
* The chart gets the room: one row of controls above it, nothing that a planner uses only now and then.
* Every gesture keeps a single-pointer and a keyboard path ([ADR 0021](0021-accessibility-target-wcag-2-2-aa.md)), and the view state stays in the URL ([ADR 0062](0062-web-form-contracts-url-view-state-and-module-link-manifests.md)).
* The frame budgets of SP3 hold during a zoom gesture ([ADR 0030](0030-a-planning-board-built-in-house.md)).
* Both views share one time scale and one set of controls ([18](../plan/18-gantt-timeline.md#shared-pieces)).

## Considered options

* A continuous zoom over the ladder's levels as bands, laid out once per frame
* The ladder kept, with an animated step between levels
* A transform of the drawn layer during the gesture, landing on the nearest level at its end

## Decision outcome

Chosen option: "A continuous zoom over the ladder's levels as bands, laid out once per frame", because it is the only option whose zoom follows the gesture to any width, and the bands keep every fixed step that ADR 0089 needed the ladder for.

### Zoom as a width per hour

* The zoom is a number, the width of one hour in pixels, from the `year` level's natural width (0.15 px per hour) to the `quarter-hours` level's (240 px per hour). A value outside that range is clamped to it.
* The seven levels of ADR 0089 stay, as bands of that number. A level's band reaches from the geometric mean of its natural width and the next coarser level's to the geometric mean of its natural width and the next finer level's, so `day` (48 px per hour) covers about 27.7 to 69.3 px per hour. The coarsest and finest bands end at the clamp.
* The band sets everything a level set in ADR 0089: the header tiers with their long and short label formats, the snap step, the workload bucket, the time chunk's length, and plan 18's rules for "Hours and Day zoom" and "Week and 4 weeks zoom". The zoom number sets only the scale's width per hour. So a block snaps, a bucket sums and a chunk loads the same at 40 and at 60 px per hour.
* The band changes once the zoom has passed a band edge by a tenth (a factor of 1.1), and changes back only once it has passed the edge by a tenth the other way. A gesture that hovers at an edge does not swap tiers or snap steps back and forth.
* A band change that changes the chunk length takes effect when the gesture ends, so a gesture across a chunk boundary loads the buffer's chunks once.

### Gestures, buttons and keys

* Ctrl+wheel and Cmd+wheel over the time area or the workload panel multiply the zoom by `exp(-deltaY × 0.002)`, with `deltaY` in pixels (a line-mode delta counts as 16 px and a page-mode delta as the time area's height). A trackpad pinch that the browser reports as Ctrl+wheel follows the same rule, and a Safari gesture event or a two-finger touch pinch multiplies the zoom by the change in its scale. The instant under the pointer, or under the pinch's centre, stays at the same x. The page does not zoom while the pointer is over the time area or the workload panel, and a plain wheel scrolls as before.
* Wheel and pinch events are coalesced to one change of the zoom per animation frame. A gesture ends 150 ms after its last event. Chunk loads, the URL write and announcements wait for the end.
* Zoom out and Zoom in multiply or divide the zoom by 2 around the centre of the view, over 150 ms with an ease-out curve. With `prefers-reduced-motion: reduce`, the change is immediate. With focus inside the grid, the minus and plus keys do the same, and the browser's own zoom keys stay untouched.
* Zoom to fit sets the zoom whose width fits the span, with one snap step of the band it lands in on each side, into the time area, and centres the span. The span is the same as in ADR 0089: the selected order or run, else every loaded row on the Gantt and every loaded job order on the board. When the span does not fit at the coarsest width, the zoom is the clamp and the span's start is centred.
* Zoom out, Zoom in and Zoom to fit are small icon buttons over the lower right corner of the time area, above the workload panel when it shows. They are the single-pointer path for the pinch and the wheel, keep their accessible names and their `aria-disabled` ends at the clamp, and keep focus where the planner pressed them. The menu of levels goes.

### Laying out a zoom

* During a gesture, each frame lays the buffer of ADR 0089 out again at the new width: ticks, blocks, links and shading are culled to the buffer as before, and the buffer is rebuilt around the anchor instant, as a level change rebuilds it in ADR 0089.
* A gesture keeps the SP3 drag budget: p95 frame time at most 33 ms and no long task over 50 ms, measured with a Ctrl+wheel gesture across the `hours` to `4weeks` bands at G1 on both views. If the measurement fails, the gesture instead transforms the drawn time layers horizontally around the anchor, hides the header labels until it ends, and lays out once at its end. The bands, the URL and the controls stay as this ADR decides.

### The bar above the timeline

* The page title and the bar share one row. The bar holds Go to now, the order filter, My draft while the planner's draft has changes, and one View menu, an icon button at the right end.
* The View menu holds Columns (on the Gantt), Hide closed time, Workload, Cascade, the shift strip, and the board's own options. Each choice keeps where it is stored today.
* Earlier, Later, Go to date and the visible span as text leave the bar. With focus inside the grid, Alt+Page Up and Alt+Page Down scroll the time area one viewport width earlier and later, as spreadsheets scroll one screen sideways, so the keyboard keeps the path Earlier and Later gave. The time scroller's visible scrollbar, the plain wheel and Shift+wheel remain the pointer paths that move in time without dragging, and the header's top tier names the dates in view. `from` stays in the URL, so a link still opens at any date.
* The fixture note and "Links shown for the selected order" show only while they have text, so no empty line sits between the bar and the grid.
* The job order table view keeps its Range presets, Earlier, Now, Later and Go to date, because it has no time area to zoom.

### The order filter

* The filter is a search field named "Filter orders" in the bar. It searches the production order number as ADR 0016's list search does, as the planner types, with a 250 ms debounce. Escape or its clear button empties it.
* On the order Gantt only the matching production orders show, with their operations and job orders, and the time area scrolls to the first match's span. On the planning board the machine rows stay, and only the matching orders' job orders show, in the Not placed row too.
* With no match, the grid shows an empty state that names the filter and offers Clear filter. Clearing it brings every order back and keeps the scroll position.
* The filter's URL key is `q`, the search key ADR 0062 reserves, written with replace. The Gantt passes it as `GanttFilter.search` to `loadRows(filter, page)` and `loadChunk(from, to, filter)`, and the board passes it to its chunk query. A server query without a search argument gets one through its Zod contract ([ADR 0017](0017-zod-contracts-as-the-single-source-for-inputs.md)), and the value reaches SQL only as a bound value.

### The URL key zoom

* `zoom` holds the zoom as a plain decimal with three significant digits (`zoom=37.5`, `zoom=0.15`), written with replace when a gesture ends. Its default is the `week` level's natural width, 16, which is stripped from the URL.
* A level id of ADR 0089 (`hours`, `day`, `week`, `4weeks`, `quarter-hours`, `quarter`, `year`) still opens, at that level's natural width, so existing links keep working. A value that is neither a number nor a level id falls back to 16 on its own, as ADR 0062 says.
* A link to the job order table view opens it at the preset of the zoom's band: `quarter-hours` and finer at `hours`, and `quarter` and `year` at `4weeks`, as ADR 0089 maps the levels.

### Parts of accepted ADRs this decision changes

The files below keep their text. This ADR holds over the parts listed here, and the rest of each ADR stands.

#### Changes to ADR 0089

[ADR 0089](0089-zoom-levels-and-an-endless-time-axis-that-loads-by-time-chunk-on-the-planning-board-and-the-order-gantt.md), zoom levels and the endless axis:

| Section | Before | After |
|---|---|---|
| Zoom levels | "A zoom level is the timeline's unit of zoom" and Ctrl+wheel "steps one level per gesture" | The zoom is a width per hour, and each level is a band of it ([Zoom as a width per hour](#zoom-as-a-width-per-hour)); gestures zoom continuously ([Gestures, buttons and keys](#gestures-buttons-and-keys)) |
| Zoom levels | "The toolbar has Zoom out, Zoom in, a menu of the levels, and Zoom to fit" | Zoom out, Zoom in and Zoom to fit are icon buttons over the time area, and the menu of levels goes |
| Zoom levels | Zoom to fit "picks the finest level whose natural width fits a span" | Zoom to fit sets the width that fits the span |
| Zoom levels | "The URL key `zoom` holds the level id" | `zoom` holds the width per hour, and a level id still opens ([The URL key zoom](#the-url-key-zoom)) |
| The endless axis | "Earlier and Later scroll by one viewport width" and "The toolbar's range text names the visible span and follows the scroll" | Earlier, Later, Go to date and the range text leave the board and the Gantt ([The bar above the timeline](#the-bar-above-the-timeline)); `from` stays |
| Loading by time chunk | The chunk length "follows the level" | The chunk length follows the band, and changes when the gesture ends |

#### Changes to ADR 0030

[ADR 0030](0030-a-planning-board-built-in-house.md), the board built in house:

| Section | Before | After |
|---|---|---|
| Decision outcome ("Cut from release 1") | "continuous zoom" is cut | Continuous zoom is in release 1 as this ADR decides; the rest of the cut list stands |

#### Changes to ADR 0055

[ADR 0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md), release 1 scope. Under the scope rule, "An item enters release 1 only by the maintainer's decision, recorded in this ADR's ledger table". Krister Johansson decided on 2026-10-30 that the smooth zoom is in release 1.

| Section | Before | After |
|---|---|---|
| Decision outcome (ledger additions) | The table of additions, with ADR 0089's row | The table also holds the row below. No source gives a figure for it, so it is not estimated until its stories exist |

| Addition | Estimate (raw days) |
|---|---|
| ADR 0090: the smooth zoom on the planning board and the order Gantt | not estimated |

### Consequences

* Good, because the zoom follows the gesture, and Zoom to fit fits a span exactly instead of to the nearest level.
* Good, because snap steps, buckets and chunks keep the ladder's fixed values, so the move model, the workload lanes and the chunk cache stay as built.
* Good, because the chart gains the height of a toolbar row and the controls a planner uses rarely move into one menu.
* Bad, because every frame of a gesture lays out the buffer, which costs more than one layout per level step; the SP3 measurement and its fallback exist for that.
* Bad, because a link's `zoom` is now a number, and a link from before this ADR opens at a level's natural width, which is still a valid zoom.
* Bad, because Earlier, Later and Go to date leave the board and the Gantt, so a planner who used them scrolls, uses Alt+Page Up and Alt+Page Down, or uses a link instead.
* Neutral, because the job order table view keeps its presets and its range controls.

### Confirmation

* `timeline/time-scale.test.ts`: the band of each level's natural width is that level; a fast-check property over zoom sequences that stay within a factor of 1.09 of a band edge never changes the band; a zoom past an edge by a factor of 1.1 does.
* `timeline/zoom-view.test.ts`: a Ctrl+wheel `deltaY` of -100 in pixel mode multiplies the zoom by `exp(0.2)`; through a gesture of small deltas the pointer's instant stays within 1 px of its x, across the DST days 2026-10-25 and 2027-03-28; Zoom to fit returns a width that fits the padded span within 1 px.
* `gantt-chunks.test.tsx`, with a counting mock source: a gesture from the `week` band to the `4weeks` band loads the buffer's month chunks once, after the gesture ends, and none during it.
* `gantt-search.test.tsx` and `board-search.test.tsx`: `zoom=37.5` opens at 37.5 px per hour, `zoom=week` at 16, `zoom=day` at 48, `zoom=abc` at 16, and `zoom=1000` at 240; `q=1003` opens filtered.
* `job-orders-search.test.tsx`: `zoom=37.5` opens the job order table at `day`, `zoom=200` at `hours` and `zoom=0.5` at `4weeks`.
* `e2e/planning/gantt-zoom.spec.ts` and `e2e/planning/board-zoom.spec.ts`: Ctrl+wheel in small steps changes the zoom without a jump, the overlay buttons zoom by a factor of 2, Alt+Page Down scrolls one viewport width later, the filter shows only the matching order and Clear filter brings the rest back, and `checkA11y` passes with the View menu open, with My draft shown, with a filter and with no match.
* The SP3 bench records a Ctrl+wheel gesture at G1 on both views against p95 frame time at most 33 ms and no long task over 50 ms.

## Pros and cons of the options

### A continuous zoom over the ladder's levels as bands, laid out once per frame

* Good, because the zoom follows the gesture and the instant under the pointer stays put.
* Good, because the bands keep the fixed values that the move model, the buckets and the chunks need.
* Bad, because a layout per frame needs measuring against the SP3 budget, and may need the transform fallback.

### The ladder kept, with an animated step between levels

* Good, because it changes little: the levels, the URL and the chunks stay as built.
* Bad, because a pinch still jumps a whole level, which is what Krister found jarring, and a short gesture cannot stop between two levels.

### A transform during the gesture, landing on the nearest level

* Good, because a transform costs almost nothing per frame.
* Bad, because the view jumps again at the end of the gesture, to the nearest level, and text and block borders stretch while it lasts.

## More information

* Related ADRs: [0016](0016-graphql-list-conventions-connections-relations-filter-sort-search-and-group-by.md) list search, [0021](0021-accessibility-target-wcag-2-2-aa.md) accessibility, [0030](0030-a-planning-board-built-in-house.md) the board built in house, [0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md) the scope rule, [0062](0062-web-form-contracts-url-view-state-and-module-link-manifests.md) URL view state, [0089](0089-zoom-levels-and-an-endless-time-axis-that-loads-by-time-chunk-on-the-planning-board-and-the-order-gantt.md) zoom levels and the endless axis.
* Plan: [18-gantt-timeline.md](../plan/18-gantt-timeline.md), sections "Timeline core" and "URL state"; [07-production-planning.md](../plan/07-production-planning.md), sections "Planning board in release 1" and "Board accessibility".
* Issues: #938 (this ADR), #939 (the slim bar and the zoom buttons over the time area), #940 (the order filter), #941 (the smooth zoom), in epic #903. This ADR decides the toolbar part of design task #893.
* Revisit at the SP3 measurement of a zoom gesture, and if planners miss Earlier, Later or Go to date.
