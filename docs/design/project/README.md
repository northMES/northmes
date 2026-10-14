# NorthMES design pages

## Layout

The pages sit in one folder per area. The area is the first part of a page's name.

- `ui/`: the styles. The approved D1 page with its part files, `tokens.css` with the Graphite tokens, and later token and component pages.
- `ui/explorations/`: the D1 direction round of five look-and-feel directions, kept for reference.
- `shell/`: the wrapper. The D2 pages, and later the shared `Shell.dc.html` that module pages mount and `StationFrame.dc.html` that station pages mount.
- One folder per module id, such as `core/`, `planning/` and `production-start/`. A module's folder is created when its first page lands.

A page is named `<area>-<issue>-<slug>.dc.html`. The area is `ui`, `shell` or a module id, and it maps to `packages/ui`, `apps/web` or `modules/<id>/web` in the repository. A page's part files sit next to it and start with its name. Each folder with pages has its own `support.js`. Pages in `shell/` and in module folders link the tokens as `../ui/tokens.css`.

States are frames inside a page, not separate pages.

An approved page is frozen. A later change copies it under a new issue number. The repository record of each approved page is `docs/design/<area>/<page-slug>.md`, next to PNGs of its frames.

The files moved from the project root into these folders on 2026-10-05. The root copies were removed on 2026-10-14, when the project was copied into the repository; the folder copies are the ones to use. `docs/design/ui/ui-189-tokens.md` lists the `ui/` etags of the D1 files; the etags they had at the root are in that file at commit 401e204, and the files in `ui/` are byte for byte the same.

## In the repository

Standalone Claude Design closes on 2026-12-14, so this folder holds the project as it was exported on 2026-10-14, with the root copies and the project thumbnail left out. The etags in the table are the Claude Design etags of each file at approval; the repository copies are byte for byte the exported files. The pages load React, Babel, lucide and the fonts from unpkg and Google Fonts and their part files over `fetch`, so open them through a local web server, not from disk.

## Pages

