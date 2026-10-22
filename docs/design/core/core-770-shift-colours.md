# Shift colours on the calendar's week view

This is the approval record of the shift colours on a calendar's page in plant settings, issue [northMES/northmes#770](https://github.com/northMES/northmes/issues/770). The week view of design #688 drew every shift on the info pair. With this design each shift of a calendar has its own colour, a legend above the week view names every shift, and the Shift pattern table lists each shift by name with its colour key. The page is a Design artifact on the NorthMES design system ([ADR 0079](../../adr/0079-design-pages-as-artifacts-on-the-northmes-design-system-with-the-approved-source-in-the-repository.md)).

Every calendar, machine, person and time on the page is fictional.

## Approval

Krister Johansson picked variation A on 2026-10-21.

- Artifact: https://claude.ai/artifact/3Miax8au3bTsyXGtDjicUN
- Approved version id: 1792595861-0472, published with the label "approved #770".
- Design system: NorthMES, https://claude.ai/artifact/65vYss7WbTHUytBjyWEJHy, at version 1792590896-fcfc.

Krister picked the variation on version 1792595356-4f1c. Before the approval was recorded, the Shift pattern table's rows became literal markup: the HTML parser moves `<sc-for>` out of `<tbody>`, as the record of #674 describes, so the table would have drawn empty rows. The artboards also gained the IBM Plex link. Version 1792595748-cbe6 carries the same label but still has the template rows. The content is otherwise the same.

## Approved files

The artboards are in the canvas's `.dc.html` format and render with [core/support.js](../project/core/support.js).

- [core/core-770-shift-colours.dc.html](../project/core/core-770-shift-colours.dc.html): the proposed tokens with their contrast, for both variations.
- [core/core-770-shift-colours-calendar.dc.html](../project/core/core-770-shift-colours-calendar.dc.html): calendar B3 with three shifts, frame CS1, with tweaks for theme, variation and width.
- [core/core-770-shift-colours-calendar-dark.dc.html](../project/core/core-770-shift-colours-calendar-dark.dc.html): frame CS2, variation A in dark at 1440.
- [core/core-770-shift-colours-calendar-narrow.dc.html](../project/core/core-770-shift-colours-calendar-narrow.dc.html): frame CS3, variation A in light at 320.
- [core/core-770-shift-colours-calendar-narrow-dark.dc.html](../project/core/core-770-shift-colours-calendar-narrow-dark.dc.html): frame CS4, variation A in dark at 320.
- [core/core-770-shift-colours-calendar-b.dc.html](../project/core/core-770-shift-colours-calendar-b.dc.html) and [core/core-770-shift-colours-calendar-b-dark.dc.html](../project/core/core-770-shift-colours-calendar-b-dark.dc.html): frames CS5 and CS6, variation B, kept as the option that was not chosen.
- [core/core-770-shift-colours-tokens.css](../project/core/core-770-shift-colours-tokens.css) and [core/core-770-shift-colours-bundle.css](../project/core/core-770-shift-colours-bundle.css): the design system's tokens and component styles that the artboards link.

## Decisions in the design round

- Variation A: each shift has a pair of tokens, a strong edge `shift-N` on a pale fill `shift-N-subtle`, the shape the week view already had. Variation B, fills that reach 3:1 on the lane with black text, read like the board's order blocks and was not chosen (Krister, 2026-10-21).
- The colour follows the shift by its order in the calendar version: the first shift takes shift-1, the second shift-2 and the third shift-3, on every day. A fourth shift starts over at shift-1.
- Colour is never the only cue (WCAG 1.4.1): each block keeps the shift's name and times, the legend above the view names every shift with its times, and the pattern table writes each shift's name beside its key.
- Break stays muted and dashed, overtime the success pair, non-working hatched destructive, and closed time has no fill. The order palette and the equipment group colours stay unused.
- Two lathes on calendar B3 join the pages fixture beside G1, so the drawn calendar has machines (Krister, 2026-10-21). They are not plannable, so the machine page does not promise them on the board or the Gantt, which read G1 only.

## Tokens

| Token | Light | Dark |
|---|---|---|
| `shift-1` | oklch(0.48 0.12 250) | oklch(0.78 0.1 250) |
| `shift-1-subtle` | oklch(0.935 0.03 250) | oklch(0.29 0.05 250) |
| `shift-2` | oklch(0.5 0.1 65) | oklch(0.82 0.11 75) |
| `shift-2-subtle` | oklch(0.95 0.045 80) | oklch(0.3 0.05 75) |
| `shift-3` | oklch(0.5 0.14 305) | oklch(0.78 0.12 305) |
| `shift-3-subtle` | oklch(0.94 0.035 305) | oklch(0.29 0.06 305) |

Each edge meets at least 5.78:1 on card, lane and lane-alt, and foreground and muted-foreground meet at least 5.65:1 on each fill, in both themes. Each fill is at least 7 apart (CIEDE2000) from the break, overtime and non-working fills and from the other shifts. `apps/web/test/styles/tokens.contrast.test.ts` checks all three.

## Frames

The PNGs of the frames are not in this record yet. The session that recorded the approval runs in the Claude Code sandbox, where Chromium does not start, so it could not render the artboards. The page source above is the approved design; PNGs follow when the artboards are rendered on a machine with a browser.

- CS1: calendar B3 in week 46 at 1440 in light: the pattern table with Early, Late and Night, the deviations (the plant holiday on Mon 9 Nov and overtime on Sat 14 Nov), the legend and the week view with Monday's night continuing on Tuesday.
- CS2: CS1 in dark.
- CS3 and CS4: CS1 at 320 in light and dark, the settings navigation as a row, the sections stacked and the week view scrolling sideways in its own region.
- CS5 and CS6: variation B at 1440 in light and dark.

## Build notes

- `PlantCalendar` holds a list of shifts, each with its name, weekdays, times, breaks and working seconds, as ADR 0025's `calendar_shift` rows do. `plantDefault` marks the plant calendar, so a machine's page says "The plant calendar by default." only there.
- The week view's region is focusable and scrolls sideways once the view is narrower than 52 rem; the design's 320 frames draw it at 884 px.
- The week's description groups shifts with the same days: "Monday to Friday Early 06:00 to 14:00 and Late 14:00 to 22:00, Monday to Thursday Night 22:00 to 06:00, each shift with two breaks".
- The calendars list writes several shifts with their names ("Mon to Fri Early 06:00 to 14:00, ..."); a calendar with one shift keeps "Mon to Fri 06:00 to 15:00".
- The pattern table lists a weekday's breaks on one line per shift. Each line names its shift for a page reader, and a shift without breaks says "No breaks", so the lines stay beside their shifts.
- The pattern's lead counts the shifts and names them when there are several, as the design's "Three shifts: Early, Late and Night."
- Blocks, legend items and rows are keyed by the shift's order, since two shifts of a version may share a name.
- When the shifts' break counts differ, the week's description gives each shift its own count.

## Known limits

- The design system republished its tokens with the six shift tokens at version 1792603577-72c4, from commit 819cce0 on the build branch (ADR 0079).
- The week view still decides closures per plant date, sorts a break by its start and gives lanes only to overtime. Issue #780 clips shifts, breaks and closures to the windows of ADR 0025 rule 7.
- A calendar with more than three shifts repeats the colours; its names keep the shifts apart.
