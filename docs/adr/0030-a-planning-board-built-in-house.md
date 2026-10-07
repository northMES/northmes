---
status: "proposed"
date: 2026-10-06
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: internal research notes 05, 09, 21, 29 and 32
informed: contributors and coding agents
release: "1"
needs-confirmation: "product owner (weekly volumes); pilot IT (planner PC); lawyer (FullCalendar fallback only)"
---

# A planning board built in house

## Context and problem statement

The planning board is the planner's main screen. It is a resource timeline: one row per machine, many job order blocks per row, blocks moved in time and between machines. A project Gantt, with one task per row and a task tree, is a different component, and free project Gantt libraries put many tasks on one resource row only in their paid editions (internal research note 05).

The board must show the draft states of [ADR 0029](0029-per-planner-drafts-soft-locks-and-the-plan-revision.md) (committed, mine in draft, held by another planner, hard-locked, started, proposed), plus conflicts, late orders and material warnings. It renders block fields that core, the connector and plugins contribute through a slot. It meets WCAG 2.2 AA ([ADR 0021](0021-accessibility-target-wcag-2-2-aa.md)) and ships inside AGPL-3.0-or-later core ([ADR 0039](0039-license-agpl-3-0-or-later-core-and-a-contributor-license-agreement.md)). One developer builds it. Pilot scale is about 40 machines and 1 600 job orders over 8 weeks; the stress scale is 60 machines and 5 000 job orders ([ADR 0028](0028-autoplan-as-a-pure-deterministic-function.md)). Every spike measurement so far comes from an Apple M4, not from the Windows PC class the pilot's planners use.

This ADR decides whether to build or buy the board, what the release 1 board contains, the job order table view, and the board spike SP3 with its exit. It covers `modules/planning/web` and the board slot types in `@northmes/web-sdk`.

## Decision drivers

* Core stays complete and redistributable under AGPL-3.0-or-later: `git clone` plus `docker compose up` gives a lawful, complete system.
* Resource rows with many blocks each, moves between allowed machines, and snapping to the target machine's working time.
* Block fields and hover content from plugins, which needs control of the DOM.
* A non-drag alternative for every move (WCAG 2.5.7), a keyboard model and a screen-reader path.
* Frame times on the pilot's planner PC, measured before the board-core tasks start.
* The duration shown while dragging must equal what the server computes.
* One developer: the build is estimated at about 35 days (6 to 8 weeks), an estimate and not a measurement (internal research note 05).

## Considered options

* Build in house: a headless TypeScript core, DOM rendering, TanStack Virtual for rows, own time culling, an SVG link overlay and custom pointer events
* FullCalendar Premium's resource timeline under its AGPLv3 license option
* A commercial scheduler under a per-developer or OEM license (Bryntum Scheduler Pro, DHTMLX PRO, SVAR React Gantt PRO, KendoReact, Syncfusion)
* A permissive open source timeline (vis-timeline, DayPilot Lite, react-calendar-timeline) or dnd-kit building blocks (dnd-timeline)

## Decision outcome

Chosen option: "Build in house", because no license-clean library is a resource scheduler with keyboard support, links and React slot content; the one complete AGPL-compatible option conflicts with proprietary plugins under the proposed extension exception ([ADR 0056](0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md)); and the board is the main screen, which keeps growing (draft overlays, conflicts, material warnings, proposals).

### Build

* The headless core is plain functions: `createTimeScale({ range, zoom, timeZone, widthPx })` with `x(instant)`, `instant(x)` and `ticks()`, plus `cullBlocks` and `hitTest`. All position math goes through the scale, so a compressed off-hours axis can come later as another scale.
* Blocks are DOM elements positioned with `transform`. Rows virtualize with TanStack Virtual. Each row keeps its blocks sorted by start, and a binary search culls them by the visible time range. An SVG overlay draws links for the selected order only.
* Moves use pointer events with `setPointerCapture`: the target row comes from y through the virtualizer's offsets, the instant from x through the time scale. The drag preview moves in `requestAnimationFrame` with its state in a ref or an external store, so rows do not re-render until drop. dnd-kit and pragmatic-drag-and-drop are not used for moves inside the board.
* Snapping goes first to the zoom preset's step, then forward to the next working instant on the target machine. Duration and snapping come from `@northmes/planning-domain` ([ADR 0057](0057-scheduling-domain-as-a-pure-package-in-the-planning-module.md), [ADR 0027](0027-planned-duration-formula-and-override-precedence.md)), so the preview and the server agree. The server stays the authority and returns the final times.
* Instants stay ISO strings in the Apollo cache and become epoch milliseconds once at the data edge ([ADR 0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md)).
* The board lives in `modules/planning/web` under AGPL; only the slot types live in the MIT `@northmes/web-sdk`. `BoardBlock` has explicit fields for draft (`none`, `mine`, `proposal`), late, conflict, material shortage and progress. The slot `planning/board/block-fields/v1` has the slot kind `field` of [ADR 0068](0068-extension-points-declared-by-their-owners-contributions-as-manifest-data-with-code-by-id-and-a-plugin-inventory.md), which takes the place of `BoardFieldSlot`: a contribution's `useValues` loads the values for the blocks of the board's loaded range in one query, its synchronous `render` returns text, an optional icon and `accessibleText`, and its optional `Hover` component, shown in the block's hover card, may fetch. The board header slot `planning/board/header/v1` has the `field` kind too (both ids proposed in [ADR 0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md)). Block field renderers stay synchronous and cheap; hover renderers may fetch.
* Bryntum, DHTMLX PRO and Scheduler, SVAR PRO, KendoReact, Syncfusion, Planby and GSTC are excluded from core. FullCalendar Premium remains a fallback only if a legal review clears it under AGPL.