| Folder | Page | Issue | Status | Approved etag |
|---|---|---|---|---|
| ui/ | ui-189-tokens.dc.html | #189 | approved by Krister Johansson, 2026-10-05; moved to ui/ on 2026-10-05, content unchanged | 1791221434821682 |
| ui/ | ui-189-tokens-header.dc.html | #189 | approved as part of ui/ui-189-tokens.dc.html; moved to ui/ on 2026-10-05, content unchanged | 1791221434937191 |
| ui/ | ui-189-tokens-base.dc.html | #189 | approved as part of ui/ui-189-tokens.dc.html; moved to ui/ on 2026-10-05, content unchanged | 1791221435049269 |
| ui/ | ui-189-tokens-contrast.dc.html | #189 | approved as part of ui/ui-189-tokens.dc.html; moved to ui/ on 2026-10-05, content unchanged | 1791221435177831 |
| ui/ | ui-189-tokens-palette.dc.html | #189 | approved as part of ui/ui-189-tokens.dc.html; moved to ui/ on 2026-10-05, content unchanged | 1791221435294945 |
| ui/ | ui-189-tokens-markers.dc.html | #189 | approved as part of ui/ui-189-tokens.dc.html; moved to ui/ on 2026-10-05, content unchanged | 1791221435407617 |
| ui/ | ui-189-tokens-type.dc.html | #189 | approved as part of ui/ui-189-tokens.dc.html; moved to ui/ on 2026-10-05, content unchanged | 1791221435534908 |
| ui/ | ui-189-tokens-components.dc.html | #189 | approved as part of ui/ui-189-tokens.dc.html; moved to ui/ on 2026-10-05, content unchanged | 1791221435657129 |
| ui/ | ui-189-tokens-themes.dc.html | #189 | approved as part of ui/ui-189-tokens.dc.html; moved to ui/ on 2026-10-05, content unchanged | 1791221435766855 |
| ui/ | ui-189-tokens-keyboard.dc.html | #189 | approved as part of ui/ui-189-tokens.dc.html; moved to ui/ on 2026-10-05, content unchanged | 1791221435870445 |
| ui/ | ui-189-tokens-notes.dc.html | #189 | approved as part of ui/ui-189-tokens.dc.html; moved to ui/ on 2026-10-05, content unchanged | 1791221435964236 |
| ui/ | ui-189-tokens-page.css | #189 | approved as part of ui/ui-189-tokens.dc.html; moved to ui/ on 2026-10-05, content unchanged | 1791221436079789 |
| ui/ | tokens.css | #189 | approved as part of ui/ui-189-tokens.dc.html; moved to ui/ on 2026-10-05, content unchanged | 1791221436225089 |
| shell/ | shell-190-variations.dc.html | #190 | variations; direction chosen by Krister Johansson on 2026-10-05: option A with C's plant crumb and status split, station S1 | |
| shell/ | shell-190-variations-a.dc.html | #190 | part of shell/shell-190-variations.dc.html | |
| shell/ | shell-190-variations-b.dc.html | #190 | part of shell/shell-190-variations.dc.html | |
| shell/ | shell-190-variations-c.dc.html | #190 | part of shell/shell-190-variations.dc.html | |
| shell/ | shell-190-variations-compare.dc.html | #190 | part of shell/shell-190-variations.dc.html | |
| shell/ | shell-190-variations-header.dc.html | #190 | part of shell/shell-190-variations.dc.html | |
| shell/ | shell-190-variations-notes.dc.html | #190 | part of shell/shell-190-variations.dc.html | |
| shell/ | shell-190-variations-station.dc.html | #190 | part of shell/shell-190-variations.dc.html | |
| shell/ | shell-190-variations.css | #190 | part of shell/shell-190-variations.dc.html | |
| shell/ | shell-190-spec.md | #190 | spec for the variations | |
| shell/ | shell-190-navigation.dc.html | #190 | approved by Krister Johansson, 2026-10-06; on his decision the onboarding rename and the header fix were applied in place after the approval, an exception to the rule that a changed approved page is copied under a new issue number | 1791306240917384 |
| shell/ | shell-190-navigation-header.dc.html | #190 | approved as part of shell/shell-190-navigation.dc.html; onboarding rename and header fix applied in place after the approval | 1791310290478199 |
| shell/ | shell-190-navigation-planner.dc.html | #190 | approved as part of shell/shell-190-navigation.dc.html; onboarding rename applied in place after the approval | 1791305793431939 |
| shell/ | shell-190-navigation-narrow.dc.html | #190 | approved as part of shell/shell-190-navigation.dc.html; onboarding rename applied in place after the approval | 1791306066857549 |
| shell/ | shell-190-navigation-states.dc.html | #190 | approved as part of shell/shell-190-navigation.dc.html; onboarding rename applied in place after the approval | 1791306623760539 |
| shell/ | shell-190-navigation-signin.dc.html | #190 | approved as part of shell/shell-190-navigation.dc.html | 1791232323406503 |
| shell/ | shell-190-navigation-station.dc.html | #190 | approved as part of shell/shell-190-navigation.dc.html | 1791232473527259 |
| shell/ | shell-190-navigation-keyboard.dc.html | #190 | approved as part of shell/shell-190-navigation.dc.html; onboarding rename applied in place after the approval | 1791307095247190 |
| shell/ | shell-190-navigation.css | #190 | approved as part of shell/shell-190-navigation.dc.html; onboarding rename applied in place after the approval | 1791305250083620 |
| shell/ | Shell.dc.html | #190 | approved as part of shell/shell-190-navigation.dc.html; onboarding rename applied in place after the approval | 1791305527647556 |
| shell/ | StationFrame.dc.html | #190 | approved as part of shell/shell-190-navigation.dc.html | 1791231752474671 |
| ui/explorations/ | ui-d1-directions.dc.html | none | D1 direction round, reference only | |
| ui/explorations/ | ui-d1-direction-a.dc.html | none | D1 direction round, reference only; Direction A, Graphite, is the chosen direction; byte for byte the root file at etag 1791183476003175 that ui/tokens.css cites | |
| ui/explorations/ | ui-d1-direction-b.dc.html | none | D1 direction round, reference only | |
| ui/explorations/ | ui-d1-direction-c.dc.html | none | D1 direction round, reference only | |
| ui/explorations/ | ui-d1-direction-d.dc.html | none | D1 direction round, reference only | |
| ui/explorations/ | ui-d1-direction-e.dc.html | none | D1 direction round, reference only | |
| ui/ | ui-222-list-form-variations.dc.html | #222 | variations; chosen by Krister Johansson on 2026-10-07: option A, pages, with B's filter counts and C's review step only for the commands under WCAG 3.3.4 (saving a draft, breaking a lock, releasing an order) | |
| ui/ | ui-222-list-form-variations-header.dc.html | #222 | part of ui/ui-222-list-form-variations.dc.html | |
| ui/ | ui-222-list-form-variations-a.dc.html | #222 | part of ui/ui-222-list-form-variations.dc.html | |
| ui/ | ui-222-list-form-variations-b.dc.html | #222 | part of ui/ui-222-list-form-variations.dc.html | |
| ui/ | ui-222-list-form-variations-c.dc.html | #222 | part of ui/ui-222-list-form-variations.dc.html | |
| ui/ | ui-222-list-form-variations-notes.dc.html | #222 | part of ui/ui-222-list-form-variations.dc.html | |
| ui/ | ui-222-list-form-variations-compare.dc.html | #222 | part of ui/ui-222-list-form-variations.dc.html | |
| ui/ | ui-222-list-form-variations.css | #222 | part of ui/ui-222-list-form-variations.dc.html | |
| ui/ | Shell.dc.html | #222 | byte copy of the approved shell/Shell.dc.html (etag 1791305527647556) for pages in ui/, because dc-import loads the frame from the page's own folder; not edited | |
| ui/ | ui-222-list-form.dc.html | #222 | approved 2026-10-08 by Krister Johansson | 1791415700827963 |
| ui/ | ui-222-list-form-header.dc.html | #222 | approved 2026-10-08 as part of ui/ui-222-list-form.dc.html: header frame F0; the status line and the AC3 tick record the approval | 1791438838493408 |
| ui/ | ui-222-list-form-list.dc.html | #222 | approved 2026-10-08 as part of ui/ui-222-list-form.dc.html: row 1, the lists (articles, production orders, tools, audit log), LI1 to LI42; the archived article's number was changed in place after the approval, in pull request #314 | 1791444878028770 |
| ui/ | ui-222-list-form-states.dc.html | #222 | approved 2026-10-08 as part of ui/ui-222-list-form.dc.html: row 2, the page states and the settings page, ST1 to ST26 | 1791416339257068 |
| ui/ | ui-222-list-form-detail-form.dc.html | #222 | approved 2026-10-08 as part of ui/ui-222-list-form.dc.html: row 3, the detail, the forms, the dialogs and the review step, DE1 to DE44; the archived article's number was changed in place after the approval, in pull request #314 | 1791445039229805 |
| ui/ | ui-222-list-form-narrow-keyboard.dc.html | #222 | approved 2026-10-08 as part of ui/ui-222-list-form.dc.html: row 4, reflow at 320, long strings, keyboard and focus, and the build notes, NA1 to NA27; the archived article's number and the WCAG citation of the filter button in NA24 were changed in place after the approval, in pull request #314 | 1791447166931699 |
| ui/ | ui-222-list-form.css | #222 | approved 2026-10-08 as part of ui/ui-222-list-form.dc.html: the shared styles of its frames and parts | 1791415579516118 |
| ui/ | ui-222-list-form-toolbar.dc.html | #222 | approved 2026-10-08 as part of ui/ui-222-list-form.dc.html, shared by its rows: the list toolbar with filter menus and counts, chips, the bulk bar and the 320 Filters sheet | 1791415700827963 |
| ui/ | ui-222-list-form-table.dc.html | #222 | approved 2026-10-08 as part of ui/ui-222-list-form.dc.html, shared by its rows: the DataTable with its states, selection, row menu and grouping; the archived article's number was changed in place after the approval, in pull request #314 | 1791445548170251 |
| ui/ | ui-222-list-form-form.dc.html | #222 | approved 2026-10-08 as part of ui/ui-222-list-form.dc.html, shared by its rows: the form with field groups, the error summary, the reason field and the settings form | 1791416034946200 |
| ui/ | ui-222-list-form-detail.dc.html | #222 | approved 2026-10-08 as part of ui/ui-222-list-form.dc.html, shared by its rows: the detail with the General and History tabs | 1791416157693281 |
| ui/ | ui-222-list-form-dialog.dc.html | #222 | approved 2026-10-08 as part of ui/ui-222-list-form.dc.html, shared by its rows: ConfirmDialog and the review step for Release order; the archived article's number was changed in place after the approval, in pull request #314 | 1791444719312254 |
| planning/ | planning-221-board-variations.dc.html | #221 | variations; chosen by Krister Johansson on 2026-10-07: option A, the docked inspector, with option C's pinned Not placed row; the board side slot becomes a tab of the inspector | |
| planning/ | planning-221-board-variations-header.dc.html | #221 | part of planning/planning-221-board-variations.dc.html | |
| planning/ | planning-221-board-variations-a.dc.html | #221 | part of planning/planning-221-board-variations.dc.html | |
| planning/ | planning-221-board-variations-b.dc.html | #221 | part of planning/planning-221-board-variations.dc.html | |
| planning/ | planning-221-board-variations-c.dc.html | #221 | part of planning/planning-221-board-variations.dc.html | |
| planning/ | planning-221-board-variations-notes.dc.html | #221 | part of planning/planning-221-board-variations.dc.html | |
| planning/ | planning-221-board-variations-compare.dc.html | #221 | part of planning/planning-221-board-variations.dc.html | |
| planning/ | planning-221-board-variations-grid.dc.html | #221 | part of planning/planning-221-board-variations.dc.html | |
| planning/ | planning-221-board-variations-panel.dc.html | #221 | part of planning/planning-221-board-variations.dc.html | |
| planning/ | planning-221-board-variations.css | #221 | part of planning/planning-221-board-variations.dc.html | |
| planning/ | Shell.dc.html | #221 | byte copy of the approved shell/Shell.dc.html (etag 1791305527647556) for pages in planning/, because dc-import loads the frame from the page's own folder; not edited | |
| planning/ | planning-221-board.dc.html | #221 | approved 2026-10-08 by Krister Johansson | 1791438655548658 |
| planning/ | planning-221-board-board.dc.html | #221 | approved 2026-10-08 as part of planning/planning-221-board.dc.html: row 1, the board, BO1 to BO19 | 1791421076640008 |
| planning/ | planning-221-board-interact.dc.html | #221 | approved 2026-10-08 as part of planning/planning-221-board.dc.html: row 2, interaction, IN1 to IN34 | 1791421606250021 |
| planning/ | planning-221-board-draft-autoplan.dc.html | #221 | approved 2026-10-08 as part of planning/planning-221-board.dc.html: row 3, my draft, autoplan and the page states, DR1 to DR32 | 1791421354949964 |
| planning/ | planning-221-board-table-narrow-keyboard.dc.html | #221 | approved 2026-10-08 as part of planning/planning-221-board.dc.html: row 4, the job table, reflow at 320, long strings, keyboard and focus, and the build notes, TA1 to TA21 | 1791422137774018 |
| planning/ | planning-221-board.css | #221 | approved 2026-10-08 as part of planning/planning-221-board.dc.html: the shared styles of its frames and parts | 1791420387430299 |
| planning/ | planning-221-board-data.js | #221 | approved 2026-10-08 as part of planning/planning-221-board.dc.html, shared by its rows: the plan, the calendars and the copy; every value is fictional | 1791420518025274 |
| planning/ | planning-221-board-grid.dc.html | #221 | approved 2026-10-08 as part of planning/planning-221-board.dc.html, shared by its rows: the board grid | 1791420740314393 |
| planning/ | planning-221-board-notplaced.dc.html | #221 | approved 2026-10-08 as part of planning/planning-221-board.dc.html, shared by its rows: the pinned Not placed row | 1791420266289563 |
| planning/ | planning-221-board-inspector.dc.html | #221 | approved 2026-10-08 as part of planning/planning-221-board.dc.html, shared by its rows: the inspector with Details, My draft and Large orders | 1791420937916249 |
| production-start/ | production-start-303-station-variations.dc.html | #303 | variations, in review | |
| production-start/ | production-start-303-station-variations-header.dc.html | #303 | part of production-start/production-start-303-station-variations.dc.html: header frame F0 | |
| production-start/ | production-start-303-station-variations-a.dc.html | #303 | part of production-start/production-start-303-station-variations.dc.html: option A, list beside the job, frames A1 to A4 | |
| production-start/ | production-start-303-station-variations-b.dc.html | #303 | part of production-start/production-start-303-station-variations.dc.html: option B, one job at a time, frames B1 to B4 and B6 | |
| production-start/ | production-start-303-station-variations-c.dc.html | #303 | part of production-start/production-start-303-station-variations.dc.html: option C, job tiles, frames C1 to C4 and C6 | |
| production-start/ | production-start-303-station-variations-signin.dc.html | #303 | part of production-start/production-start-303-station-variations.dc.html: the badge sign-in of each option, frames A5, B5 and C5 | |
| production-start/ | production-start-303-station-variations-notes.dc.html | #303 | part of production-start/production-start-303-station-variations.dc.html: the notes under each option | |
| production-start/ | production-start-303-station-variations-compare.dc.html | #303 | part of production-start/production-start-303-station-variations.dc.html: comparison and recommendation, frame R | |
| production-start/ | production-start-303-station-variations.css | #303 | part of production-start/production-start-303-station-variations.dc.html: the shared styles of its frames and parts | |
| production-start/ | StationFrame.dc.html | #303 | byte copy of the approved shell/StationFrame.dc.html (etag 1791231752474671) for pages in production-start/, because dc-import loads the frame from the page's own folder; not edited | |
| production-start/ | Shell.dc.html | #303 | byte copy of the approved shell/Shell.dc.html (etag 1791305527647556) for pages in production-start/, because dc-import loads the frame from the page's own folder; not edited | |
| production-start/ | production-start-303-station.dc.html | #303 | approved 2026-10-08 by Krister Johansson | 1791450560405653 |
| production-start/ | production-start-303-station-signin.dc.html | #303 | part of production-start/production-start-303-station.dc.html: row 1, pairing and sign-in: the pairing code, the plant admin's approval in the shell, badge sign-in, the PIN with the docked keypad, an unknown badge, the sign-in lock, sign-in with username, Switch operator and a plant in onboarding, then an expired code, a request that ran out, the admin page at 1920, 1280 and 320, a wrong username or password, a wrong PIN and the PIN lock, SI1 to SI53; the page's frame F1 holds its build notes | |
| production-start/ | production-start-303-station-jobs.dc.html | #303 | part of production-start/production-start-303-station.dc.html: row 2, the station home, Start, Pause and Finish with Sending and the 15 s timeouts, the page states, the Change job Sheet and the machine switch to Press 3, with the build notes, JO1 to JO31 | |
| production-start/ | production-start-303-station-offline-keyboard.dc.html | #303 | part of production-start/production-start-303-station.dc.html: row 3, the lost connection and kept entries, the idle warning, the reload after an update, long strings in light and dark, keyboard, touch and focus, with the build notes, OF1 to OF27 | |
| production-start/ | production-start-303-station-reporting.dc.html | #303 | part of production-start/production-start-303-station.dc.html: row 4, reporting and corrections: the large-quantity and Report again Alert Dialogs, the correction Dialog in its states, the last reports after a correction and the supervisor case, the searchable scrap reasons, a quantity in kg, a server error on Send, the field errors and the keypad toggles, with the build notes, RE1 to RE31 | |
| production-start/ | production-start-303-station.css | #303 | part of production-start/production-start-303-station.dc.html: the shared styles of its frames and parts | |
| production-start/ | production-start-303-station-data.js | #303 | part of production-start/production-start-303-station.dc.html, shared by its rows: the station, its machines, jobs, last reports, scrap reasons and the copy in English and German; every value is fictional | |
| production-start/ | production-start-303-station-header.dc.html | #303 | part of production-start/production-start-303-station.dc.html, shared by its rows: the machine switch in the station frame's header slot, for a station with several machines | |
| production-start/ | production-start-303-station-joblist.dc.html | #303 | part of production-start/production-start-303-station.dc.html, shared by its rows: the job list column with its states, the Change job bar and the Change job Sheet in portrait | |
| production-start/ | production-start-303-station-job.dc.html | #303 | part of production-start/production-start-303-station.dc.html, shared by its rows: the selected job's header with Start, Pause and Finish in fixed slots and the figures | |
| production-start/ | production-start-303-station-report.dc.html | #303 | part of production-start/production-start-303-station.dc.html, shared by its rows: the report form with the scrap reasons, Send and its messages, and the docked keypad | |
| production-start/ | production-start-303-station-reports.dc.html | #303 | part of production-start/production-start-303-station.dc.html, shared by its rows: the last reports table with Correct, correction rows and the supervisor case | |
| production-start/ | production-start-303-station-dialog.dc.html | #303 | part of production-start/production-start-303-station.dc.html, shared by its rows: the correction Dialog with the docked keypad, and the large-quantity and Report again Alert Dialogs, which row 4 mounts | |
| core/ | core-304-access-variations.dc.html | #304 | variations, in review | |
| core/ | core-304-access-variations-header.dc.html | #304 | part of core/core-304-access-variations.dc.html: header frame F0 | |
| core/ | core-304-access-variations-a.dc.html | #304 | part of core/core-304-access-variations.dc.html: option A, by person, frames A1 to A5 | |
| core/ | core-304-access-variations-b.dc.html | #304 | part of core/core-304-access-variations.dc.html: option B, by plant, frames B1 to B5 | |
| core/ | core-304-access-variations-c.dc.html | #304 | part of core/core-304-access-variations.dc.html: option C, by role, frames C1 to C5 | |
| core/ | core-304-access-variations-noaccess.dc.html | #304 | part of core/core-304-access-variations.dc.html: the no-access states as each option shows them, frames N1A to N4C | |
| core/ | core-304-access-variations-notes.dc.html | #304 | part of core/core-304-access-variations.dc.html: the notes under each option | |
| core/ | core-304-access-variations-compare.dc.html | #304 | part of core/core-304-access-variations.dc.html: comparison and recommendation, frame R | |
| core/ | core-304-access-variations.css | #304 | part of core/core-304-access-variations.dc.html: the shared styles of its frames and parts | |
| core/ | core-304-access-variations-data.js | #304 | part of core/core-304-access-variations.dc.html: the shared roles, permissions and people; every value is fictional or proposed | |
| core/ | Shell.dc.html | #304 | byte copy of the approved shell/Shell.dc.html (etag 1791305527647556) for pages in core/, because dc-import loads the frame from the page's own folder; not edited | |
| core/ | core-304-access.dc.html | #304 | approved 2026-10-08 by Krister Johansson | 1791450587311652 |
| core/ | core-304-access-roles.dc.html | #304 | part of core/core-304-access.dc.html: row 1, roles: the roles list with its row menus, New role with Start from, the role editor with the refused Save and the role after Save, the read-only Holders tab and the refusals without core.role:manage, RO1 to RO42 | |
| core/ | core-304-access-assign.dc.html | #304 | part of core/core-304-access.dc.html: row 2, assignments and a user's access: the Access tab for a plant admin and a company admin, Add role with locked roles, the server refusal, removing a role, the No access cells and the Access tab's loading, empty, failed and denied states, AS1 to AS26 | |
| core/ | core-304-access-users.dc.html | #304 | part of core/core-304-access.dc.html: row 3, users: the users list, New user, Block user, Unblock user, Reset password and the temporary password, US1 to US18 | |
| core/ | core-304-access-noaccess-keyboard.dc.html | #304 | part of core/core-304-access.dc.html: row 4, the no-access states, reflow at 320, long strings, keyboard and focus, and the build notes frame, NO1 to NO27 | |
| core/ | core-304-access-notes.dc.html | #304 | part of core/core-304-access.dc.html: the build notes for the whole page, mounted by frame NO26 of row 4 | |
| core/ | core-304-access.css | #304 | part of core/core-304-access.dc.html: the shared styles of its frames and parts; the list and form patterns come from ui/ui-222-list-form.css, which the page links | |
| core/ | core-304-access-data.js | #304 | part of core/core-304-access.dc.html, shared by its rows: the modules, permissions, roles, people, history and the copy in English and German; every value is fictional or proposed | |
| core/ | core-304-access-checklist.dc.html | #304 | part of core/core-304-access.dc.html, shared by its rows: the role editor checklist, permissions grouped by module, with the difference from the role a new role starts from | |
| core/ | core-304-access-picker.dc.html | #304 | part of core/core-304-access.dc.html, shared by its rows: the role picker (Where and Role), the highlighted role's permissions, the person card and the note of the Add role form | |
| core/ | core-304-access-tab.dc.html | #304 | part of core/core-304-access.dc.html, shared by its rows: a user's Access tab with the roles, the access changes and the remove dialog; it mounts the effective permissions part | |
| core/ | core-304-access-effective.dc.html | #304 | part of core/core-304-access.dc.html, shared by its rows: the effective permissions table by module, with the No access cells | |
| shell/ | shell-306-errors.dc.html | #306 | approved 2026-10-08 by Krister Johansson | 1791416705945540 |
| shell/ | shell-306-errors-header.dc.html | #306 | approved 2026-10-08 as part of shell/shell-306-errors.dc.html: header frame F0; the status line and the ticked approval line record the approval; the server error trigger was changed in place after the approval, in pull request #314, to exclude 409 and 412 | 1791445133120646 |
| shell/ | shell-306-errors-inshell.dc.html | #306 | approved 2026-10-08 as part of shell/shell-306-errors.dc.html: the frames inside the shell, BL1 to BL6, NF1 to NF8, SE1 to SE8, NC1 to NC8, SO4, SO5 and LS1 to LS3 | 1791416952765116 |
| shell/ | shell-306-errors-outside.dc.html | #306 | approved 2026-10-08 as part of shell/shell-306-errors.dc.html: the pages outside the shell that load the tokens, SO1 to SO3, BO1 to BO7 and HS1 to HS3 | 1791416801689168 |
| shell/ | shell-306-errors-static.dc.html | #306 | approved 2026-10-08 as part of shell/shell-306-errors.dc.html: the static maintenance and browser pages, MA1 to MA9, UB1 to UB3 and LS4 | 1791416748547170 |
| shell/ | shell-306-errors-keyboard.dc.html | #306 | approved 2026-10-08 as part of shell/shell-306-errors.dc.html: row 10, keyboard and focus, KF1 to KF15 | 1791416871219538 |
| shell/ | shell-306-errors-notes.dc.html | #306 | approved 2026-10-08 as part of shell/shell-306-errors.dc.html: row 11, the build notes BN; the classifier row for CONFLICT and PRECONDITION was added in place after the approval, in pull request #314 | 1791445311125675 |
| shell/ | shell-306-errors.css | #306 | approved 2026-10-08 as part of shell/shell-306-errors.dc.html: the shared styles of its frames and parts | 1791416705945540 |
| shell/ | shell-313-settings-variations.dc.html | #313 | variations, in review | |
| shell/ | shell-313-settings-variations-header.dc.html | #313 | part of shell/shell-313-settings-variations.dc.html: header frame F0 | |
| shell/ | shell-313-settings-variations-frame.dc.html | #313 | part of shell/shell-313-settings-variations.dc.html: the screen of every option frame, A1 to C6: the D2 shell classes with the settings navigation of options A, B and C | |
| shell/ | shell-313-settings-variations-body.dc.html | #313 | part of shell/shell-313-settings-variations.dc.html: the page bodies inside the screens (Users, Machines, Calendars, the company landing) on the canonical list classes of #222 | |
| shell/ | shell-313-settings-variations-notes.dc.html | #313 | part of shell/shell-313-settings-variations.dc.html: the notes under each option | |
| shell/ | shell-313-settings-variations-compare.dc.html | #313 | part of shell/shell-313-settings-variations.dc.html: comparison and recommendation, frame R | |
| shell/ | shell-313-settings-variations.css | #313 | part of shell/shell-313-settings-variations.dc.html: the shared styles of its frames and parts | |
| shell/ | shell-313-settings.dc.html | #313 | spec page, in review | |
| shell/ | shell-313-settings-header.dc.html | #313 | part of shell/shell-313-settings.dc.html: header frame F0 | |
| shell/ | shell-313-settings-entry.dc.html | #313 | part of shell/shell-313-settings.dc.html: row 1, the way in, the way back, the scope cases and the plant list at /, EN1 to EN38, with the dark 1280 and 1920 frames EN31 to EN36 | |
| shell/ | shell-313-settings-company.dc.html | #313 | part of shell/shell-313-settings.dc.html: row 2, the company settings pages, CO1 to CO40, with the dark 1280 and 1920 frames CO34 to CO40 | |
| shell/ | shell-313-settings-plant.dc.html | #313 | part of shell/shell-313-settings.dc.html: row 3, the plant settings pages, PL1 to PL29 and the dark 1280 and 1920 frames PL31 to PL33, and row 5, routes, titles and breadcrumbs, PL30 | |
| shell/ | shell-313-settings-states.dc.html | #313 | part of shell/shell-313-settings.dc.html: row 4, the page states, PS1 to PS16 | |
| shell/ | shell-313-settings-reflow-keyboard.dc.html | #313 | part of shell/shell-313-settings.dc.html: row 6, reflow at 320, long strings, keyboard and focus, and the build notes, RE1 to RE30 | |
| shell/ | shell-313-settings-frame.dc.html | #313 | part of shell/shell-313-settings.dc.html, shared by its rows: the settings frame, a copy of the approved shell/Shell.dc.html (etag 1791305527647556) with the #313 changes only: the Settings button, the skip target past the settings navigation, company pages without a sidebar, the plant list at / without Admin, and no Administration section or Admin links | |
| shell/ | shell-313-settings-layout.dc.html | #313 | part of shell/shell-313-settings.dc.html, shared by its rows: the settings layout inside main, with the settings navigation column and the page column that holds the h1 | |
| shell/ | shell-313-settings-nav.dc.html | #313 | part of shell/shell-313-settings.dc.html, shared by its rows: the company and plant settings navigation | |
| shell/ | shell-313-settings-landing.dc.html | #313 | part of shell/shell-313-settings.dc.html, shared by its rows: the landing of each settings area and its empty state | |
| shell/ | shell-313-settings-list.dc.html | #313 | part of shell/shell-313-settings.dc.html, shared by its rows: the list blocks and their page states in the patterns of #222 | |
| shell/ | shell-313-settings-form.dc.html | #313 | part of shell/shell-313-settings.dc.html, shared by its rows: the form blocks in the patterns of #222 | |
| shell/ | shell-313-settings-data.js | #313 | part of shell/shell-313-settings.dc.html, shared by its rows: the entries of both settings areas, the copy in English and German, the companies and the long-strings preset; every value is fictional | |
| shell/ | shell-313-settings.css | #313 | part of shell/shell-313-settings.dc.html: the shared styles of its frames and parts | |
| shell/ | shell-454-dashboard-variations.dc.html | #454 | variations; chosen by Krister Johansson on 2026-10-10: option A, with B's Position and Size controls in A's settings sheet and C's Add widget tile in edit mode | |
| shell/ | shell-454-dashboard-variations-header.dc.html | #454 | part of shell/shell-454-dashboard-variations.dc.html: header frame F0 | |
| shell/ | shell-454-dashboard-variations-a.dc.html | #454 | part of shell/shell-454-dashboard-variations.dc.html: option A, tabs and edit mode, frames A1 to A9 | |
| shell/ | shell-454-dashboard-variations-b.dc.html | #454 | part of shell/shell-454-dashboard-variations.dc.html: option B, side column, frames B1 to B9 | |
| shell/ | shell-454-dashboard-variations-c.dc.html | #454 | part of shell/shell-454-dashboard-variations.dc.html: option C, tab picker and tiles, frames C1 to C9 | |
| shell/ | shell-454-dashboard-variations-grid.dc.html | #454 | part of shell/shell-454-dashboard-variations.dc.html: the widget grid inside every option frame, with the List, Table, Value and Chart widgets on demo data and their states | |
| shell/ | shell-454-dashboard-variations-settings.dc.html | #454 | part of shell/shell-454-dashboard-variations.dc.html: the settings of one placed widget, as option A's Sheet, option B's side column and 320 sheet, and option C's form inside the widget | |
| shell/ | shell-454-dashboard-variations-catalog.dc.html | #454 | part of shell/shell-454-dashboard-variations.dc.html: the widget catalog, as option A's Sheet, option B's side column and option C's popover | |
| shell/ | shell-454-dashboard-variations-notes.dc.html | #454 | part of shell/shell-454-dashboard-variations.dc.html: the notes under each option, frames A, B and C, and frame G with the grid library, the widget sizes in grid units and draft build notes | |
| shell/ | shell-454-dashboard-variations-compare.dc.html | #454 | part of shell/shell-454-dashboard-variations.dc.html: comparison and recommendation, frame R | |
| shell/ | shell-454-dashboard-variations.css | #454 | part of shell/shell-454-dashboard-variations.dc.html: the shared styles of its frames and parts | |
| shell/ | shell-454-dashboard-variations-data.js | #454 | part of shell/shell-454-dashboard-variations.dc.html: the tabs, the widgets and their layouts in grid units, and the scene of every option frame; every value is fictional | |
