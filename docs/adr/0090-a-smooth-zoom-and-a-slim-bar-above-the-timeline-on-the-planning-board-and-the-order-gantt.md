---
status: "proposed"
date: 2026-10-30
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: Krister Johansson (a smooth zoom, the level menu removed, Go to now and an order filter that shows only the matching orders above the timeline, one View menu, the zoom buttons over the time area, both views, 2026-10-30, after trying the zoom of #896 on main)
informed: contributors and coding agents
release: "1"
needs-confirmation: "maintainer (the smooth zoom in release 1, recorded in the ledger of ADR 0055; the band edges and the hysteresis factor 1.1; the wheel factor 0.002 and the pinch factor, which need tuning by hand; the factor 2 and the 150 ms animation of the buttons and keys; Alt+Page Up and Alt+Page Down in place of Earlier and Later; the button name Go to now; the URL key q and its 250 ms debounce; three significant digits in zoom; the transform fallback; the View menu's contents per view)"
---

# A smooth zoom and a slim bar above the timeline, on the planning board and the order Gantt

## Context and problem statement

[ADR 0089](0089-zoom-levels-and-an-endless-time-axis-that-loads-by-time-chunk-on-the-planning-board-and-the-order-gantt.md) gives the planning board and the order Gantt a ladder of seven zoom levels. Ctrl+wheel, a pinch, the zoom buttons and the minus and plus keys step one level at a time. The Gantt's toolbar holds Zoom out, a menu of the levels, Zoom in, Zoom to fit, Earlier, Now, Later, Go to date and the visible span as text, followed by Hide closed time, My draft, Columns and Board options (Workload and Cascade). The board's toolbar holds the same range controls and My draft. Krister Johansson tried it on main on 2026-10-30 (#896). The zoom jumps from Day to Week instead of following the hand, and the controls above the timeline take room from the chart.

He decided the same day that the zoom is smooth on both views, that the level menu goes, and that the bar above the timeline holds only Go to now and an order filter that shows only the matching orders, with the other tools in one View menu and the zoom buttons over the time area.

ADR 0089 rejected "Free zoom to any pixels per hour" because snap steps, workload buckets and plan 18's zoom rules need fixed steps, and because [ADR 0030](0030-a-planning-board-built-in-house.md) cut continuous zoom for its cost. This ADR answers both reasons. It covers the timeline core in `apps/web/src/modules/planning/timeline/`, the board and Gantt screens, the shared range controls, and the URL keys `zoom` and `q`. The endless axis, loading by time chunk and the greyed past of ADR 0089 stay as decided, except where this ADR says otherwise.

## Decision drivers

* The zoom follows the gesture: a small pinch gives a small change, and the instant under the pointer stays under it.
* Snap steps, workload buckets, chunk lengths and plan 18's zoom rules keep fixed values, so the move model, the workload lanes and the chunk cache do not change.
* The chart gets the room: one row of controls above it, nothing that a planner uses only now and then.
* A filter narrows what the planner sees, never what the move rules check.
* Every gesture keeps a single-pointer and a keyboard path ([ADR 0021](0021-accessibility-target-wcag-2-2-aa.md)), and a shared link opens the same view ([ADR 0062](0062-web-form-contracts-url-view-state-and-module-link-manifests.md)).
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
* The seven levels of ADR 0089 stay, as bands of that number. A level's band reaches from the geometric mean of its natural width and the next coarser level's to the geometric mean of its natural width and the next finer level's, so `day` (48 px per hour) covers about 27.7 to 69.3 px per hour. A width exactly on an edge lies in the finer band. The coarsest and finest bands end at the clamp.
* The band sets what a level set in ADR 0089: the header tiers with their label formats, the snap step, the workload bucket, the time chunk's length, and plan 18's rules for "Hours and Day zoom" and "Week and 4 weeks zoom". The zoom number sets the scale's width per hour, and which closed windows Hide closed time compresses: a window is compressed where its width at the current zoom is wider than the gap, as ADR 0089 says per level. So a block snaps, a bucket sums and a chunk loads the same at 40 and at 60 px per hour.
* The bottom tier of the `quarter-hours` band gets a short label format, the minutes alone (`15`, `30`, `45`), so its labels stay at the band's coarse end, where a 15 minute cell is narrower than `06:15`.
* During a gesture or an animation, the band changes only once the zoom is more than a factor of 1.1 past a band edge, and changes back only once it is more than a factor of 1.1 past the edge the other way. A gesture that hovers at an edge does not swap tiers or snap steps back and forth.
* When the gesture or the animation ends, the zoom is rounded as the URL holds it (three significant digits), and the band is the one the rounded zoom lies in by the edges alone. The band of a zoom in the URL is found the same way, so a reload and a shared link open the band the planner saw when the gesture ended. A gesture that ends at 27.72 px per hour, just inside `day`, rounds to 27.7 and settles in `week`.

### Gestures, buttons and keys

* Ctrl+wheel and Cmd+wheel over the time area or the workload panel multiply the zoom by `exp(-deltaY * 0.002)`, with `deltaY` in pixels (a line-mode delta counts as 16 px and a page-mode delta as the time area's height). A trackpad pinch that the browser reports as Ctrl+wheel goes through the same wheel event and the same factor 0.002, with no extra multiplier. That is a working default: a pinch gives smaller deltas per event than a mouse wheel, and d3-zoom multiplies a Ctrl+wheel delta by 10 for that reason. The factor has not been tuned yet. It is tuned by hand on a macOS trackpad and a Windows precision touchpad in Chrome, Edge and Firefox, and this ADR then records the factor and the browser versions. A Safari gesture event or a two-finger touch pinch multiplies the zoom by the change in its scale. The instant under the pointer, or under the pinch's centre, stays at the same x. The page does not zoom while the pointer is over the time area or the workload panel, and a plain wheel scrolls as before.
* Wheel and pinch events are coalesced to one change of the zoom per animation frame. A gesture ends 150 ms after its last event.
* Zoom in and Zoom out multiply or divide the zoom by 2 around the centre of the view, over 150 ms with an ease-out curve. A press during the animation compounds from the animation's target. With `prefers-reduced-motion: reduce`, the change is immediate. With focus inside the grid, the plus and minus keys do the same, once per press, so a held key does not run to the clamp. The browser's own zoom keys stay untouched.
* Zoom to fit tries the bands from the finest to the coarsest. For each, it computes the zoom whose width fits the span, with one snap step of that band on each side and the closed windows that zoom compresses, into the time area, and takes the first zoom that lies in that band. It centres the span. The span is the same as in ADR 0089: the selected order or run, else every loaded row on the Gantt and every loaded job order on the board. When the span does not fit at the coarsest width, the zoom is the clamp and the span's start is centred.
* No zoom starts while a pointer drag runs, because the drag reads the scale it began at, as today.
* At the end of a gesture, an animation or Zoom to fit, the view writes `zoom` to the URL and announces the band politely, for example "Zoom: Day".
* Zoom out, Zoom in and Zoom to fit are small icon buttons over the lower right corner of the time area, above the workload panel when it shows. They sit outside the grid element and after it in the tab order, so they do not break the grid's rows. Zoom in is `aria-disabled` at the finest clamp and Zoom out at the coarsest, and focus stays where the planner pressed. The time scroller reserves their size with `scroll-padding` at its bottom and end, so a focused block scrolled into view is never under them. The menu of levels goes.

### Laying out a zoom

* During a gesture, each frame lays the buffer of ADR 0089 out again at the new width: ticks, blocks, links and shading are culled to the buffer as before, and the buffer is rebuilt around the anchor instant, as a level change rebuilds it in ADR 0089.
* Chunk loads, chunk drops and a change of chunk length wait for the end of the gesture, so a zoom in and out within one gesture reloads nothing. Time that a zoom out shows before its chunks are requested draws the loading band of ADR 0089, never empty rows.
* A gesture keeps the SP3 drag budget: p95 frame time at most 33 ms and no long task over 50 ms, measured with a Ctrl+wheel gesture across the `hours` to `4weeks` bands on the planner PC class, at the SP3 volume on the board (5 000 blocks on 60 rows) and the SP3b volume on the Gantt (1 250 orders). If the measurement fails, the gesture instead transforms the drawn time layers horizontally around the anchor, hides the header labels until it ends, and lays out once at its end. The bands, the URL and the controls stay as this ADR decides.

### The bar above the timeline

* The page title and the bar share one row, which wraps at narrow widths (320 px). The bar holds Go to now, the order filter, My draft while the planner's draft has changes, and on the Gantt one View menu, an icon button at the right end. The Now button is renamed Go to now on both views.
* The Gantt's View menu holds Columns, Hide closed time, Workload and Cascade, which keep their storage (the Gantt's local options). The board has no options today: it keeps Hide closed time off and Cascade on, and has no workload panel, so it shows no View menu until it has an option. The shift strip of plan 18 joins the View menu when it is built.
* When the draft drawer closes with no changes left, for example after Discard draft, My draft is gone, and focus moves to the order filter.
* Earlier, Later, Go to date and the visible span as text leave the board and the Gantt. With focus inside the grid, Alt+Page Up and Alt+Page Down scroll the time area one viewport width earlier and later, as spreadsheets scroll one screen sideways; the row keys Page Up and Page Down ignore a press with Alt. Focus moves to the row's first block in the new view, or to the row's first cell when the row has none in view, so focus never stays on a block that culling unmounts. The time scroller's visible scrollbar, the plain wheel and Shift+wheel remain the pointer paths that move in time without dragging, and the header's top tier names the dates in view. `from` stays in the URL, so a link still opens at any date.
* The fixture note and "Links shown for the selected order" show only while they have text, so no empty line sits between the bar and the grid.
* The job order table view keeps its Range presets, Earlier, Now, Later and Go to date, because it has no time area to zoom.

### The order filter

* The filter is a search field named "Filter orders" in the bar. It searches the production order number as ADR 0016's list search does, as the planner types, with a 250 ms debounce, up to ADR 0016's 100 characters. Escape or its clear button empties it.
* The filter decides what is drawn, never what is loaded for the move rules. Chunks keep loading every job order in their span, so the workload lanes, the overlap check of `judgeMove`, the cascade and `validate()` still see the whole machine.
* On the order Gantt, the row list loads only the matching production orders, with their operations and job orders, through `loadRows(filter, page)`, and the time area scrolls to the span of the first match that has one. It scrolls only when the first match changes, not on every keystroke. On the planning board, the machine rows stay, only the matching orders' job orders are drawn, the Not placed row loads through `loadRows(filter, page)` too, and the time area scrolls to the first match's span from the row list in the same way.
* Blocks of orders that do not match are hidden by order number at once, so a stale chunk never shows them under the new filter.
* With no match, the grid shows an empty state that names the filter and offers Clear filter. Clearing it brings every order back and keeps the scroll position.
* The filter's URL key is `q`, the search key ADR 0062 reserves, written with replace, with a schema of at most 100 characters that falls back on its own as ADR 0062 says. The Gantt and the board pass it as `GanttFilter.search` to `loadRows`. A server row query without a search argument gets one through its Zod contract ([ADR 0017](0017-zod-contracts-as-the-single-source-for-inputs.md)), and the value reaches SQL only as a bound value.

### The URL key zoom

* `zoom` holds the zoom as a plain decimal with at most three significant digits and no trailing zeros (`zoom=37.5`, `zoom=0.15`), written with replace when a gesture, an animation or Zoom to fit ends. Its default is the `week` level's natural width, 16, which is stripped from the URL.
* A level id of ADR 0089 (`hours`, `day`, `week`, `4weeks`, `quarter-hours`, `quarter`, `year`) still opens, at that level's natural width, so existing links keep working. A value that is neither a number nor a level id falls back to 16 on its own, as ADR 0062 says.
* A link to the job order table view opens it at the preset of the zoom's band: the `quarter-hours` band at `hours`, and the `quarter` and `year` bands at `4weeks`, as ADR 0089 maps the levels.

### Parts of accepted ADRs this decision changes

The files below keep their text. This ADR holds over the parts listed here, and the rest of each ADR stands. [ADR 0030](0030-a-planning-board-built-in-house.md) is proposed, so its own text gets a pointer to this ADR instead.

#### Changes to ADR 0089

[ADR 0089](0089-zoom-levels-and-an-endless-time-axis-that-loads-by-time-chunk-on-the-planning-board-and-the-order-gantt.md), zoom levels and the endless axis:

| Section | Before | After |
|---|---|---|
| Zoom levels | "A zoom level is the timeline's unit of zoom" and Ctrl+wheel "steps one level per gesture" | The zoom is a width per hour, and each level is a band of it ([Zoom as a width per hour](#zoom-as-a-width-per-hour)); gestures zoom continuously ([Gestures, buttons and keys](#gestures-buttons-and-keys)) |
| Zoom levels | "The toolbar has Zoom out, Zoom in, a menu of the levels, and Zoom to fit" and "the minus and plus keys step a level too" | Zoom out, Zoom in and Zoom to fit are icon buttons over the time area, the keys and buttons zoom by a factor of 2, and the menu of levels goes |
| Zoom levels | Zoom to fit "picks the finest level whose natural width fits a span" | Zoom to fit sets the width that fits the span, band by band |
| Zoom levels | "The URL key `zoom` holds the level id" and a link "at another level opens the table at the nearest preset" | `zoom` holds the width per hour, a level id still opens, and the table opens at the preset of the zoom's band ([The URL key zoom](#the-url-key-zoom)) |
| Header tiers | "a closed window is compressed only where its natural width is wider than the gap" | Its width at the current zoom decides |
| The endless axis | "A change of level, Now, Go to date, Earlier and Later rebuild the buffer", "Earlier and Later scroll by one viewport width" and "The toolbar's range text names the visible span and follows the scroll" | Each frame of a zoom, Go to now and Alt+Page Up and Alt+Page Down rebuild or move the buffer; Earlier, Later, Go to date and the range text leave the board and the Gantt ([The bar above the timeline](#the-bar-above-the-timeline)); `from` stays |
| Loading by time chunk | The chunk length "follows the level" | The chunk length follows the band; loads, drops and a change of length wait for the end of a gesture |
| Confirmation | `time-scale.test.ts` steps "a level ... at every pair of adjacent levels"; `time-buffer.test.ts` checks that "the range text equals the span"; `gantt-scroller.spec.ts` checks that "the toolbar's range text matches the header"; `gantt-search.test.tsx` says "an unknown id falls back to `week`" | The tests check the zoom within a band and across band edges, the visible span against the header's top tier, and an unknown value falling back to 16 ([Confirmation](#confirmation)) |

#### Changes to ADR 0062

[ADR 0062](0062-web-form-contracts-url-view-state-and-module-link-manifests.md), URL view state:

| Section | Before | After |
|---|---|---|
| Decision outcome (the board URL) | "`zoom=<preset id>`", "the default preset" stripped, and "Earlier and Later replace the history entry" | `zoom` holds the width per hour with its default 16 stripped, a preset or level id still opens, and Earlier and Later leave the board and the Gantt; `q` holds the order filter |
| Confirmation | `board-search.test.tsx`: "Earlier and Later replace the history entry" | `board-search.test.tsx` checks `zoom` and `q` as this ADR's [Confirmation](#confirmation) says |

#### Changes to ADR 0055

[ADR 0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md), release 1 scope. Under the scope rule, "An item enters release 1 only by the maintainer's decision, recorded in this ADR's ledger table". Krister Johansson asked for the smooth zoom on 2026-10-30, and this ADR proposes it for release 1. The row below enters the ledger when he confirms it.

| Section | Before | After |
|---|---|---|
| Decision outcome (ledger additions) | "Additions from the stress test, which the maintainer still confirms:" and its table | The table also holds the row below, which comes from this ADR and not from the stress test. No source gives a figure for it, so it is not estimated until its stories exist |

| Addition | Estimate (raw days) |
|---|---|
| ADR 0090: the smooth zoom on the planning board and the order Gantt | not estimated |

### Consequences

* Good, because the zoom follows the gesture, and Zoom to fit fits a span exactly instead of to the nearest level.
* Good, because snap steps, buckets and chunks keep the ladder's fixed values, so the move model, the workload lanes and the chunk cache stay as built.
* Good, because the chart gains the height of a toolbar row and the controls a planner uses rarely move into one menu.
* Good, because the filter narrows the view and leaves the move rules their whole machine.
* Bad, because every frame of a gesture lays out the buffer, which costs more than one layout per level step; the SP3 measurement and its fallback exist for that.
* Bad, because a link's `zoom` is now a number, and a link from before this ADR opens at a level's natural width, which is still a valid zoom.
* Bad, because Earlier, Later and Go to date leave the board and the Gantt, so a planner who used them scrolls, uses Alt+Page Up and Alt+Page Down, or uses a link instead.
* Bad, because the pinch factor cannot be read from documentation and needs tuning by hand on each platform.
* Neutral, because the job order table view keeps its presets and its range controls.

### Confirmation

* `timeline/time-scale.test.ts`: the widths 0.15, 0.6, 3, 16, 48, 100 and 240 px per hour lie in the bands `year`, `quarter`, `4weeks`, `week`, `day`, `hours` and `quarter-hours`; during a gesture, a fast-check property over zoom sequences that stay within a factor of 1.09 of a band edge never changes the band, and a zoom more than a factor of 1.1 past it does; a width exactly on each edge lies in the finer band; at the end of a gesture, the band is the one the rounded zoom lies in by the edges alone, so a gesture that ends at 27.72 settles at 27.7 in `week`, and `zoom=27.7` reopens in `week`; at 150 px per hour the bottom tier labels its quarter hours `15`, `30` and `45`.
* `timeline/zoom-view.test.ts`: a Ctrl+wheel `deltaY` of -100 in pixel mode multiplies the zoom by `exp(0.2)`; through a gesture of 50 events of `deltaY` -4 the pointer's instant stays within 1 px of its x after each event, across the DST days 2026-10-25 and 2027-03-28; Zoom to fit of a span returns one zoom, which lies in the band it was fitted for and fits the padded span within 1 px; Zoom in from 16 gives 32 and Zoom out gives 8.
* `gantt-chunks.test.tsx`, with a counting mock source: a gesture from the `week` band to the `4weeks` band loads the buffer's month chunks once; the test applies the last frame's zoom, asserts the count of loads, then advances 150 ms and asserts that the month chunks have loaded.
* `gantt-search.test.tsx` and `board-search.test.tsx`: `zoom=37.5` opens at 37.5 px per hour, `zoom=week` at 16, `zoom=day` at 48, `zoom=abc` at 16, `zoom=1000` at 240, and `zoom=26` in the `week` band; `q=1003` opens filtered, and a `q` of 101 characters falls back to no filter with ADR 0062's status.
* `job-orders-search.test.tsx`: `zoom=37.5` opens the job order table at `day`, `zoom=200` at `hours` and `zoom=0.5` at `4weeks`.
* `planning-board-moves.test.tsx`: with `q=1003`, a move of a 1003 job order onto the time of a 1004 job order on the same machine is refused with `OVERLAP`, and the machine's workload counts the 1004 job order.
* `e2e/planning/gantt-zoom.spec.ts` and `e2e/planning/board-zoom.spec.ts`: each Ctrl+wheel event of `deltaY` -4 changes the zoom by a factor between 1.005 and 1.01; Zoom in from 16 gives 32, Zoom out gives 8, and each is `aria-disabled` at its clamp; with reduced motion the change is immediate; Alt+Page Down scrolls one viewport width later and keeps focus on the row; the filter shows only the matching order and Clear filter brings the rest back; My draft hides at zero changes and focus moves to the filter; and `checkA11y` passes with the View menu open, with My draft shown, with a filter and with no match.
* `e2e/planning/zoom-gesture.perf.spec.ts`, run on the planner PC class at the SP3 and SP3b volumes as ADR 0030's frame-time check: a Ctrl+wheel gesture across the `hours` to `4weeks` bands stays at p95 frame time at most 33 ms with no long task over 50 ms.

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
* d3-zoom's default wheel delta, `defaultWheelDelta` in its source: `-deltaY * (deltaMode === 1 ? 0.05 : deltaMode ? 1 : 0.002) * (ctrlKey ? 10 : 1)`.
* Revisit at the SP3 measurement of a zoom gesture, when the pinch factor has been tuned by hand, and if planners miss Earlier, Later or Go to date.