### The release 1 board

In release 1: machine rows grouped by equipment group with group colors and collapse; a sticky time header and machine column; a linear axis with four zoom presets from hours to weeks, in plant time with a zone label; non-working shading per machine; blocks with settings-driven fields and a hover card that includes ERP free fields, filled with the order color; moves in time and between allowed machines with snapping; the states committed, mine in draft, held by another planner, hard-locked, started, proposed, conflict, late, overdue, finish pending and material warning, each with a cue besides color; break lock with a confirmation that requires a reason; realtime updates ([ADR 0018](0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md)); keyboard navigation, keyboard move mode and the detail panel, in the same increment as dragging; dark mode; the board field slot `planning/board/block-fields/v1` and the header slot `planning/board/header/v1`.

Cut from release 1: resize (block length follows from quantity, rates and the calendar), the compressed off-hours axis, multi-select and multi-drag, continuous zoom, undo beyond discarding the draft, the conflict navigator and the minimap. Click-to-place and the ghost outlines of other planners' drafts are cut candidates.

### The job order table view

The table view is the main screen-reader path and a second view for every planner. It is a semantic TanStack Table with order and operation, article, machine, start, end, quantity, status, lock holder, order deadline, planned end and late-by columns, and sortable headers set `aria-sort`. Each row has Move (the shared Move dialog), Lock and Open order. It pages on the server through the Relay connection ([ADR 0016](0016-graphql-list-conventions-connections-relations-filter-sort-search-and-group-by.md)), because NVDA browse mode stops at the last rendered row of a virtualized table.

A "Late only" filter reuses the query behind the `late` filter of the MCP tool `planning_find_orders` ([ADR 0034](0034-mcp-surface-one-endpoint-a-read-mostly-planning-toolset.md)) and works with the AI module disabled. A late order comes with facts the engine already has: the deadline rule in use, `asOf`, planned end, delay, whether the forward fallback ran, fixed or locked rows, conflicts, material warnings, and wait time against run time per operation. Attribution of the binding constraint inside `plan()` comes later.

### The board spike SP3 and its exit

* SP3 renders max(2 x pilot weekly job orders x 8 weeks, 5 000) blocks on 60 rows, fed through Apollo from a mocked schema or a stub resolver, on the pilot planner PC class. It also measures the normalized-cache write of N blocks and the refetch of the visible range, and it runs once with the Temporal polyfill forced in Chromium.
* SP3 does not wait for the planning orders epic. Board-core tasks wait only for the SP3 verdict and the board design approval; only the board's data-wiring task waits for the planning API.
* Pass criteria: 60 fps while scrolling at day zoom; p95 frame time at most 33 ms while dragging at week zoom; no long task over 50 ms; keyboard move mode steps one snap and one machine.
* Verdict on 2026-11-06. On a fail, one more week limits the rendered range: day zoom up to 2 weeks, week zoom aggregated per shift. On a second fail by 2026-11-20, planning runs on the job order table view with the shared Move dialog plus a read-only timeline, item 8 of the cut order in [ADR 0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md).
* The block count needs the pilot's machines and job orders per week (product owner) and the planner PC model and browser (pilot IT). Until both arrive, SP3 uses 5 000 blocks.

### Consequences

* Good, because core stays license-clean, and a fork or a customer gets the whole board under AGPL.
* Good, because the board owns its DOM: slot content, accessible names built from visible spans that carry `lang`, and every block state need no workaround inside a vendor component.
* Good, because the table view gives screen-reader and keyboard users a complete path, and it is also the fallback if SP3 fails twice.
* Good, because the time scale abstraction leaves room for a compressed axis without touching drag or links.
* Bad, because the board is the largest single frontend item, and coding agents help least with drag feel, accessibility and frame-time tuning.
* Bad, because the frame-time risk stays with NorthMES; SP3 and the nightly frame-time check exist for that risk (R-04 in [17-risks.md](../plan/17-risks.md)).
* Neutral, because the headless core can move into an MIT package once a second module needs a timeline.

### Confirmation

