# D3 planning board

This is the approval record of design task D3, issue [northMES/northmes#221](https://github.com/northMES/northmes/issues/221), for story E08-S01 ([northMES/northmes#88](https://github.com/northMES/northmes/issues/88)). The design page is [planning/planning-221-board.dc.html](https://claude.ai/design/p/dba068e0-37df-46e5-adcf-4439b6c4c0ad?file=planning%2Fplanning-221-board.dc.html) in the Claude Design project. It builds on the direction chosen in the variations round ([planning-221-board-variations.md](planning-221-board-variations.md)), on the tokens and components of D1 ([ui-189-tokens.md](../ui/ui-189-tokens.md)) and on the shell of D2 ([shell-190-navigation.md](../shell/shell-190-navigation.md)).

The page draws the planning board of a plant inside the D2 shell: machines grouped by equipment group on a time axis in plant time, job order blocks with every state in text and shape, the docked inspector beside the grid and the pinned Not placed row. Every frame mounts the D2 shell, and the rows share three parts: the grid, the Not placed row and the inspector. Every name, number and time on the page is fictional.

## Approval

Krister Johansson approved the page on 2026-10-08. The header frame F0 records the approval; rows 1 to 4 hold the frames as he approved them.

- The first line of the header reads "Design task D3, spec page, approved by Krister Johansson on 2026-10-08. Every name, number and time on this page is fictional."
- The acceptance line "Krister approved the page and the design project's README row holds the etag." reads Met, with "Krister Johansson approved the page on 2026-10-08, and the README row holds the etag." The other four lines read Met for the frames in light and dark, At approval for the comment threads, and Not met for the design pull request and for the Design section of the waiting UI tasks.

The design project had no comment threads on 2026-10-08. The header PNG shows F0 at the page's etag below. The other PNGs were captured earlier the same day, from the part files at the etags below.

## Approved files

| File | Etag |
|---|---|
| `planning/planning-221-board.dc.html` | `1791438655548658` |
| `planning/planning-221-board-board.dc.html` | `1791421076640008` |
| `planning/planning-221-board-interact.dc.html` | `1791421606250021` |
| `planning/planning-221-board-draft-autoplan.dc.html` | `1791421354949964` |
| `planning/planning-221-board-table-narrow-keyboard.dc.html` | `1791422137774018` |
| `planning/planning-221-board-grid.dc.html` | `1791420740314393` |
| `planning/planning-221-board-notplaced.dc.html` | `1791420266289563` |
| `planning/planning-221-board-inspector.dc.html` | `1791420937916249` |
| `planning/planning-221-board.css` | `1791420387430299` |
| `planning/planning-221-board-data.js` | `1791420518025274` |

The design project returned these etags for `planning/` on 2026-10-08, after the header change. The header frame lives in the page file itself, so the page's etag is the one after the change. The README rows of these ten files read approved 2026-10-08 and hold the same etags.

The page also loads files outside this set: the folder's `planning/support.js` (etag `1791399699449723`); `planning/Shell.dc.html` (etag `1791399702249913`), which the README records as a byte copy of the approved `shell/Shell.dc.html` (etag `1791305527647556`), not edited; D2's `shell/shell-190-navigation.css` (etag `1791305250083620`); and D1's `ui/tokens.css` (etag `1791221436225089`) and `ui/ui-189-tokens-page.css` (etag `1791221436079789`). These etags equal the ones in the D1 and D2 records. The page loads IBM Plex Sans and IBM Plex Mono from Google Fonts and lucide 1.45.0 from unpkg with its integrity hash.

The variations page and its parts, `planning/planning-221-board-variations*`, are not part of the approval. They stay the variations round that [planning-221-board-variations.md](planning-221-board-variations.md) records.

## Page facts

| Fact | Value |
|---|---|
| Issue | [northMES/northmes#221](https://github.com/northMES/northmes/issues/221), plan task E08-S01-T01 |
| Owning story | E08-S01 ([northMES/northmes#88](https://github.com/northMES/northmes/issues/88)) |
| Waiting tasks | The UI tasks of E08-S01 to E08-S11 (#88 to #98) |
| Area | `planning`, built in `modules/planning/web` |
| Route | `/$plant/planning/board`, with the job order table at `?view=table`. The URL keeps `view`, `zoom`, `from` and `order`, without their defaults |
| Persona | Planner. Alex Lund is signed in; Erik Sand and Lena Ek are the other planners |
| Shell | `shell/Shell.dc.html` from D2, mounted read-only through `planning/Shell.dc.html`, a byte-equal copy |
| Plan drawn | Acme AB, Plant A, Tue 3 Nov 2026 at 09:40 CET in week 45: 40 machines in 6 equipment groups. The Hours preset shows 06:00 to 18:00, and job order 1003.20 is moved in my draft and selected. BO18 and BO19 show the night of Sat 24 to Sun 25 Oct, when summer time ends |
| Tokens and components | D1, approved on 2026-10-05: every color is a D1 token, shadcn components, lucide 1.45.0 icons, IBM Plex Sans and Mono |
| Shared files | `planning-221-board.css`, `planning-221-board-data.js` and the parts `planning-221-board-grid`, `planning-221-board-notplaced` and `planning-221-board-inspector`, which every row mounts |

## Direction and decisions

Krister Johansson chose the direction on 2026-10-07 in the variations round ([planning-221-board-variations.md](planning-221-board-variations.md)). The header frame records it:

- Option A, a docked 320 px inspector beside the grid with the tabs Details, My draft and Large orders, plus option C's pinned Not placed row under the time header.
- The board side slot `planning/board/side/v1` becomes the inspector's Large orders tab instead of D2's separate column.
- From A the page takes the Zoom Toggle Group with Earlier, Now, Later and Go to date, and the full-width group bands.
- A review step comes only before saving my draft and before breaking a soft lock. This follows his decision of the same day on [northMES/northmes#222](https://github.com/northMES/northmes/issues/222) for the commands under WCAG 3.3.4.

The two additions the variations round asked for are drawn in row 1: Collapse panel (BO5) and the rule for 1280 with the assistant docked (BO6, BO7).

The page cites rule numbers such as 19.6 and 21.5 and decision ids such as D.7. They point into the rule list the page was built from, which is not in the design project. Ids such as PO-45 are rows of [plan 16, open questions](../../plan/16-open-questions.md).

## Rows

The page has a header frame, then one row per part file. The chips above the screens carry the frame ids.

| Row | Part file | Frames | What it shows |
|---|---|---|---|
| F0 Header | `planning/planning-221-board.dc.html` | F0 | Issue, chosen direction, rows, acceptance criteria, the frames per item of #221, assumptions, proposals, known limits and open questions |
| 1 Board | `planning/planning-221-board-board.dc.html` | BO1 to BO19 | The board at 1440, 1280 and 1920, each in light and dark; the inspector collapsed to its strip; the assistant docked at 1280, with the strip and with Details opened; the Day, Week and 4 weeks presets in light and dark; the night of the DST change in light and dark; groups collapsed with a proposed job order selected; BO12 gives every block state in text |
| 2 Interaction | `planning/planning-221-board-interact.dc.html` | IN1 to IN34 | The hover card by pointer and by focus, the links with lead time, the cluster popover, a pointer move into my draft and a refused one, keyboard move mode, the Actions menu, the Move dialog and its field error, Details not found, with a field error and with a server error, my soft lock warning and Extend, another planner's soft lock and breaking it with a reason, its errors, my soft lock broken, the Large orders tab, paused and failed, and the block fields slot; dark twins sit beside their light frames; IN20 holds the interaction build notes |
| 3 Draft, autoplan and page states | `planning/planning-221-board-draft-autoplan.dc.html` | DR1 to DR32 | My draft review, ready to save, Save stopped with its row statuses and the reason field, saved, Discard draft and a discarded row; autoplan queued, running, applied and failed, and every status line message; live updates paused and reconnecting; loading, no jobs in the range, nothing unplaced, no machines, the board could not be loaded, range too large, no access, stale connector data with Large orders failed, and the read-only timeline; dark twins of loading, empty and error; DR25 holds the build notes for the row |
| 4 Job table, 320, long strings, keyboard and focus | `planning/planning-221-board-table-narrow-keyboard.dc.html` | TA1 to TA21 | The job order table view in light and dark, at 320 with the Details sheet and Board options, the board and the table in German with a Finnish article in light and dark, Tab order on the board and in the table, arrow keys in the grid, focus after Move, Save and Break soft lock, the D1 focus ring on every board surface, and the sticky offsets; TA19 holds the build notes for rows 1 and 4 |

Where each item of the issue's frame list is drawn, as the header gives it:

| Item in #221 | Light | Dark |
|---|---|---|
| Machines grouped by equipment group with group colors and collapse, on a time axis in plant time; the four zoom presets; Earlier, Today and Later; non-working time shaded per machine | BO1, BO3, BO4, BO8, BO9, BO10, BO18 | BO2, BO11, BO13, BO14, BO15, BO16, BO17, BO19 |
| Job order blocks at least 24 px tall with the fields a planner chooses, every state in text and shape; narrow blocks merged into cluster targets that name their state counts | BO1, BO8, BO9, BO10, BO12, IN27 | BO2, BO11, BO15, BO16, BO17, IN28 |
| The hover card; the selected order's links with lead time | IN1, IN2, IN3, BO1 | IN21, BO2 |
| Moving a block by pointer into my draft, with snapping and frozen-window feedback; moving a block without dragging | IN4 to IN9, TA12 | IN22, IN23, IN24 |
| Other planners' locks live, and breaking a lock with a reason | IN10 to IN16, IN34, TA14 | IN25, BO2 (held block), DR14 (my soft lock warning), TA15 |
| The job order table view | TA1, TA3, TA7 | TA2, TA4, TA9, TA21 |
| Reviewing my draft and saving it; conflicts and row statuses after a save | DR1, DR2, DR3, DR5, DR6, DR30, DR31 | DR4, TA13 |
| Starting autoplan from the board and following its status; pausing live updates | DR7 to DR9, DR11 to DR13, IN18 | DR10, DR14 |
| The board side slot `planning/board/side/v1` and the block fields slot `planning/board/block-fields/v1` | IN17, IN18, IN19, IN29, DR13, DR23 | IN26, IN30 |
| Empty, loading, error and degraded states | DR15, DR17 to DR20, DR22 to DR24, DR32, IN31 to IN33 | DR16, DR21, DR26 to DR29 |
| Widths 1280, 1440, 1920 and a 320 reflow frame; one frame with long German or Finnish labels and data | BO3, BO1, BO4, BO6, BO7, TA3, TA5, TA6, TA7 | BO13, BO2, BO14, TA4, TA20, TA21 |
| Keyboard and focus frames | TA8, TA10, TA12, TA14, TA16, TA18 | TA9, TA11, TA13, TA15, TA17, IN23 |

A dark twin repeats its light frame with the dark tokens and names that frame in its chip. Single states inside an item, such as the refused drop (IN5) or the status line sheet (DR12), are drawn in one theme.

## Frames

Each chip gives the frame id, the state, the theme and the size. The PNGs were captured from the design page at device scale 1 in a 2400 by 1600 viewport, and each shows the frame with its chip and an 8 px margin. Every IN frame also holds a note, marked not part of the UI, and its PNG includes the note; the size in the table is the screen's. A PNG of every one of the 107 frames was captured, and this folder holds 27 of them: the header, the main states in light, three dark frames, the 320 reflow, the long strings, one keyboard frame and the three build notes frames. A frame marked "Not exported" has no PNG in this folder; [Frames without a PNG](#frames-without-a-png) lists them.

### Header

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| F0 | Header | Light, 1440 by 4316 | Issue, chosen direction, rows, acceptance criteria, frames per item, assumptions, proposals, known limits and open questions | [planning-221-board-f0-header.png](planning-221-board-f0-header.png) |

### Row 1, board

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| BO1 | Board | Light, 1440 by 900 | Hours preset, 1003.20 selected, Details in the docked inspector, Not placed row, autoplan applied | [planning-221-board-bo1-board-light-1440.png](planning-221-board-bo1-board-light-1440.png) |
| BO2 | Board | Dark, 1440 by 900 | As BO1 | [planning-221-board-bo2-board-dark-1440.png](planning-221-board-bo2-board-dark-1440.png) |
| BO3 | Board | Light, 1280 by 800 | Earlier and Later keep only their icons; the grid keeps 638 px beside the inspector | Not exported |
| BO4 | Board | Light, 1920 by 1080 | The grid keeps 1278 px; Finishing collapsed, Assembly in view | Not exported |
| BO5 | Inspector collapsed | Light, 1440 by 900 | Collapse panel leaves the 48 px strip; the soft lock warning moves to the status line; the grid keeps 1070 px | [planning-221-board-bo5-inspector-collapsed-light-1440.png](planning-221-board-bo5-inspector-collapsed-light-1440.png) |
| BO6 | Assistant docked at 1280 | Light, 1280 by 800 | Open, the inspector would leave the grid 278 px, under 480, so it shows as its strip; the toolbar folds into Board options | [planning-221-board-bo6-assistant-docked-at-1280-light-1280.png](planning-221-board-bo6-assistant-docked-at-1280-light-1280.png) |
| BO7 | Assistant docked at 1280, Details opened | Light, 1280 by 800 | Details expanded: grid 278 px, machine column at its 40 percent cap, soft lock warning above the tabs | Not exported |
| BO8 | Day preset | Light, 1440 by 900 | Three production days, ticks every 6 h, steps of 1 h; Press 3 is off all of Wed 4 Nov | Not exported |
| BO9 | Week preset | Light, 1440 by 900 | Blocks under 24 px merge into clusters per day, steps of 4 h; the now label names the day on the top tier | [planning-221-board-bo9-week-preset-light-1440.png](planning-221-board-bo9-week-preset-light-1440.png) |
| BO10 | 4 weeks preset | Light, 1440 by 900 | Clusters per week with their counts, steps of 1 day | Not exported |
| BO11 | Groups collapsed | Dark, 1440 by 900 | Milling and Turning collapsed, Finishing expanded; 1011.10, proposed by the assistant, selected | Not exported |
| BO12 | Board states in text | Light, 1440 by 1530 | Not part of the UI: each state as BO1 draws it and as its accessible name reads | [planning-221-board-bo12-board-states-in-text-light-1440.png](planning-221-board-bo12-board-states-in-text-light-1440.png) |
| BO13 | Board | Dark, 1280 by 800 | As BO3 | Not exported |
| BO14 | Board | Dark, 1920 by 1080 | As BO4 | Not exported |
| BO15 | Day preset | Dark, 1440 by 900 | As BO8 | Not exported |
| BO16 | Week preset | Dark, 1440 by 900 | As BO9 | Not exported |
| BO17 | 4 weeks preset | Dark, 1440 by 900 | As BO10 | Not exported |
| BO18 | Night of the DST change | Light, 1920 by 1080 | Sat 24 Oct 18:00 CEST to Sun 25 Oct 06:00 CET, 13 hours: 02:00 shows twice, and the plant day Sun 25 Oct has 25 hours | [planning-221-board-bo18-night-of-the-dst-change-light-1920.png](planning-221-board-bo18-night-of-the-dst-change-light-1920.png) |
| BO19 | Night of the DST change | Dark, 1920 by 1080 | As BO18 | Not exported |

### Row 2, interaction

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| IN1 | Hover card | Light, 1440 by 900 | The pointer rests on 1008.10, which overlaps 1009.10, and the card lists every hover field | [planning-221-board-in1-hover-card-light-1440.png](planning-221-board-in1-hover-card-light-1440.png) |
| IN2 | Hover card on focus | Light, 1440 by 900 | Keyboard focus on 1001.20, started: the card opens at once | Not exported |
| IN3 | Links with lead time | Light, 1440 by 900 | Order 1014 selected: links from both halves on CNC1 and CNC2 to 1014.20, lead time 30 min | Not exported |
| IN4 | Pointer move into my draft | Light, 1440 by 900 | 1013.10 dragged to 10:30 on Mill 2: origin slot, snap line, tooltip and the frozen window | [planning-221-board-in4-pointer-move-into-my-draft-light-1440.png](planning-221-board-in4-pointer-move-into-my-draft-light-1440.png) |
| IN5 | Pointer move refused | Light, 1440 by 900 | The same drag over Lathe 3, which this operation may not use | Not exported |
| IN6 | Keyboard move mode | Light, 1440 by 900 | M on 1003.20, then one Right step: the preview at 11:45, focus on the moving block | Not exported |
| IN7 | Actions menu in Details | Light, 1440 by 900 | Actions for 1003.20 in Details opens the block menu, focus on Move | Not exported |
| IN8 | Move dialog | Light, 1440 by 900 | Move opens the Move dialog with every allowed machine; focus on the current machine | [planning-221-board-in8-move-dialog-light-1440.png](planning-221-board-in8-move-dialog-light-1440.png) |
| IN9 | Move dialog field error | Light, 1440 by 900 | Move with an invalid start: the error summary takes focus | Not exported |
| IN10 | Soft lock warning | Light, 1440 by 900 | 20 s before the soft lock on order 1003 ends; Extend reached with one Tab | Not exported |
| IN11 | Soft lock extended | Light, 1440 by 900 | After Extend the warning closes and focus moves to the Details tab | Not exported |
| IN12 | Soft lock warning, panel collapsed | Light, 1440 by 900 | Panel collapsed to its strip: the warning and Extend sit in the status line | Not exported |
| IN13 | Another planner's soft lock | Light, 1440 by 900 | Erik Sand holds the soft lock on order 1007, shown live; Break soft lock focused | Not exported |
| IN14 | Break soft lock, review step | Light, 1440 by 900 | Break soft lock opens the review step with a required reason | Not exported |
| IN15 | Break soft lock, reason error | Light, 1440 by 900 | Break soft lock with a reason that is too short | Not exported |
| IN16 | My soft lock broken | Light, 1440 by 900 | Lena Ek broke the soft lock on order 1016: what Alex Lund sees and hears | Not exported |
| IN17 | Large orders tab | Light, 1440 by 900 | The side slot as the Large orders tab, with its contribution | [planning-221-board-in17-large-orders-tab-light-1440.png](planning-221-board-in17-large-orders-tab-light-1440.png) |
| IN18 | Large orders while paused | Light, 1440 by 900 | Live updates paused: the contribution receives paused | Not exported |
| IN19 | Large orders fallback | Light, 1440 by 900 | The contribution failed: the WidgetFrame fallback inside the tab | Not exported |
| IN20 | Interaction build notes | Light, 4480 wide | Components, roles, slots, messages, copy and proposals for IN1 to IN19 and IN21 to IN34 | [planning-221-board-in20-interaction-build-notes-light.png](planning-221-board-in20-interaction-build-notes-light.png) |
| IN21 | Hover card | Dark, 1440 by 900 | As IN1 | Not exported |
| IN22 | Pointer move into my draft | Dark, 1440 by 900 | As IN4 | Not exported |
| IN23 | Keyboard move mode | Dark, 1440 by 900 | As IN6 | Not exported |
| IN24 | Move dialog | Dark, 1440 by 900 | As IN8 | Not exported |
| IN25 | Break soft lock, review step | Dark, 1440 by 900 | As IN14 | [planning-221-board-in25-break-soft-lock-review-step-dark-1440.png](planning-221-board-in25-break-soft-lock-review-step-dark-1440.png) |
| IN26 | Large orders tab | Dark, 1440 by 900 | As IN17 | Not exported |
| IN27 | Cluster popover | Light, 1440 by 900 | Enter on the Press 4 cluster opens its popover; focus on the first row's Move | Not exported |
| IN28 | Cluster popover | Dark, 1440 by 900 | As IN27 | Not exported |
| IN29 | Block fields slot | Light, 1920 by 1080 | The Pyramid connector's contribution to `planning/board/block-fields/v1` on four blocks; its hover fields in the card and in Details | Not exported |
| IN30 | Block fields slot | Dark, 1920 by 1080 | As IN29 | Not exported |
| IN31 | Details, order not in range | Light, 1440 by 900 | The URL names order 1099, which has no job order in this range | Not exported |
| IN32 | Details, field error | Light, 1440 by 900 | Apply with an invalid start: the error summary in Details takes focus | Not exported |
| IN33 | Details, move not added | Light, 1440 by 900 | Apply failed on the server: the Alert keeps every value | Not exported |
| IN34 | Break soft lock, server error | Light, 1440 by 900 | Break soft lock failed on the server; the reason is kept | Not exported |

### Row 3, draft, autoplan and page states

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| DR1 | My draft review | Light, 1440 by 900 | Save opened My draft: six rows with their statuses, Rebase 1015.10 focused; Wed 4 Nov shows two statuses on blocks | [planning-221-board-dr1-my-draft-review-light-1440.png](planning-221-board-dr1-my-draft-review-light-1440.png) |
| DR2 | Ready to save | Light, 1440 by 900 | Four rows ready after the rebases and discards; Save 4 changes names what it writes and has focus | Not exported |
| DR3 | Save stopped | Light, 1440 by 900 | Save at 09:39 wrote nothing: 1015.10 changed again, 1003.20 needs a reason; focus on the summary | [planning-221-board-dr3-save-stopped-light-1440.png](planning-221-board-dr3-save-stopped-light-1440.png) |
| DR4 | Save stopped | Dark, 1440 by 900 | As DR3, after the summary link Reason for 1003.20: the panel scrolled, the reason field has focus | [planning-221-board-dr4-save-stopped-dark-1440.png](planning-221-board-dr4-save-stopped-dark-1440.png) |
| DR5 | Save needs a reason | Light, 1440 by 900 | 1015.10 rebased; Save with an empty reason shows the field error; focus on the reason | Not exported |
| DR6 | Saved | Light, 1440 by 900 | 4 changes saved at 09:40, their soft locks released; My draft is empty; 1003.20 shows as committed | Not exported |
| DR7 | Autoplan queued | Light, 1440 by 900 | Run autoplan pressed, focus stays on it; the status line reads queued | Not exported |
| DR8 | Autoplan running | Light, 1440 by 900 | The status line follows the run; the board and my draft stay usable | Not exported |
| DR9 | Autoplan applied | Light, 1440 by 900 | The result with its five counts; the board shows the new plan | [planning-221-board-dr9-autoplan-applied-light-1440.png](planning-221-board-dr9-autoplan-applied-light-1440.png) |
| DR10 | Autoplan applied | Dark, 1440 by 900 | As DR9 | Not exported |
| DR11 | Autoplan failed | Light, 1440 by 900 | The plan changed during autoplan 3 times, so nothing moved | Not exported |
| DR12 | Status line messages | Light, 1136 by 958 | Every autoplan, pause and reconnect message at the content width of 1440 | Not exported |
| DR13 | Live updates paused | Light, 1440 by 900 | Resume live updates has focus; 12 changes waiting; Large orders gets paused | [planning-221-board-dr13-live-updates-paused-light-1440.png](planning-221-board-dr13-live-updates-paused-light-1440.png) |
| DR14 | Live updates paused | Dark, 1440 by 900 | My own autoplan result applied by id while paused; the soft lock warning still shows | Not exported |
| DR15 | Reconnecting | Light, 1440 by 900 | The shell's chip; Resume live updates disabled and moves off; the grid is read only | Not exported |
| DR16 | Reconnecting | Dark, 1440 by 900 | As DR15; the disabled Resume live updates stays focusable and names why | Not exported |
| DR17 | Loading | Light, 1440 by 900 | Skeletons of the grid and of Details in the same layout; main and the grid carry aria-busy | [planning-221-board-dr17-loading-light-1440.png](planning-221-board-dr17-loading-light-1440.png) |
| DR18 | No jobs in this range | Light, 1440 by 900 | Sun 8 Nov: every machine keeps its row with the empty cell; Not placed still lists 3 | Not exported |
| DR19 | No machines to plan | Light, 1440 by 900 | First run at a plant without plannable equipment, as a planner sees it | Not exported |
| DR20 | Board could not be loaded | Light, 1440 by 900 | ErrorState with the error id, Try again and the job table as a way out | [planning-221-board-dr20-board-could-not-be-loaded-light-1440.png](planning-221-board-dr20-board-could-not-be-loaded-light-1440.png) |
| DR21 | Range too large | Dark, 1440 by 900 | 4 weeks holds too many job orders: `planning.board.range_too_large` with a shorter range | Not exported |
| DR22 | No access | Light, 1440 by 900 | Forbidden: names the missing permission and shows no data | Not exported |
| DR23 | Connector data stale, Large orders failed | Light, 1440 by 900 | The header slot names the old import; the Large orders fallback with Try again focused | Not exported |
| DR24 | Read-only timeline | Light, 1440 by 900 | The SP3 fallback: the grid is read only; moves go through Details and the job table | Not exported |
| DR25 | Draft, autoplan and page state build notes | Light, 1440 wide | Components, roles, focus, messages, copy and WCAG for DR1 to DR32 | [planning-221-board-dr25-draft-autoplan-and-page-state-build-notes-light-1440.png](planning-221-board-dr25-draft-autoplan-and-page-state-build-notes-light-1440.png) |
| DR26 | Loading | Dark, 1440 by 900 | As DR17 | Not exported |
| DR27 | No jobs in this range | Dark, 1440 by 900 | As DR18 | Not exported |
| DR28 | No machines to plan | Dark, 1440 by 900 | As DR19 | Not exported |
| DR29 | Board could not be loaded | Dark, 1440 by 900 | As DR20 | Not exported |
| DR30 | Discard draft, review step | Light, 1440 by 900 | Discard draft asks first; focus on Cancel (proposed) | Not exported |
| DR31 | Row discarded, Undo | Light, 1440 by 900 | Discard on 1019.20 keeps the row with Undo until the next Save; the tab scrolled to it, focus on Undo (proposed) | Not exported |
| DR32 | No jobs in this range, nothing unplaced | Light, 1440 by 900 | The Not placed row keeps one cell, No job orders without a place, which holds the grid's Tab stop | Not exported |

### Row 4, job table, 320, long strings, keyboard and focus

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| TA1 | Job table | Light, 1440 by 900 | Sorted by machine; 1003.20 selected; late facts of 1012.30 open; inspector collapsed | [planning-221-board-ta1-job-table-light-1440.png](planning-221-board-ta1-job-table-light-1440.png) |
| TA2 | Job table, late only | Dark, 1440 by 900 | Late only, sorted by Late by; Details of 1012.30 open; table scrolled to its end | Not exported |
| TA3 | Job table | Light, 320 by 640 | The job order table view at 320: Earlier, Now, Later and the date, Table options, the My draft link, Late only, and the table in its own scroller above the pager | [planning-221-board-ta3-job-table-light-320.png](planning-221-board-ta3-job-table-light-320.png) |
| TA4 | Details sheet | Dark, 320 by 640 | The Details sheet over the job table at 320 | Not exported |
| TA5 | Board options | Light, 320 by 640 | Board options open at 320: Go to date, Zoom, Pause live updates and Show job table | Not exported |
| TA6 | Board, long strings | Light, 1440 by 900 | German chrome and data, a Finnish article, labels at full length | [planning-221-board-ta6-board-long-strings-light-1440.png](planning-221-board-ta6-board-long-strings-light-1440.png) |
| TA7 | Job table, long strings | Light, 1440 by 900 | German column names, machines, groups and articles at full length | Not exported |
| TA8 | Tab order, board | Light, 1440 by 900 | Badges number the Tab stops in DOM order; toolbar, grid and tab list are one stop each | [planning-221-board-ta8-tab-order-board-light-1440.png](planning-221-board-ta8-tab-order-board-light-1440.png) |
| TA9 | Tab order, job table | Dark, 1440 by 900 | Stop 1 is the hidden skip link; rows below the fold keep their numbers without a badge | Not exported |
| TA10 | Arrow keys in the grid | Light, 1160 by 674 crop of the board at 1440 | Focus on 1002.10 | Not exported |
| TA11 | Between rows, groups and Not placed | Dark, 1160 by 674 crop of the board at 1440 | Rows scrolled to Lathe 1; focus on 1017.10 | Not exported |
| TA12 | Focus after Move | Light, 1510 by 560 crop of the board at 1440 | 1003.20 placed on Lathe 2 and focused | Not exported |
| TA13 | Focus after Save | Dark, 738 by 640 crop of the inspector | The inspector column after Save 4 changes | Not exported |
| TA14 | Break soft lock, the trigger | Light, 738 by 640 crop of the inspector | 1007.10 held by Erik Sand | Not exported |
| TA15 | After breaking the soft lock | Dark, 738 by 420 crop of the inspector | The move fields of Details | Not exported |
| TA16 | D1 focus ring on board surfaces | Light, 1440 by 900 | 2 px focus-outline over a 2 px focus-ring; letters name the surfaces | Not exported |
| TA17 | D1 focus ring on board surfaces | Dark, 1440 by 900 | The same surfaces as TA16 | Not exported |
| TA18 | Focus not obscured by the sticky axes | Light, 1160 by 600 crop of the board at 1440 | Rows scrolled; focus on 1003.10 under the pinned rows | Not exported |
| TA19 | Build notes | Light, 1440 by 6680 | Table view, 320 reflow, long strings, keyboard and focus | [planning-221-board-ta19-build-notes-light-1440.png](planning-221-board-ta19-build-notes-light-1440.png) |
| TA20 | Board, long strings | Dark, 1440 by 900 | As TA6 | Not exported |
| TA21 | Job table, long strings, scrolled to the end | Dark, 1440 by 900 | TA7 scrolled to its end: Geplantes Ende, Verspätung and the open late facts | Not exported |

### Frames without a PNG

- Dark twins of a light frame, with the same layout and the D1 dark tokens: BO13 to BO17, BO19; IN21 to IN24, IN26, IN28, IN30; DR10, DR16, DR26 to DR29; TA17, TA20. BO2, IN25 and DR4 show the dark theme in this folder.
- Dark frames with a state of their own: BO11, DR14, DR21, TA2, TA4, TA9, TA11, TA13, TA15 and TA21.
- Light frames: BO3, BO4, BO7, BO8, BO10; IN2, IN3, IN5 to IN7, IN9 to IN16, IN18, IN19, IN27, IN29, IN31 to IN34; DR2, DR5 to DR8, DR11, DR12, DR15, DR18, DR19, DR22 to DR24, DR30 to DR32; TA5, TA7, TA10, TA12, TA14, TA16 and TA18. The review step of IN14 is in this folder as its dark twin IN25.

These frames were left out to keep this record at 27 PNGs and under 9 MB. The design page holds all of them.

## Build notes

Four frames hold notes, marked on the page as not part of the UI: BO12 for the block states and the board's rules, IN20 for row 2, DR25 for row 3 and TA19 for rows 1 and 4. This section summarises them. A line marked proposed is not in the docs and needs Krister Johansson's yes.

### Block states (BO12)

Each job order block shows its states by an icon at the trailing edge, a border marker and, for conflicts and started job orders, a stripe or a bar. The fill is always the order color, so color never carries a state alone. The words below are the parts of each block's accessible name that the grid builds through aria-labelledby; the hover card and the Details tab show the same states as badges.

| State | Example in BO1 | Shape and icon besides color | Words in the accessible name |
|---|---|---|---|
| Committed | 1002.10 Bracket L on CNC2 | None: the order color fill and a 1 px border | No state words: 1002.10 Bracket L, 1 200 pcs, CNC2, Tue 3 Nov 09:45 to 12:15 |
| In my draft | 1003.20 Shaft 40 on Lathe 2 | Pencil, double border | changed in your draft, not saved |
| Held by another planner | 1007.10 Flange DN50 on Lathe 3 | Initials ES, dashed border | being edited by Erik Sand since 09:12 |
| Hard-locked | 1005.10 Housing P on Mill 1 | Lock, solid 2 px inner border | locked |
| Started | 1001.20 Housing P on CNC1 | Play, progress bar along the bottom | started, 40 of 120 pcs |
| Proposed | 1011.10 Cover plate on Press 4 | Sparkles, dotted border | proposed by assistant, not reviewed |
| Conflict | 1008.10 and 1009.10 on Press 3 | Striped right edge; overlapping job orders stack in a 68 px row | overlaps 1009.10 |
| Late | 1012.30 Hub 12 on Lathe 1 | Clock | late by 2 days |
| Overdue | 1006.10 Hub 12 on Mill 2 | ClockAlert | overdue, planned 07:00, not started |
| Finish pending | 1004.10 Gear blank 32 on CNC2 | CircleCheckBig | finish pending, 1 200 of 1 200 pcs reported |
| Material warning | 1013.10 Spacer 8 on Mill 2 | TriangleAlert | material short |
| Cluster | Press 4, 10:00 to 10:40 | A target of at least 24 by 24 px with the count; Layers from 40 px wide | 4 jobs, 10:00 to 10:40, 2 late, 1 being edited by Erik Sand |
| Not placed | 1024.20 Hub 12 in the Not placed row | A 28 px chip with a solid border, in the pinned row under the time header | 1024.20 Hub 12, 1 200 pcs, not placed |
| Contribution field | 1012.30 Hub 12 in IN29 | The contribution's icon and short text at the trailing edge, after the state icons | The contribution's accessibleText: pending ERP change, quantity 480 to 600 pcs |

### Board rules (BO12)

- Blocks are at least 24 px tall; a block under 24 px wide joins a cluster with its neighbours.
- Machine rows are 52 px and two-line blocks 43 px, so the second line ends above the progress bar and the inner border markers. The Not placed row stays 46 px.
- In each machine row the gridcells follow time order, blocks and clusters together, so the arrow keys and a screen reader meet them left to right.
- The time area starts 4 px after the machine column, so a block at the range start keeps its whole focus ring.
- Hour ticks come from exact instants: on the night of Sun 25 Oct 02:00 shows twice, as 02:00 CEST and 02:00 CET, and the plant day 2026-10-25 has 25 hours (BO18, BO19).
- At Week and 4 weeks the now label names the day on the top tier, so every day label stays; at Hours and Day it replaces the hour labels it would touch.
- One border marker per block, in the order hard-locked, held, in my draft, proposed. The icons of every state still show.
- The selection is a 3 px bar on the top edge of every job order of the selected order, apart from the focus ring.
- Non-working time is hatched per machine calendar.
- Group bands span the grid with the disclosure button, the group color dot, the name and the machine count; a machine row header carries a 6 px stripe in the group color.
- The Not placed row stays under the time header while the machine rows scroll; chips that do not fit fold into the last cell.
- The inspector docks beside the grid and narrows it; it never covers a focused block. Collapse panel ends its tab row.
- Proposed: the machine column fits the longest name from 168 px to 272 px and never takes more than 40 percent of the grid; under 120 px the Not placed row header wraps and drops its icon.
- Proposed: block density is full from 120 px (job number, article and markers; quantity and end), compact from 66 px (job number and markers; quantity), and under 66 px a bar without text. The name, the hover card and Details keep every word.

### Components

Names are shadcn names.

| Component | Where | What the frames fix |
|---|---|---|
| Table, DataTable (TanStack Table v9) | Job table, TA1 to TA4, TA7, TA9, TA21; the Move dialog's machine list | A semantic table with a visually hidden caption, th scope col, a sort button in each sortable header and aria-sort on the sorted one only. The Job order and Actions columns stick to the edges when the table scrolls sideways, and its scroller keeps visible scrollbars. Server paging through the Relay connection, 25 rows a page, no row virtualization |
| Button | Toolbars, row Move, pager, inspector, My draft, dialogs | Default, outline, ghost and destructive (Break soft lock). A Move that cannot run, and Save changes while rows need action, keep their place with aria-disabled, stay focusable and name the reason through aria-describedby |
| Toggle Group | Zoom on the board, Range in the job table | Hours, Day, Week, 4 weeks with aria-pressed, labelled by the word before it; its items join the toolbar's arrow key order |
| Checkbox | Late only | 16 px box in a 24 px hit area, as D1 draws it |
| Collapsible | Late facts of a row | A 28 px disclosure button in the Late by cell with aria-expanded, and aria-controls while the facts row is open |
| Dropdown Menu, Context Menu | Board options and Table options at 320, row Actions, the block menu, Actions in the Details heading (IN7) | Board options holds Go to date, the presets as radio items under Zoom, Pause live updates and Show job table; Table options the same with Range and Show board. The Context Menu holds the block menu's items on a right click |
| Tabs | Inspector | Details, My draft and Large orders; the selected tab is the list's one Tab stop. The My draft tab names its count in words, My draft, 6 changes, and its panel opens with a heading at level 2 |
| Sheet | Inspector at 320 | Modal, named by its heading; Close details takes focus on open |
| Hover Card | The block card, IN1 and IN2 | Open delay 700 ms, close delay 300 ms (proposed) |
| Dialog | The Move dialog, IN8 and IN9 | 640 px wide (proposed), shared with the job order table view |
| Radio Group | The machine choice in the Move dialog | Not in D1's component table, so its unchecked, checked and focused states are drawn here (question for D1) |
| Alert Dialog | Break soft lock (IN14, IN15), Discard draft (DR30) | Break soft lock goes through ConfirmDialog with a required reason of 3 to 500 characters. Discard draft is named by its title and described by its text, focus on Cancel (proposed) |
| Popover | The cluster popover, IN27 and IN28 | A dialog with one row per job order, each with Move and an Actions menu button |
| Alert | Soft lock warning, held note, server errors, Saved, Save result | Warning tone for the soft lock warning, info tone for the held note in Details, destructive tone for the server errors (IN33, IN34), success for Saved and an error summary for the Save result |
| Badge | Job table Status column, draft rows, block states | Job table: Planned, Started and Finish pending first, then the board's state badges (In my draft, not saved; Overlaps; Locked; Proposed by assistant; Overdue; Material short; ERP change waiting). Draft rows: Ready to save, Changed by someone else, Soft lock lost, Started, ERP change waiting, No longer in the plan, Needs a reason, Discarded. Always text, never color alone |
| Tooltip | Strip of the collapsed inspector | Opens on focus and hover, to the left of the strip |
| Select, Input, Textarea, Label | Machine and Start in Details and in the Move dialog, Reason | D1's error state and error summary; Reason requires 3 to 500 characters |
| Skeleton | Loading, DR17 and DR26 | Grid rows, Not placed chips and the Details tab keep the populated layout; skeletons are aria-hidden |
| EmptyState | No jobs in this range (DR18, DR27, DR32), no machines to plan (DR19, DR28) | No jobs keeps every machine row with one cell; no machines replaces the board with a heading, a sentence and Open Machines |
| ErrorState | Board could not be loaded (DR20, DR29), range too large (DR21), no access (DR22) | A heading at level 2, the error id or code, Try again and a way out to the job table |
| Pagination | Pager of the job table | Previous and Next only, with Rows 1 to 25 of 105; keyset paging, no page numbers. At 320 icon buttons named Previous page and Next page |

### Tokens

- Every color in the frames is a D1 token. TA19 lists card, muted, muted-foreground, border and input for the table; info-subtle for the selected row and foreground for its 3 px bar; link for the job order buttons and the My draft link; the status tokens and late for badges; focus-outline and focus-ring for the ring; lane, lane-alt, off-time, block-border, now and the palette on the board. IN20 also names popover, destructive, destructive-subtle, warning, warning-subtle and primary. The frames add no token, and the dialog overlay is D2's `.sh-ov`.
- Values that are not tokens are proposals: the 3 px selection bar, the 2 px frozen and snap lines, the 48 px strip, 52 px machine rows and the 4 px gutter before the time area; in the job table 44 px rows, a 38 px header row, 28 px disclosure buttons and 32 px row buttons. Row heights follow rem, so 200 percent text grows them.
- The order palette rule from D1: a block's fill is always its order's color, one of palette-1 to palette-20 or any color the ERP or a planner sets, passed as a CSS variable and never as a class per color. Text on the fill is pure black or pure white from textColorFor, at least 4.58:1 on any sRGB color. Every block has a 1 px block-border and a 1 px gap. Color groups orders and never carries a state.
- The job table shows no order color. The selected row has the 3 px bar and aria-current besides its tint.
- Only the color swatch components use forced-color-adjust: none.

### Roles and names

| Element | Role and properties |
|---|---|
| Board | role grid with a roving tabindex, never role application (ADR 0021, plan 06). Named "Plant A board, Tue 3 Nov 06:00 to 18:00"; aria-rowcount; aria-busy while loading; aria-readonly while moves are off (reconnecting and the read-only timeline) |
| Time header | A row with aria-rowindex 1 and columnheader cells; the corner reads Machines, 40 in 6 groups |
| Not placed row | A row with aria-rowindex 2: a rowheader named Not placed, 3 job orders and one gridcell per chip |
| Group band | A row whose rowheader holds the disclosure button with aria-expanded and tabindex -1 |
| Machine row | A row with aria-rowindex: a rowheader with the machine name and the Jobs on this machine button (tabindex -1), then one gridcell per job order in time order |
| Job order | A gridcell named through aria-labelledby from the job number, the article with lang and a hidden span with times and states; aria-selected on the selected order's job orders; no interactive children |
| Cluster | A gridcell with aria-haspopup dialog, and aria-expanded with aria-controls while its popover is open. The popover is role dialog named by its heading; focus starts on the first row's Move, and Escape returns it to the cluster |
| Hover card and drawings | The hover card is drawn for sighted users only; the block's name and Details carry the same facts. The move hint, tooltip, snap line, origin slot and link overlay are aria-hidden |
| Toolbar | role toolbar named Board, or Job table in the table view: one Tab stop, arrow keys inside. The presets are a group labelled Zoom (Range in the table view), each item with aria-pressed |
| Status line | No live role; its messages go through announce() |
| Job table | In the build a native table with a caption and th scope col; aria-sort only on the sorted header; the selected row carries aria-current true. The frames draw the same structure with the roles table, row, columnheader and cell |
| Inspector | A section named Board panel with tablist, tab and tabpanel; collapsed, a section with buttons and tooltips; at 320 a dialog with aria-modal, named by its heading |
| Options menus | menu with menuitem; the presets are menuitemradio with aria-checked inside a group labelled Zoom or Range |
| Actions menu | role menu named "Actions for 1003.20"; the trigger has aria-haspopup="menu" and aria-expanded; Escape returns focus to it |
| Move dialog | role dialog, aria-modal, named by its title and described by its first line. Machine is a radiogroup; each radio is named by its machine and described by its Ends and Overlaps cells. Start has aria-invalid and aria-describedby for its error |
| Break soft lock | role alertdialog, aria-modal, named by its title and described by its text. Reason is required, with aria-invalid and aria-describedby for its error and hint |
| Discard draft dialog | role alertdialog, aria-modal, named by "Discard all 6 changes?" and described by its text; the page behind is inert |
| Save result | The heading "Nothing was saved" and an error summary with tabindex -1, which takes focus and links to each row that needs action; a link moves focus to its control |
| Resume live updates while reconnecting | aria-disabled, focusable, described by "Moves are off until live updates are back." |
| WidgetFrame | A region named by the contribution's heading; its fallback is a group with tabindex -1 |
| Page state panels | The EmptyState and ErrorState lead is a heading at level 2 under the h1 Planning board; the error id and code are text that can be copied |

Error summaries take focus on submit and link to their field (plan 06, WCAG 3.3.1). Dialogs return focus to their trigger on Cancel and Escape.

### Keyboard model

| Where | Keys | What happens | Focus after |
|---|---|---|---|
| Board grid | Tab, Shift+Tab | Tab enters at the selected job order, else at the first job order of the first expanded machine row nearest the now line (proposed), and the next Tab leaves the grid | On that cell |
| Board grid | Left, Right, Home, End | Along the row in time order; Home and End go to the first and last job order of the row in the loaded range. Left from the first reaches the row header button | The cell reached |
| Board grid | Up, Down | To the next machine row, skipping group bands and collapsed groups: the job order that runs at the focused one's start, else the one that starts nearest (proposed). Up from the first machine row reaches the Not placed row | The cell reached |
| Row header column | Up, Down, Enter, Space, Right | Up and Down through the row headers and the group bands' buttons; Enter or Space collapses or expands a group; Right returns to the first job order in view (proposed) | The button reached |
| Board grid | Page Up, Page Down | By the machine rows in view, to the job order nearest in time | The cell reached |
| Board grid | Enter | Opens Details in the inspector, expanding a collapsed column; at 320 opens the sheet | Stays on the job order (proposed); at 320 Close details |
| Board grid | M | Move mode: Left and Right one snap step, Up and Down allowed machines, Enter commits, Escape cancels | The moving job order, then the placed one by id |
| Board grid | Shift+F10, context menu key | The block menu: Move, Lock or Unlock, Break soft lock on another planner's order, Open order | First menu item; back on the job order on close |
| Board grid | Escape | Closes the hover card, a popover, move mode, then clears the selection | Stays |
| Toolbar | Tab, Left, Right, Home, End, Enter, Space | One Tab stop; arrow keys move across Earlier, Now, Later, Go to date, the presets and Pause live updates | The control reached |
| Inspector | Tab, Left, Right | The tab list is one stop and arrow keys move between tabs; Collapse panel follows the tab list in DOM order | The tab reached |
| Job table | Tab, Enter, Space | Header sort buttons, then per row the job order button, the late facts button, Move and Actions, then the pager. A header sorts and keeps focus. The job order button opens Details | Stays on the control |
| Job table | Space on Late only | Filters the table; a search change never moves focus | Stays on the checkbox |

M and the other letter commands work only while a board cell has focus (WCAG 2.1.4). A drag commits on pointer up and Escape cancels it.

### Focus after an action

| Action | Focus goes to |
|---|---|
| Move from the dialog or move mode | The job order by id at its new place (TA12); its hover card opens at once. In the job table, the row's Move button, following the row by id |
| Save in the top bar | The My draft tab's heading, the column expanded if it was collapsed (DR1) |
| Save that wrote nothing | The error summary (DR3); the summary link Reason for 1003.20 moves it to the field (DR4) |
| Save with an empty reason | The reason field, with its error (DR5) |
| Save that wrote every change | The heading No changes in your draft (DR6, TA13, proposed) |
| Back to my draft | The My draft tab's heading |
| Discard draft | Cancel in the dialog (DR30). Discard 6 changes empties the draft and moves focus to No changes in your draft; Cancel and Escape return it to Discard draft (proposed) |
| Discard on a row | Undo on the same row (DR31); Undo puts the row back and moves focus to its Discard (proposed) |
| Run autoplan | Stays on Run autoplan (DR7) |
| Pause and Resume live updates | Stays on the button, which changes its label (DR13) |
| Try again on an ErrorState | Stays on Try again while the board loads again, then on the board's Tab stop |
| Extend on the soft lock warning | The Details tab (IN11, proposed) |
| Break soft lock confirmed | Machine in Details, since the button goes away (TA15, proposed); the job order when the dialog came from the block menu |
| Break soft lock cancelled | The Break soft lock button (TA14) |
| Collapse panel, Expand panel | Expand panel in the strip; the selected tab after expanding |
| A strip button | That tab in the expanded column |
| Close details at 320 | The job order or the table row that opened the sheet |
| Previous to the first page | Next, since Previous becomes disabled and is skipped (proposed) |
| A focused job order moved by someone else | The nearest job order in the same row, with a polite message |

### Focus not obscured and reflow

- The board scroller sets scroll-padding-top to the time header plus the Not placed row plus 8 px (102 px at the drawn size) and scroll-padding-left to the machine column plus 8 px, and passes both to the virtualizers (TA18).
- The job table sets scroll-padding-top to its header row plus 8 px, and scroll-padding-left and scroll-padding-right to the sticky Job order and Actions columns plus 8 px.
- The inspector docks and narrows the grid at 1280 and up; at 320 it is a modal sheet. At 320 only the grid and the job table scroll in two directions, each in its own container, and the toolbar folds into Board options or Table options (TA3 to TA5). Toasts sit away from the board.

### Slots

| Slot | Kind and props | What a contribution may render |
|---|---|---|
| `planning/board/side/v1` | region; props plantId and paused | One WidgetFrame section labelled by the contribution's label, inside the inspector tab of the same name, 288 px wide; at 320 inside the sheet's tab. It renders its own content and controls inside its frame, never per block or per row, never over the grid. A failure renders the fallback "Large orders could not be shown. The rest of the board works as usual." with Try again, and focus that was inside moves to the fallback. While paused it receives paused and keeps its content still. Only the selected tab mounts its content (proposed) |
| `planning/board/block-fields/v1` | field; props plantId; items are the blocks of the loaded range | Per block, a synchronous render returns text, an optional icon and accessibleText; the board draws them at the trailing edge after the state icons, drops the text when there is no room, draws nothing in a bar, and adds accessibleText to the block's name. No interactive content and no WidgetFrame per block. A hover renderer may fetch; its fields show in the hover card and in Details under the contribution's label (IN29, IN30) |
| `planning/board/header/v1` | field; props plantId; one item | One line of text beside the h1, such as Pyramid data as of 06:40; it wraps at 320 |

### URL state

| Key | Values | Default, stripped | History |
|---|---|---|---|
| `view` | table | board | Push when switching views |
| `zoom` | hours, day, week, weeks | the default preset (open question 1) | Replace (proposed) |
| `from` | plant-local date, 2026-11-03 | the current production day | Replace; Earlier, Later, Now and Go to date |
| `order` | production order id, 1003 | none | Push, so Back closes Details |
| `sort` | machine, start, end, deadline, plannedEnd, lateBy, job; a minus sign for descending | machine (proposed names; the codegen SortField enum fixes them) | Replace |
| `late` | 1 | off | Replace; drops the cursor |
| `after`, `before`, `page` | cursor and page counter | first page | Replace |

Collapsed groups, move mode, paused live updates, the collapsed inspector, the inspector tab and open late facts rows never reach the URL. `/plant-a/planning/board?view=table&late=1&sort=-lateBy` opens TA2; `/plant-a/planning/board?zoom=week&from=2026-11-02&order=1003` opens the week with Details of order 1003.

### Accessible names

| What | Final English | Source the page gives |
|---|---|---|
| Grid | Plant A board, Tue 3 Nov 06:00 to 18:00 | Foundation |
| Job order | 1003.20 Shaft 40, 480 pcs, Lathe 2, Tue 3 Nov 11:30 to 14:45, changed in your draft, not saved, overlaps 1021.10 | Plan 07 pattern |
| Cluster | 4 jobs, 10:00 to 10:40, 2 late, 1 being edited by Erik Sand | Plan 07 pattern |
| Not placed chip | 1024.20 Hub 12, 1 200 pcs, not placed | Foundation, proposed |
| Row header button | Jobs on this machine, CNC2 | Foundation, proposed |
| Group band button | Collapse Milling; Expand Finishing | Foundation, proposed |
| Range buttons | Show earlier range; Show later range | Option A |
| Job table caption | Job orders, Tue 3 Nov 06:00 to 18:00; with Late only: Late job orders, Tue 3 Nov 06:00 to 18:00 | Proposed |
| Row buttons | 1003.20 (opens Details); Move 1003.20; Actions for 1003.20; Late facts for 1012.30 | Proposed |
| Move that cannot run, description | A started job order cannot move. Locked. Unlock it to move it. Erik Sand holds the soft lock on order 1007. | Proposed |
| Options at 320 | Board options; Table options | Option A; proposed for the table |
| Disabled Save changes, description | Resolve the 5 rows above to save. | DR25 |

### Announcements

Every message goes through announce(); the status line itself has no live role. A Save that wrote nothing moves focus to the error summary, which is read, and loading, empty and error states change no live region.

| Message, final English copy | Politeness | When | Frames |
|---|---|---|---|
| {machine}, {day} {start} to {end}. Not saved. | polite | Each move mode step, debounced to about 300 ms; adds "Starts in the frozen window." when it does (proposed) | IN6 |
| {job} moved to {machine}, {day} {start} to {end}. Not saved. | polite | After a drop, Enter in move mode, Apply or Move, with the server's times (wording proposed) | IN4, IN6, IN8 |
| Move cancelled. | polite | Escape in move mode or during a drag (proposed) | IN4, IN6 |
| Cannot move {job}: soft lock held by {name} since {time}. | assertive | A LOCKED result; the block returns | IN4 |
| Cannot move {job}: not allowed on {machine}. This operation runs on {group} machines. | assertive | A drop on a machine outside the operation's equipment (proposed) | IN5 |
| Your soft lock on order {order} ends in 20 s. | assertive | Once, when the warning appears (politeness proposed) | IN10, IN12 |
| Soft lock on order {order} extended. | polite | After Extend (proposed) | IN11, IN12 |
| Your soft lock on order {order} ended. Your moves stay in your draft. | polite | When the soft lock ends without Extend; the warning shows the same text (proposed) | IN10 |
| You hold the soft lock on order {order} now. {name} was told. | polite | After Break soft lock succeeds (proposed) | IN14 |
| {name} broke your soft lock on order {order} at {time}. Reason: "{reason}" | assertive | To the previous holder, also while paused; the status line keeps it (wording proposed) | IN14, IN16 |
| Soft lock on order {order} changed. {name} holds it now. | assertive | Break soft lock meets a stale expectedHolderId; the dialog closes and Details shows the new holder (proposed) | IN34 notes |
| Large orders could not be shown. | polite | Once, when the contribution fails and focus was elsewhere | IN19 |
| The move was not added to your draft. Try again. Error id {id}. | assertive | Apply or Move fails on the server; every value stays and focus stays on the button (politeness proposed) | IN33 |
| The soft lock was not broken. Try again. Error id {id}. | assertive | Break soft lock fails on the server; the reason stays and focus stays on Break soft lock (proposed) | IN34 |
| Autoplan queued at 09:38 by you. | polite | Run autoplan is accepted | DR7 |
| Autoplan already queued by Erik Sand at 09:36. It plans all of Plant A, so your request was not added. | polite | Run autoplan while another run waits | DR12 |
| Autoplan running. | polite | The run starts | DR8 |
| Autoplan applied at 09:39: 37 moved, 2 skipped because being edited, 3 late, 1 conflict, 0 unplaced. | polite | The run applies, also while live updates are paused | DR9, DR14 |
| Autoplan failed at 09:40: the plan changed during autoplan 3 times. Nothing moved. Run autoplan to try again. | polite | The run fails; the permission and budget failures in DR12 the same way | DR11 |
| Autoplan from 09:38 was superseded by a newer run. | polite | A newer run replaces it | DR12 |
| Live updates paused. 12 changes waiting. | polite | Pause live updates; the waiting count then updates without a message | DR13 |
| Live updates resumed. | polite | Resume live updates | DR25 |
| Moves are off until live updates are back. | polite | The socket drops; the shell announces its own chip | DR15 |
| 4 changes saved at 09:40. | polite | Save writes every change | DR6 |
| 6 changes discarded. | polite | Discard 6 changes in the dialog (proposed) | DR30 |
| 1019.20 discarded from your draft. Undo is on its row. | polite | Discard on a row (proposed) | DR31 |
| 1019.20 is back in your draft. | polite | Undo on a row (proposed) | DR31 |
| {job} in your draft was changed by {name}. Rebase or discard it in My draft. | assertive | A draft row that now conflicts, also while paused (proposed) | DR25 |
| 1002.10 was moved by Erik Sand. Focus is on 1004.10. | polite | The focused job order was moved by someone else (proposed) | TA19 |
| 9 late job orders. | polite | Late only turned on (proposed) | TA19 |
| None | | Sort changed: aria-sort changes and focus stays on the header button (D1) | TA19 |

### WCAG 2.2 criteria

TA19 and DR25 give how the frames meet each criterion:

| Criterion | How the frames meet it |
|---|---|
| 1.3.1 Info and Relationships | Grid rows, row headers and gridcells; the table's caption, column headers and aria-sort; the toolbar and its labelled group; headings for the Save result and the page states, the error summary's links, aria-busy and aria-readonly |
| 1.3.2 Meaningful Sequence | DOM order equals visual order: toolbar, status line, grid, inspector; in a row, job orders in time order |
| 1.4.1 Use of Color | States are icons, line styles and words; the selected row has a bar and aria-current besides its tint |
| 1.4.3 Contrast (Minimum), 1.4.11 Non-text Contrast | D1 tokens only; block-border, the checkbox border and the focus ring reach their ratios in both themes |
| 1.4.4 Resize Text, 1.4.12 Text Spacing | Rows in rem; labels wrap at full length (TA6, TA7, TA20, TA21); the toolbar wraps; tabs wrap to two lines |
| 1.4.10 Reflow | At 320 only the grid and the job table scroll in two directions, each in its own container; the toolbar folds into Board options or Table options (TA3 to TA5) |
| 1.4.13 Content on Hover or Focus | The hover card opens on focus, stays while hovered, and Escape closes it without moving focus |
| 2.1.1 Keyboard, 2.1.2 No Keyboard Trap | Every command has a key and a menu item; Tab always leaves the grid and the table |
| 2.1.4 Character Key Shortcuts | M and the other letter commands work only while a board cell has focus |
| 2.2.1 Timing Adjustable | The soft lock warning 20 s ahead with Extend |
| 2.2.2 Pause, Stop, Hide | Pause live updates on the board and in the job table; my own commands still apply by id |
| 2.4.3 Focus Order | TA8 and TA9; focus after each action as listed above |
| 2.4.6 Headings and Labels | Column names, the caption and visible labels before the presets and Late only |
| 2.4.7 Focus Visible | The D1 two-tone ring on every surface (TA16, TA17) |
| 2.4.11 Focus Not Obscured (Minimum) | Scroll padding for the sticky axes and the sticky table columns (TA18); the inspector never covers the grid |
| 2.5.2 Pointer Cancellation | A drag commits on pointer up and Escape cancels it |
| 2.5.3 Label in Name | Move 1003.20 starts with Move; Show earlier range holds Earlier |
| 2.5.7 Dragging Movements | Move in every table row, the Move dialog, the Details fields and keyboard move mode |
| 2.5.8 Target Size (Minimum) | Sort buttons, job order buttons and the Late only hit area are 24 px or more; the disclosure button 28 px; row buttons 32 px |
| 3.2.1 On Focus | Focus only scrolls into view and opens the hover card |
| 3.3.1 Error Identification, 3.3.3 Error Suggestion | The Save result names each row and what to do; the reason field says 3 to 500 characters |
| 3.3.4 Error Prevention | My draft reviews before Save; Break soft lock asks for a reason; Discard draft asks first and a row Discard can be undone until the next Save (proposed) |
| 4.1.2 Name, Role, Value | aria-pressed, aria-checked, aria-expanded, aria-current, aria-sort, aria-disabled with a reason; the tab's name with its count; the dialogs' names and descriptions |
| 4.1.3 Status Messages | Moves, saves, soft lock changes, autoplan, pause and the Late only count go through announce(); the status line has no live role |
| EN 301 549 clause 9.7 | Forced colors keep borders, icons and line styles, as ADR 0021 requires |

IN20 lists the criteria of the interaction frames: 1.1.1, 1.3.1, 1.4.1, 1.4.3, 1.4.11, 1.4.13, 2.1.1, 2.1.4, 2.2.1, 2.2.2, 2.4.3, 2.4.6, 2.4.7, 2.4.11, 2.5.2, 2.5.7, 2.5.8, 3.2.1, 3.3.1, 3.3.2, 3.3.3, 3.3.4, 3.3.7, 4.1.2 and 4.1.3.

### Final English copy

Braces mark values the page fills in. The announcement copy is in the table above.

| Where | Copy |
|---|---|
| Board toolbar and table view toolbar (TA19, DR25) | "Earlier"; "Now"; "Later"; "Go to date"; "Tue 3 Nov, 06:00 to 18:00"; "Zoom"; "Range"; "Hours"; "Day"; "Week"; "4 weeks"; "Pause live updates"; "Resume live updates" |
| Range text per preset (header, proposed) | "Tue 3 Nov, 06:00 to 18:00"; "Tue 3 Nov to Thu 5 Nov"; "W45, Mon 2 Nov to Sun 8 Nov"; "W45 to W48, Mon 2 Nov to Sun 29 Nov" |
| Job table (TA19) | "Late only"; "Job order"; "Machine"; "Start"; "End"; "Quantity"; "Status"; "Soft lock"; "Deadline"; "Planned end"; "Late by"; "Actions" (hidden); "Move"; "Planned"; "You"; "since 09:36"; "40 reported"; "2 days" |
| Late facts (TA19) | "Order 1012 is late by 2 days"; "Deadline rule"; "Start of day: 00:00 on the deadline date"; "Deadline"; "Planned end"; "Delay"; "2 days 10 h 45 min"; "As of"; "Forward fallback"; "Yes. Backward from the deadline, the order would start before its allowed start, so it was planned forward."; "No. The order was planned backward from its deadline." |
| Pager (TA19) | "Rows 1 to 25 of 105"; "Previous"; "Next"; "Previous page"; "Next page" |
| 320 (TA19) | "Board options"; "Table options"; "Show job table"; "Show board"; "My draft: 6 changes, not saved" |
| Move dialog (IN20) | "Move 1003.20 Shaft 40"; "Choose a machine and a start. The move goes into your draft, and Save writes it to the plan."; "Machine"; "Ends"; "Overlaps at this start"; "Current"; "3 allowed machines for operation 20, Turning."; "Starts in the frozen window, which ends at 13:40, so Save asks for a reason."; "Move"; "Cancel" |
| Break soft lock (IN20) | "Break Erik Sand's soft lock on order 1007?"; "Reason"; "Erik Sand sees this reason. 3 to 500 characters."; "Break soft lock" |
| Cluster popover (IN20) | "4 jobs on Press 4, 10:00 to 10:40" |
| Side slot contribution (IN20) | "From Pyramid" is the contribution's label. The block field texts "ERP change", "Differs", "Not mirrored" and "Stale" are the connector's copy, not planning's |
| My draft (DR25, header) | "My draft, 6 changes"; "Nothing was saved"; "Needs a reason"; "2 rows need your action"; "Resolve the 5 rows above to save."; "Discard all 6 changes?"; "No changes in your draft"; "Back to my draft"; "Discard draft"; "Discard 6 changes"; "Save changes"; "Save 4 changes"; "Rebase"; "Discard"; "Undo" |
| Draft row statuses (DR25) | "Ready to save"; "Changed by someone else"; "Soft lock lost"; "Started"; "ERP change waiting"; "No longer in the plan"; "Needs a reason"; "Discarded" |

The status line sheet DR12 draws every status line message at the content width of 1440:

| Run status or board state | Message |
|---|---|
| queued, by you | Autoplan queued at 09:38 by you. |
| queued, already queued by someone else | Autoplan already queued by Erik Sand at 09:36. It plans all of Plant A, so your request was not added. |
| running, by you | Autoplan running. Started at 09:38 by you. |
| running, by someone else | Autoplan running. Started at 09:36 by Erik Sand. |
| applied | Autoplan applied at 09:39: 37 moved, 2 skipped because being edited, 3 late, 1 conflict, 0 unplaced. |
| applied as a proposal in my draft (PO-16 alternative) | Autoplan put 37 moves in your draft at 09:39: 2 skipped because being edited, 3 late, 1 conflict, 0 unplaced. Review them in My draft |
| superseded | Autoplan from 09:38 was superseded by a newer run. |
| failed, plan changed during autoplan | Autoplan failed at 09:40: the plan changed during autoplan 3 times. Nothing moved. Run autoplan to try again. |
| failed, permission.denied | Autoplan failed at 09:40: your role at Plant A no longer allows running autoplan. Nothing moved. Ask your plant admin. |
| failed, budget_exceeded | Autoplan failed at 09:40: the plan did not finish within its step budget. Nothing moved. Tell your plant admin. |
| paused | Live updates paused. 12 changes waiting. |
| paused, one change | Live updates paused. 1 change waiting. |
| reconnecting | Moves are off until live updates are back. |
| SP3 fallback, read-only timeline | This timeline is read only. Move job orders in Details or in the job table. Open the job table |

Per the header, the status line copy of DR12 is proposed, apart from the result counts, "already queued by" and the pause line, which come from the docs.

## What the implementer takes

The implementers of the UI tasks of E08-S01 to E08-S11 take from the design page the layout, region order, states, copy, the keyboard model and slot placements. They take no markup, class names or demo numbers. A value on the page that is not a token, such as the 3 px selection bar or the 52 px machine rows, is a proposal, not a new value. The full rule is in [plan 06, Approval and what the implementer takes](../../plan/06-web-and-ux.md#approval-and-what-the-implementer-takes).

## Assumptions

The header frame lists these assumptions:

1. Every value is fictional: Acme AB, Plant A, the people, and the order, article and machine numbers.
2. The production day starts at 06:00. The Hours preset spans 12 h from it; the snap steps are 15 min at Hours, 1 h at Day, 4 h at Week and 1 day at 4 weeks.
3. The range control reads Now, as option A drew it, where #221 says Today. The row header button reads Jobs on this machine.
4. Plant time is CET, apart from BO18 and BO19, which show CEST before 03:00 on Sun 25 Oct and CET after it. In the long-strings frames dates and times stay in English, while labels and data are German, with one Finnish article.
5. States the shell owns stay D2's: the reconnecting chip, a module unavailable and a failed slot. The board draws only its own part of them, such as Resume live updates disabled and moves off.
6. Large orders, the example contribution, stands for any contribution to `planning/board/side/v1`.
7. Pause live updates is drawn as #98 specifies, while PO-45 in plan 16 asks whether it is wanted.
8. A save of my draft reviews in the My draft tab, and breaking a soft lock confirms in a dialog with a reason. Discarding a draft asks first and a discarded row keeps Undo, as proposals outside decision D.7 (open question 27).
9. If the board spike SP3 fails twice, the job table and a read-only timeline carry the page in the same layout (DR24).
10. Every color is a D1 token. Values that are not tokens, such as the 3 px selection bar, the 2 px frozen and snap lines, the 48 px strip, 52 px machine rows and the 4 px gutter before the time area, are proposals.
11. The Pyramid connector's block fields in IN29 and IN30 are an example contribution; their texts and icons are the connector's, not planning's.

## Proposals

The header frame lists these proposals as needing Krister's yes.

Row 1, board:

- The range text per preset: "Tue 3 Nov, 06:00 to 18:00", "Tue 3 Nov to Thu 5 Nov", "W45, Mon 2 Nov to Sun 8 Nov" and "W45 to W48, Mon 2 Nov to Sun 29 Nov" (BO1, BO8 to BO10).
- Collapse panel folds the inspector to a 48 px strip with Expand panel and one button per tab; the soft lock warning and Extend then sit in the status line (BO5, IN12).
- When the grid would keep under 480 px, the inspector shows as its strip until the planner expands it (BO6, BO7).
- At 1280 Earlier and Later keep only their icons; with the assistant docked, Go to date and Pause live updates move into Board options (BO3, BO6).
- A block that a cluster's 24 px target would cover joins the cluster, and its state counts with it (BO8).
- Machine rows are 52 px, so a two-line block's second line ends above its progress bar and border markers; the time area starts 4 px after the machine column, so a block at the range start keeps its focus ring.
- Under 66 px a block draws no text, because a whole job number needs 66 px; compact density runs from 66 to 119 px (BO7, BO8).
- At Week and 4 weeks the now label names the day on the top tier, so every day label stays (BO9, BO10).
- The lead time pill sits left of the link on the successor's row, else right of the predecessor's end, wherever it covers no block (BO1, IN3).

Row 2, interaction:

- The hover card opens after 700 ms and closes after 300 ms; keyboard focus opens it at once (IN1, IN2).
- The soft lock warning is announced once as assertive and counts down on screen; after Extend focus goes to the Details tab (IN10, IN11).
- A refused drop returns the block with an assertive message and the copy of IN5.
- The side slot content mounts only while its tab is open (IN17).
- The cluster popover keeps Tab inside it until Escape returns focus to the cluster (IN27).
- A server error in Details or in the Break soft lock dialog keeps every value and focus on the button, and is announced as assertive (IN33, IN34).

Row 3, draft, autoplan and page states:

- The status line copy of DR12, apart from the result counts, "already queued by" and the pause line, which come from the docs.
- The Save result in My draft: the heading "Nothing was saved", the badge Needs a reason and the summary "2 rows need your action" (DR3, DR4).
- The EmptyState and ErrorState copy, the error id and Show Week as the way out of `range_too_large` (DR19 to DR22).
- No Run autoplan or Save on the first run and on No access, and no Pause live updates while the board failed to load (DR19 to DR22).
- The stale header slot text (DR23), and moves through Details in the read-only timeline (DR24).
- With no job order in the range the first "No jobs in this range" cell holds the grid's Tab stop, or the Not placed row's "No job orders without a place" when it is empty; while the board loads the grid itself holds it (DR17, DR18, DR32).
- Discard draft asks first in an Alert Dialog, and Discard on a row keeps the row with Undo until the next Save (DR30, DR31).

Row 4, job table, keyboard and focus:

- The table sorts by machine in board order, then start; the toolbar names the presets Range; Late only sits at the top of the card; late facts open in an expandable row; Move stays in every row, aria-disabled with its reason (TA1, TA2).
- The toolbar is one Tab stop. Up and Down go to the job order nearest in time, and the row header column is its own path through the group bands (TA8, TA10, TA11).
- After Enter focus stays on the job order, after Save it goes to the My draft heading, and after Break soft lock it goes to Machine (TA12 to TA15).
- At 320 the toolbar folds into Board options or Table options, which hold Show job table and Show board (TA3, TA5).
- The announcement copy in IN20, DR25 and TA19.

## Known limits

- At the Day preset the blocks are close together, so the lead time pill can cover part of a block when no free place fits it (BO8, BO15).
- Job orders on a past night, such as Sun 25 Oct in BO18 and BO19, draw as committed without a finished cue until open question 12 is answered.
- The frames draw the job table as ARIA table roles on a CSS grid; the build uses a native table (TA19).

## Open questions

The header lists open questions 1 to 27, and TA19 adds four from its part (T1 to T4 here). Where a frame draws an answer, the last column names it.

| Id | Question | What the page draws |
|---|---|---|
| 1 | Which zoom preset is the default, and where does Hours start when `from` is a date only? | Most frames show Hours, 06:00 to 18:00 (BO1). The URL table leaves the default of `zoom` open |
| 2 | Is 06:00 the production day start? | 06:00 (header assumptions, BO1) |
| 3 | How long is the frozen window (PO-15)? | The frozen window ends at 13:40 while the plan time is 09:40 (IN8, DR3); IN4 draws it on the grid |
| 4 | What is the idle expiry of a soft lock (PO-42)? | Not drawn. IN10 draws the warning 20 s before the soft lock ends |
| 5 | What does a planner without `breakLock` see (PO-41), and which permission covers Lock and Unlock? | IN13's note: without `breakLock` the Break soft lock button is not drawn and the held note stays. Lock and Unlock are not answered |
| 6 | May a planner save new overlaps with a reason (PO-43)? | Save asks for a reason when a move adds an overlap or starts in the frozen window: 1003.20 needs a reason for both (DR3 to DR5) |
| 7 | Does autoplan apply directly or write a proposal (PO-16), and does it hold my own draft rows? | Applied directly (DR9, DR10); DR12 also draws the line for the alternative, autoplan putting its moves in my draft |
| 8 | Is pause wanted at all (PO-45)? | Drawn as #98 specifies (DR13, DR14) |
| 9 | Does the block menu include split? | No: the block menu holds Move, Lock or Unlock, Break soft lock on another planner's order, and Open order (IN7, TA19) |
| 10 | Does the board get an equipment group filter, and is it URL state? | Not drawn |
| 11 | How do rows of equipment tracked only for OEE look, and do they take drops? | Not drawn. DR19's copy says the board shows equipment marked as plannable or tracked for OEE |
| 12 | Do finished and cancelled job orders show on the board, and with which cue? | Mon 2 Nov and the night of Sun 25 Oct draw committed blocks without a finished cue |
| 13 | Where do toasts sit, away from the board? | Not drawn. TA19 says toasts sit away from the board |
| 14 | Is the pending change badge with its dialog part of D3 or its own task (E10-S03)? | Not drawn. The badge ERP change waiting shows in the job table and on draft rows, and IN29 draws the connector's block field ERP change |
| 15 | Does D3 draw the proposal review panel's "show on board", or only the proposed state (E15-S03)? | Only the proposed state (BO11, BO12) |
| 16 | Which unit do planned durations use? | Details shows "Setup 20 min, run 2 h 55 min" (IN7) |
| 17 | Which range limits apply until SP3 (PO-44), and what does `range_too_large` suggest? | 4 weeks returns `planning.board.range_too_large`, which offers Show Week and Open the job table (DR21) |
| 18 | What sits beside the h1 when no connector fills the header slot? | Not drawn. Every frame has the connector's line, Pyramid data as of 06:40, and DR23 draws it stale |
| 19 | Where does Tab enter the grid when nothing is selected? | Proposed: the first block of the first expanded machine row nearest the now line (TA19) |
| 20 | Is Go to date a Calendar popover? | Not drawn |
| 21 | With several contributions to `planning/board/side/v1`, does each get a tab, or do they share one tab? | One contribution, one tab: Large orders (IN17) |
| 22 | Is 480 px the right grid width below which the inspector shows as its strip? | 480 px (BO6, BO7) |
| 23 | Should 320 open the job table first? | Option A keeps the board grid at 320; TA3 to TA5 draw both, and TA5 offers Show job table |
| 24 | Does Collapse panel sit before or after the tab list? | After the tab list (BO12, TA19) |
| 25 | What does a superseded autoplan mean for the planner? | A neutral line: "Autoplan from 09:38 was superseded by a newer run." (DR12) |
| 26 | Do Save and Run autoplan stay enabled while reconnecting? | Enabled (DR15, DR16) |
| 27 | Does Discard draft get a review step, and a discarded row an Undo? Plan 06 lists only saving a draft, breaking a lock and releasing an order under WCAG 3.3.4, and decision D.7 follows it; rule 21.5 makes Discard draft the only undo | Both, as proposals (DR30, DR31) |
| T1 | Should the table view open with the inspector collapsed, or keep the planner's last state? | TA1 draws it collapsed, TA2 open |
| T2 | Should 320 open the job table by default without rewriting `view`, as option B did? | TA5 keeps the board and offers Show job table |
| T3 | Rule 13.6 as amended puts Collapse panel before the tab list, while rule 19.6 puts it after the tab list in the same row. Which holds? | The frames follow 19.6: Collapse panel follows the tab list in DOM and Tab order |
| T4 | Do the job table's sort fields follow the GraphQL SortField names, such as plannedEnd and lateBy? | The URL table uses those names as proposals; the codegen SortField enum fixes them |