* SP3 records its measurements on the planner-class Windows PC against the four pass criteria, and the verdict with its numbers is added to this ADR on 2026-11-06.
* `e2e/board-perf.spec.ts` samples frame times during a scripted scroll and drag, nightly on a fixed runner, as a regression check only; the verdict comes from planner hardware.
* `time-scale.test.ts` in `modules/planning/web` (TIME4 and TIME5 in [07-production-planning.md](../plan/07-production-planning.md)): `snap(2026-10-25T01:10Z, 15 min)` returns 01:15Z and snapping is monotone; the plant days 2026-10-25 and 2027-03-28 have 25 and 23 hour ticks.
* A Vitest browser test on block names: the article span inside a block has `lang` and is part of the computed name; a cluster of four narrow blocks, one late and one held by another planner, has a name that contains "1 late, 1 being edited by" and the holder's name; the fill equals the order color in every state.
* `e2e/a11y/board.axe.spec.ts` over the populated, locked block, move mode and paused states is required in the separate `ci / a11y` job from the first board pull request. `e2e/planning/board-keyboard.spec.ts` checks keyboard move mode.
* A Chromium project with `globalThis.Temporal` deleted loads the board, and hovering a block at 2027-03-28T01:00Z shows 03:00.
* A late-filter test: `planningJobOrders` with the `late` filter and the MCP `late` filter return the same ids for a late fixture order, and the filter works with the `ai` module disabled.
* The dependency license gate ([ADR 0040](0040-dependency-license-policy-ci-gate-and-sbom.md)) denies custom, commercial and source-available licenses and third-party AGPL in core, so adding any excluded library, or FullCalendar Premium, fails CI.

## Pros and cons of the options

### Build in house

* Good, because every line is AGPL or MIT code that NorthMES owns.
* Good, because row virtualization plus time culling keeps only what is on screen in the DOM.
* Good, because the same duration function runs in the browser and on the server.
* Bad, because it costs about 35 days by estimate, and frame times are unknown until SP3.

### FullCalendar Premium under AGPLv3

* Good, because version 7 has resource groups, per-resource events, virtual rendering for rows and time slots, dark mode and a shadcn registry entry; integration was estimated at 3 to 4 weeks.
* Bad, because its AGPL option requires the frontend and backend to be fully AGPLv3-compliant, which reads against proprietary plugins whose block fields would render inside FullCalendar event content in the same bundle.
* Bad, because it would stand in the way of licensing NorthMES on other terms, and the board could never move into an MIT package.
* Bad, because it has no dependency arrows, so links would still need an own overlay.

### A commercial scheduler

* Good, because Bryntum Scheduler Pro is the closest functional fit: resource rows, dependencies, resource calendars, virtual rendering and keyboard support according to the vendor.
* Bad, because per-developer and OEM licenses forbid redistributing the source, so AGPL core cannot include them; Bryntum's license also covers every developer who works with its code, contributors included.
* Bad, because DHTMLX Scheduler's free edition is GPLv2-only, which cannot combine with AGPLv3, and its timeline view is in the paid edition.

### A permissive timeline or building blocks

* Good, because Apache-2.0 and MIT licenses fit AGPL core.
* Bad, because none of them combines keyboard support, links and React slot content (internal research note 05).
* Bad, because dnd-kit's droppable model loses targets when rows virtualize and snaps to a pixel grid, not to working time; dnd-timeline builds on it and has one maintainer.

## More information

* Related ADRs: [0016](0016-graphql-list-conventions-connections-relations-filter-sort-search-and-group-by.md) list conventions, [0018](0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md) realtime, [0019](0019-web-shell-with-react-module-federation-remotes.md) web shell, [0020](0020-frontend-libraries-tanstack-router-apollo-client-4-shadcn-ui-and-forms.md) frontend libraries, [0021](0021-accessibility-target-wcag-2-2-aa.md) accessibility and the board's keyboard model, [0024](0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md) time, [0027](0027-planned-duration-formula-and-override-precedence.md) duration, [0029](0029-per-planner-drafts-soft-locks-and-the-plan-revision.md) drafts and locks, [0036](0036-agent-proposals-as-planning-records-a-person-commits.md) proposals, [0037](0037-plugins-drop-in-packages-command-validators-and-ui-slots.md) slots, [0040](0040-dependency-license-policy-ci-gate-and-sbom.md) license gate, [0055](0055-release-1-scope-under-option-b-and-the-scope-rule.md) cut order, [0068](0068-extension-points-declared-by-their-owners-contributions-as-manifest-data-with-code-by-id-and-a-plugin-inventory.md) the `field` slot kind.
* Plan: [07-production-planning.md](../plan/07-production-planning.md), sections "Planning board in release 1", "Board accessibility", "Performance budgets" and "The board spike (SP3) and its exit"; [06-web-and-ux.md](../plan/06-web-and-ux.md); [17-risks.md](../plan/17-risks.md), R-04.
* The library versions and license facts behind this ADR were checked on 2026-10-04 (internal research note 05).
* Revisit at the SP3 verdict, when a second module needs a timeline, and if FullCalendar's license terms change.
