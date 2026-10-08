# D4 operator station

This is the approval record of design task D4, the operator station, issue [northMES/northmes#303](https://github.com/northMES/northmes/issues/303), for story E11-S01 ([northMES/northmes#115](https://github.com/northMES/northmes/issues/115)). The design page is [production-start/production-start-303-station.dc.html](https://claude.ai/design/p/dba068e0-37df-46e5-adcf-4439b6c4c0ad?file=production-start%2Fproduction-start-303-station.dc.html) in the Claude Design project. It builds on the direction chosen in the variations round, whose record `production-start-303-station-variations.md` is in pull request #312, on the tokens and components of D1 ([ui-189-tokens.md](../ui/ui-189-tokens.md)) and on the station frame and shell of D2 ([shell-190-navigation.md](../shell/shell-190-navigation.md)).

The page draws the production-start station screen inside the D2 station frame: pairing a station, badge sign-in and Switch operator, the job list beside the selected job with Start, Pause and Finish, the report form with the docked keypad, the last reports, the report dialogs and corrections, a lost connection, idle sign-off and the page states. The station frames mount the D2 station frame and the admin frames mount the D2 shell. Four rows hold the frames, and six shared parts draw the machine switch, the job list, the selected job, the report form, the last reports and the dialogs. Every name, number and time on the page is fictional.

## Approval

Krister Johansson approved the page on 2026-10-08. With the approval he accepted five proposals of the builders, listed under [Decisions at approval](#decisions-at-approval).

The page files were not edited after the approval, so the header frame F0 shows the page as it was in review:

- The first line reads "Design task D4, spec page, in review. Every name, number and time on this page is fictional."
- The acceptance line "Krister approved the page and the design project's README row holds the etag." reads Not met. The line for the frames in light and dark reads Met, the line for comment threads reads At approval, and the lines for the design pull request and for the Design section of the waiting UI tasks read Not met.

This record and the design project's README hold the approval. The README row of the page reads "approved 2026-10-08 by Krister Johansson" and holds the etag of the page file; the rows of the part files keep their descriptions. The PNGs were captured after the last change to the page's files, so they show the files at the etags below.

## Approved files

| File | Etag |
|---|---|
| `production-start/production-start-303-station.dc.html` | `1791450560405653` |
| `production-start/production-start-303-station-signin.dc.html` | `1791449836261554` |
| `production-start/production-start-303-station-jobs.dc.html` | `1791450064409242` |
| `production-start/production-start-303-station-offline-keyboard.dc.html` | `1791450391920012` |
| `production-start/production-start-303-station-reporting.dc.html` | `1791449629250692` |
| `production-start/production-start-303-station-header.dc.html` | `1791440462290538` |
| `production-start/production-start-303-station-joblist.dc.html` | `1791449387702603` |
| `production-start/production-start-303-station-job.dc.html` | `1791449305503069` |
| `production-start/production-start-303-station-report.dc.html` | `1791449520078549` |
| `production-start/production-start-303-station-reports.dc.html` | `1791449437576870` |
| `production-start/production-start-303-station-dialog.dc.html` | `1791440799593138` |
| `production-start/production-start-303-station.css` | `1791449217858746` |
| `production-start/production-start-303-station-data.js` | `1791449051176085` |

The design project returned these etags for `production-start/` on 2026-10-08.

The page also loads files outside this set. `production-start/StationFrame.dc.html` (etag `1791412597716744`) and `production-start/Shell.dc.html` (etag `1791444880053872`) have the same bytes as D2's approved `shell/StationFrame.dc.html` (etag `1791231752474671`) and `shell/Shell.dc.html` (etag `1791305527647556`); the copies exist because dc-import loads a frame from the page's own folder. The folder's `production-start/support.js` has etag `1791412594936396`. The page and its parts link D1's `ui/tokens.css` (`1791221436225089`) and `ui/ui-189-tokens-page.css` (`1791221436079789`) and D2's `shell/shell-190-navigation.css` (`1791305250083620`), the etags of the D1 and D2 records. Row 1 also links `ui/ui-222-list-form.css` (`1791415579516118`), the stylesheet of the canonical list and form page (#222), for the admin's Stations page. The variations files `production-start/production-start-303-station-variations*` belong to the variations round and are not part of this approval.

## Page facts

| Fact | Value |
|---|---|
| Issue | [northMES/northmes#303](https://github.com/northMES/northmes/issues/303), plan task E11-S01-T01 |
| Owning story | E11-S01 ([northMES/northmes#115](https://github.com/northMES/northmes/issues/115)), register a station as a device |
| Waiting tasks | The station UI tasks of E11-S01 to E11-S06 (#115 to #120) |
| Area | `production-start` for the station screens, which maps to `modules/production-start/web`; `core` for the admin's Stations page, its Pairing requests section and the approval Dialog, which maps to `modules/core/web` |
| Routes | `/station/$stationId`, a full-screen station layout with no sidebar, with the document title "Press 4 · Plant A · NorthMES"; Switch operator has the document title "Switch operator · Press 4 · Plant A · NorthMES". The route of the pairing screen before a station has an id, and the admin's Stations route (drawn as Administration, Stations), are open (question 21.13) |
| Personas | Operators Anna Berg, Omar Haddad and Liisa Korhonen at the station. Plant admin Jonas Holm approves the pairing on his own computer. Hannelore Wiesenthal-Brückner in the long-strings frames |
| Direction | Graphite: the D1 tokens and components (approved 2026-10-05) inside the D2 station frame and shell (approved 2026-10-06). Option A of the variations round with option B's docked keypad |
| Content | Acme AB, Plant A, Tue 3 Nov 2026 at 14:06 plant time. The station Press 4 is bound to one machine; the station Press cell 1 has Press 3 and Press 4. Jobs 5001.20 to 5009.10. Press 1 at Plant D, a plant in onboarding, appears only in SI37 to SI40 |

## Direction and decisions

Krister Johansson chose option A of the variations round, list beside the job, with option B's docked keypad, on 2026-10-08; the variations record in pull request #312 holds the choice. The job list sits beside the selected job, with the last reports as a third column at 1920 by 1080 and one scroll below the report form at 1280 by 800. On a station without a keyboard the keypad shows by default with a System keyboard toggle; on a station with a keyboard it starts hidden behind a Keypad toggle. Whether stations have a keyboard stays open (question 21.3), so the frames draw both kinds of station. Everything else follows option A: the StatusBadge, the scrap reasons always in view, Sending on the pressed button with the error under it, the last reports as a table, a correction in a Dialog, the Change job bar in portrait and A5's badge-first sign-in. F0 notes that Krister had not confirmed the choice on the page or in the README when the page was built.

### Decisions at approval

Krister Johansson accepted these proposals of the builders with the approval:

- At 1280 by 800 the report card's Report heading is visually hidden. It still names the card for screen readers, and Send stays in view with the keypad docked (JO3, JO30). Option A drew the heading at every size.
- Start, Pause and Finish keep fixed slots. A command the job's status does not allow leaves its slot empty, so the second tap of a gloved double press lands on nothing, and focus moves to the job heading when the pressed button leaves its slot (JO6 to JO8, OF17).
- At a station with several machines the machine switch sits beside the h1, in the station frame's header slot. After a switch, focus moves to the list heading (JO22, JO30, JO31, RE22).
- For a unit with display decimals the keypad takes the key "," (named "Decimal comma") in Clear's place, and Clear moves to the caption row beside the System keyboard or Keypad toggle, so the keypad keeps four rows (RE22, RE23).
- The correction Dialog docks the keypad the same way as the report form; with the keypad hidden, the toggle starts the footer (RE6 to RE15).

The other proposals on the page, which F0 and the build notes mark as needing his yes, were not decided with the approval, and the open questions in F0 stay open.

The implementer takes layout, region order, states and transitions, the copy in quotes, the badge reader, keyboard and keypad model, the focus targets and the slot placements, never markup, class names, token values, canvas icons or demo numbers. A value that is not a D1 token is a question. States the station frame owns (the top bar, the connection chip, the Disconnected strip and the idle warning) are drawn in D2 and mounted here unchanged.

## Rows

The page has a header frame, then one row per part file. The chips above the frames carry the frame ids.

| Row | Part file | Frames | What it shows |
|---|---|---|---|
| F0 Header | `production-start/production-start-303-station.dc.html` | F0 | Issue, direction, rows, acceptance criteria, the frames per item of the issue, assumptions, proposals, known limits and open questions |
| 1 Pairing and sign-in | `production-start/production-start-303-station-signin.dc.html` | SI1 to SI53, F1 | A new station's pairing code, the admin approving the request in the shell, the paired station, badge sign-in, the PIN after the badge with the docked keypad, an unknown badge, badge sign-in locked, sign-in with username, Switch operator and a plant in onboarding, each station state at 1920 by 1080 in light and dark, at 1280 by 800 and in portrait. Then an expired code, an approval that came too late, the admin page at 1920, 1280 and 320, a wrong username or password, a wrong PIN and the PIN lock. F1 holds the build notes for the row |
| 2 Station home, commands and page states | `production-start/production-start-303-station-jobs.dc.html` | JO1 to JO31 | The station home at the three sizes in light and dark; a planned, a paused and a finished job; Sending on Pause, Start and Send, with Send aria-disabled while a command waits; the 15 s timeouts; loading; the empty list at one and at two machines; the list error and the list not refreshed; the Change job Sheet in portrait and the job chosen in it; the machine switch to Press 3. JO26 holds the build notes for the row |
| 3 Lost connection, idle, reload, long strings, keyboard and focus | `production-start/production-start-303-station-offline-keyboard.dc.html` | OF1 to OF27 | Send, Pause, Start and Finish while disconnected; the connection back; a session ended on Send, then the same badge and another badge; the idle warning and the sign-off; Send after an update and the reload; German and Finnish strings in light and dark; Tab order; focus after Start, Send and an error; Switch operator; a badge scanned into Good quantity; targets for gloved hands and the D1 focus ring. OF26 holds the build notes for the row |
| 4 Reporting and corrections | `production-start/production-start-303-station-reporting.dc.html` | RE1 to RE31 | The large-quantity and "Report again?" Alert Dialogs; the correction Dialog with the docked keypad in its default, invalid, refused and sending states at the three sizes and at a keyboard station; the last reports after a correction and the supervisor case; the searchable list of 14 reasons; a quantity in kg with the decimal key; a server error that keeps the entries; the field errors with the summary; the keypad toggles on both kinds of station. RE31 holds the build notes for the row |

The rows mount these shared parts:

| Part | What it draws |
|---|---|
| `production-start/production-start-303-station-header.dc.html` | The machine switch in the station frame's header slot, for a station with several machines |
| `production-start/production-start-303-station-joblist.dc.html` | The job list column with its states, the Change job bar and the Change job Sheet in portrait |
| `production-start/production-start-303-station-job.dc.html` | The selected job's header with Start, Pause and Finish in fixed slots and the figures |
| `production-start/production-start-303-station-report.dc.html` | The report form with the scrap reasons, Send and its messages, and the docked keypad |
| `production-start/production-start-303-station-reports.dc.html` | The last reports table with Correct, correction rows and the supervisor case |
| `production-start/production-start-303-station-dialog.dc.html` | The correction Dialog with the docked keypad, and the large-quantity and "Report again?" Alert Dialogs, which row 4 mounts |
| `production-start/production-start-303-station.css` | The shared styles of the frames and parts |
| `production-start/production-start-303-station-data.js` | The station, its machines, jobs, last reports, scrap reasons and the copy in English and German |

Where each item of the issue's frame list is drawn, as the header gives it:

| Item in #303 | Light | Dark |
|---|---|---|
| Pairing: the station shows a pairing code; the plant admin approves it from their own PC, drawn in the shell | SI1, SI3, SI4, SI5, SI7, SI9, SI11, SI12, SI41, SI43, SI44, SI45, SI47 | SI2, SI6, SI8, SI10, SI42, SI46 |
| Badge sign-in in the focused badge field, an optional PIN field that accepts paste, unknown badge, sign-in locked for 5 minutes after five unknown badges, and Switch operator | SI13, SI15 to SI17, SI19 to SI21, SI23 to SI25, SI27 to SI29, SI31 to SI33, SI35, SI36, SI48, SI50, SI52 | SI14, SI18, SI22, SI26, SI30, SI34, SI49, SI51, SI53, OF20 |
| The job list for the station's equipment, sorted by planned start with priority, plus jobs with an open run; the selected job's header with who started it and the last report time | JO1, JO3, JO5, JO6, JO8, JO27, JO29, JO30, OF21, RE22 | JO2, JO4, JO7, JO28, JO31, RE23 |
| Start, pause and finish, with "Sending" and Send aria-disabled while a command waits (15 s timeout, no optimistic result) | JO6, JO8, JO9, JO11, JO12, JO14, JO16, OF17 | JO7, JO10, JO13, JO15, JO17 |
| Reporting good and scrap with a scrap reason; Enter never submits; the large-quantity confirmation; "Report again?" | JO1, JO3, JO5, JO12, OF19, RE1, RE3, RE4, RE20, RE22, RE24, RE27 to RE30 | JO2, JO4, JO13, OF18, OF22, RE2, RE5, RE21, RE23, RE25, RE26 |
| The last five reports on the selected job, and correcting one with a reason | JO1, JO8, OF24, RE6, RE8, RE9, RE11, RE13, RE15, RE16, RE18 | JO2, JO10, JO15, OF2, RE7, RE10, RE12, RE14, RE17, RE19 |
| Lost connection: the role=status banner, inline errors on Send, Start, Pause and Finish, entries kept; the idle warning 30 s before sign-off with "Stay signed in" | OF1, OF3, OF5, OF6, OF8, OF9, OF12, OF14 | OF2, OF4, OF7, OF10, OF11, OF13 |
| Empty, loading and error states; a plant in onboarding (core.plant_not_ready) | JO18, JO20, JO22, JO23, JO25, SI37, SI39, SI40 | JO19, JO21, JO24, SI38 |
| Station widths 1280 by 800, 1920 by 1080 and portrait; light and dark; one frame with long German or Finnish labels and data | JO1 (1920), JO3 (1280), JO5 (portrait), OF15 (long strings) | JO2 (1920), JO4 (1280), JO28, OF11 and OF25 (portrait), OF27 (long strings) |
| Keyboard, touch and focus frames: targets for gloved hands, tab order, where focus goes after each action | OF16, OF17, OF19, OF21, OF23, OF24, JO6, JO27, JO29, JO30, RE27 to RE30; F1 for row 1 | OF7, OF13, OF18, OF22, OF25, JO28, JO31 |

A dark twin repeats its light frame with the dark tokens and names that frame in its chip. Portrait frames are light, apart from OF11, OF25, JO28 and RE10. Single states inside an item, such as the keyboard station in OF4, the keypad toggles RE27 to RE30 and the admin page at 1920, 1280 and 320 (SI43, SI44, SI47), are drawn in one theme.

## Frames

Each chip gives the frame id, the state, the theme and the size, and a short note. A station frame is the station screen at its size; the frames "with notes" add annotations beside the screen, and a crop shows part of the 1280 by 800 screen. The PNGs were captured from the page's files at device scale 1 and show each frame with its chip. A frame marked "Not exported" has no PNG in this folder; [Frames without a PNG](#frames-without-a-png) lists them.

### Header

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| F0 | Header | Light, 1440 by 4834 | Issue, direction, rows, acceptance criteria, frames per item, assumptions, proposals, known limits and open questions | [production-start-303-station-f0-header.png](production-start-303-station-f0-header.png) |
| F1 | Build notes for row 1 | Light, 1440 by 2502 | Not part of the UI. What SI1 to SI53 fix for the build | [production-start-303-station-f1-build-notes-light.png](production-start-303-station-f1-build-notes-light.png) |

### Row 1, pairing and sign-in

Part file `production-start/production-start-303-station-signin.dc.html`.

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| SI1 | Pairing code | Light, 1920 by 1080 | A new station, nobody signed in: the code HX7K-29PQ, valid until 14:16, waits for a plant admin's approval | [production-start-303-station-si1-pairing-code-light-1920.png](production-start-303-station-si1-pairing-code-light-1920.png) |
| SI2 | Pairing code | Dark, 1920 by 1080 | As SI1 | Not exported |
| SI3 | Pairing code | Light, 1280 by 800 | As SI1 | Not exported |
| SI4 | Pairing code | Light, 800 by 1280 | As SI1 | Not exported |
| SI5 | Approve pairing | Light, 1440 by 900 | Jonas Holm, Administration, Stations: Approve on HX7K-29PQ opened the dialog; focus on Station, set to Press cell 1 | Not exported |
| SI6 | Approve pairing | Dark, 1440 by 900 | As SI5 | [production-start-303-station-si6-approve-pairing-dark-1440.png](production-start-303-station-si6-approve-pairing-dark-1440.png) |
| SI7 | Pairing approved | Light, 1440 by 900 | Press cell 1 is paired: the confirmation, no request left, focus on Press cell 1 in the list | Not exported |
| SI8 | Pairing approved | Dark, 1440 by 900 | As SI7 | Not exported |
| SI9 | Paired | Light, 1920 by 1080 | After approval the station is Press cell 1: the paired message over the badge card, focus in Badge | Not exported |
| SI10 | Paired | Dark, 1920 by 1080 | As SI9 | Not exported |
| SI11 | Paired | Light, 1280 by 800 | As SI9 | Not exported |
| SI12 | Paired | Light, 800 by 1280 | As SI9 | Not exported |
| SI13 | Badge sign-in | Light, 1920 by 1080 | Press 4, nobody signed in: focus in Badge through a ref, Sign in with username below it (A5) | [production-start-303-station-si13-badge-sign-in-light-1920.png](production-start-303-station-si13-badge-sign-in-light-1920.png) |
| SI14 | Badge sign-in | Dark, 1920 by 1080 | As SI13 | Not exported |
| SI15 | Badge sign-in | Light, 1280 by 800 | As SI13 | Not exported |
| SI16 | Badge sign-in | Light, 800 by 1280 | As SI13 | Not exported |
| SI17 | PIN after the badge | Light, 1920 by 1080 | The station's PIN option is on and it has no keyboard: four digits in the PIN field, which takes paste, and the docked keypad | Not exported |
| SI18 | PIN after the badge | Dark, 1920 by 1080 | As SI17 | [production-start-303-station-si18-pin-after-the-badge-dark-1920.png](production-start-303-station-si18-pin-after-the-badge-dark-1920.png) |
| SI19 | PIN after the badge | Light, 1280 by 800 | As SI17 | Not exported |
| SI20 | PIN after the badge | Light, 800 by 1280 | As SI17 | Not exported |
| SI21 | Unknown badge | Light, 1920 by 1080 | The field is cleared and keeps focus; the error sits under it and is said once in the polite region | Not exported |
| SI22 | Unknown badge | Dark, 1920 by 1080 | As SI21 | Not exported |
| SI23 | Unknown badge | Light, 1280 by 800 | As SI21 | Not exported |
| SI24 | Unknown badge | Light, 800 by 1280 | As SI21 | Not exported |
| SI25 | Badge sign-in locked | Light, 1920 by 1080 | Five unknown badges by 14:03 pause badge sign-in until 14:08; focus stays in Badge, Sign in with username stays | Not exported |
| SI26 | Badge sign-in locked | Dark, 1920 by 1080 | As SI25 | Not exported |
| SI27 | Badge sign-in locked | Light, 1280 by 800 | As SI25 | Not exported |
| SI28 | Badge sign-in locked | Light, 800 by 1280 | As SI25 | Not exported |
| SI29 | Sign in with username | Light, 1920 by 1080 | Username and Password with Show password; focus in Password | Not exported |
| SI30 | Sign in with username | Dark, 1920 by 1080 | As SI29 | Not exported |
| SI31 | Sign in with username | Light, 1280 by 800 | As SI29 | Not exported |
| SI32 | Sign in with username | Light, 800 by 1280 | As SI29 | Not exported |
| SI33 | Switch operator | Light, 1920 by 1080 | Anna Berg is signed in; the Switch operator screen with focus in Badge, Sign in with username and Cancel | Not exported |
| SI34 | Switch operator | Dark, 1920 by 1080 | As SI33 | Not exported |
| SI35 | Switch operator | Light, 1280 by 800 | As SI33 | Not exported |
| SI36 | Switch operator | Light, 800 by 1280 | As SI33 | Not exported |
| SI37 | Plant not open yet | Light, 1920 by 1080 | Press 1 at Plant D, which is in onboarding (core.plant_not_ready): no sign-in, focus on the h1 | [production-start-303-station-si37-plant-not-open-yet-light-1920.png](production-start-303-station-si37-plant-not-open-yet-light-1920.png) |
| SI38 | Plant not open yet | Dark, 1920 by 1080 | As SI37 | Not exported |
| SI39 | Plant not open yet | Light, 1280 by 800 | As SI37 | Not exported |
| SI40 | Plant not open yet | Light, 800 by 1280 | As SI37 | Not exported |
| SI41 | Code ran out, new code | Light, 1920 by 1080 | 14:17: HX7K-29PQ ran out at 14:16, so the station shows M4RT-8WNE by itself | Not exported |
| SI42 | Code ran out, new code | Dark, 1920 by 1080 | As SI41 | Not exported |
| SI43 | Pairing requests | Light, 1920 by 1080 | The Stations page with the request HX7K-29PQ, before Approve | Not exported |
| SI44 | Pairing requests | Light, 1280 by 800 | As SI43 | Not exported |
| SI45 | Request ran out | Light, 1440 by 900 | 14:17: Approve pairing came too late; the request list shows the new code M4RT-8WNE, focus on Close | Not exported |
| SI46 | Request ran out | Dark, 1440 by 900 | As SI45 | Not exported |
| SI47 | Reflow | Light, 320 by 640 | The Stations page with the approval Dialog open: both tables scroll sideways in named regions, the Dialog's facts in one column | Not exported |
| SI48 | Wrong username or password | Light, 1920 by 1080 | Username kept, Password cleared with focus, the error under the form | Not exported |
| SI49 | Wrong username or password | Dark, 1920 by 1080 | As SI48 | Not exported |
| SI50 | Wrong PIN | Light, 1920 by 1080 | The PIN field is cleared and keeps focus; the error under it | Not exported |
| SI51 | Wrong PIN | Dark, 1920 by 1080 | As SI50 | Not exported |
| SI52 | PIN sign-in paused | Light, 1920 by 1080 | Five wrong PINs for this badge pause PIN sign-in until 14:11 | Not exported |
| SI53 | PIN sign-in paused | Dark, 1920 by 1080 | As SI52 | Not exported |

### Row 2, station home, commands and page states

Part file `production-start/production-start-303-station-jobs.dc.html`.

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| JO1 | Station home | Light, 1920 by 1080 | Touch station. 5001.20 selected, Pause and Finish, the last reports beside the job | [production-start-303-station-jo1-station-home-light-1920.png](production-start-303-station-jo1-station-home-light-1920.png) |
| JO2 | Station home | Dark, 1920 by 1080 | As JO1 | [production-start-303-station-jo2-station-home-dark-1920.png](production-start-303-station-jo2-station-home-dark-1920.png) |
| JO3 | Station home | Light, 1280 by 800 | Compact job header, Send above the fold | [production-start-303-station-jo3-station-home-light-1280.png](production-start-303-station-jo3-station-home-light-1280.png) |
| JO4 | Station home | Dark, 1280 by 800 | As JO3 | Not exported |
| JO5 | Station home | Light, 800 by 1280 | The Change job bar | [production-start-303-station-jo5-station-home-light-800.png](production-start-303-station-jo5-station-home-light-800.png) |
| JO6 | Planned job, Start | Light, 1280 by 800 | 5005.20 chosen, focus on its heading; Start only, the Pause and Finish slots stay empty; Start overdue; no reports yet | Not exported |
| JO7 | Paused job, Start and Finish | Dark, 1280 by 800 | 5002.10 paused: Start and Finish, 80 good kept unsent | [production-start-303-station-jo7-paused-job-start-and-finish-dark-1280.png](production-start-303-station-jo7-paused-job-start-and-finish-dark-1280.png) |
| JO8 | Finished job, no commands | Light, 1920 by 1080 | 5007.10 finished 10:15, listed under Finished today; all three command slots empty; reports and corrections are still accepted | Not exported |
| JO9 | Pause sending | Light, 1280 by 800 | Pause reads Sending, Send is aria-disabled | Not exported |
| JO10 | Pause sending | Dark, 1920 by 1080 | As JO9 | Not exported |
| JO11 | Start sending | Light, 800 by 1280 | Start waits, Send is aria-disabled | Not exported |
| JO12 | Send sending | Light, 1920 by 1080 | Send with 96 good, 2 scrap, Burr reads Sending, aria-disabled and aria-busy, focus kept; Good and Remaining unchanged until the answer | [production-start-303-station-jo12-send-sending-light-1920.png](production-start-303-station-jo12-send-sending-light-1920.png) |
| JO13 | Send sending | Dark, 1280 by 800 | As JO12 | Not exported |
| JO14 | Pause timed out | Light, 1280 by 800 | No answer within 15 s, the error under the commands | Not exported |
| JO15 | Pause timed out | Dark, 1920 by 1080 | As JO14 | Not exported |
| JO16 | Send timed out | Light, 1920 by 1080 | No answer within 15 s: the error under Send, named by Send, entries kept, focus on Send | [production-start-303-station-jo16-send-timed-out-light-1920.png](production-start-303-station-jo16-send-timed-out-light-1920.png) |
| JO17 | Send timed out | Dark, 1280 by 800 | As JO16; the job column scrolls the message into view | Not exported |
| JO18 | Loading | Light, 1920 by 1080 | Skeletons of the list, the job header, the report card and the last reports, each region aria-busy; no job is known yet | Not exported |
| JO19 | Loading | Dark, 1280 by 800 | As JO18 | Not exported |
| JO20 | Empty job list | Light, 1280 by 800 | No jobs on Press 4, the station's only machine: no other machine to offer, nothing to create | [production-start-303-station-jo20-empty-job-list-light-1280.png](production-start-303-station-jo20-empty-job-list-light-1280.png) |
| JO21 | Empty job list | Dark, 1920 by 1080 | As JO20 | Not exported |
| JO22 | Empty job list, two machines | Light, 1280 by 800 | Press cell 1 shows Press 4 with no jobs and offers Show jobs on Press 3 | Not exported |
| JO23 | Job list error | Light, 1920 by 1080 | Nothing cached: the error with its id and Try again; no job selected | Not exported |
| JO24 | Job list error | Dark, 1280 by 800 | As JO23 | Not exported |
| JO25 | Job list not refreshed | Light, 1280 by 800 | The warning over the cached rows as of 13:40 with Try again; the selected job and the report form keep working | Not exported |
| JO26 | Build notes for the station home | Light, 1440 by 1960 | Not part of the UI. What JO1 to JO25 and JO27 to JO31 fix for the build | [production-start-303-station-jo26-build-notes-light.png](production-start-303-station-jo26-build-notes-light.png) |
| JO27 | Change job Sheet | Light, 800 by 1280 | Focus on the selected row | Not exported |
| JO28 | Change job Sheet | Dark, 800 by 1280 | As JO27 | [production-start-303-station-jo28-change-job-sheet-dark-800.png](production-start-303-station-jo28-change-job-sheet-dark-800.png) |
| JO29 | Job chosen in the Sheet | Light, 800 by 1280 | 5005.20, focus on its heading | Not exported |
| JO30 | Machine switched to Press 3 | Light, 1280 by 800 | Focus on the list heading Jobs on Press 3 | [production-start-303-station-jo30-machine-switched-to-press-3-light-1280.png](production-start-303-station-jo30-machine-switched-to-press-3-light-1280.png) |
| JO31 | Machine switched to Press 3 | Dark, 1280 by 800 | As JO30 | Not exported |

### Row 3, lost connection, idle, reload, long strings, keyboard and focus

Part file `production-start/production-start-303-station-offline-keyboard.dc.html`.

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| OF1 | Send while disconnected | Light, 1280 by 800 | Touch station. The Disconnected strip; Send failed, so "Not sent. There is no connection to NorthMES." sits under Send, the entries stay and focus stays on Send; the job column scrolls the message into view | [production-start-303-station-of1-send-while-disconnected-light-1280.png](production-start-303-station-of1-send-while-disconnected-light-1280.png) |
| OF2 | Pause while disconnected | Dark, 1920 by 1080 | Entries kept in the form. "Not paused." under the commands; focus stays on Pause | Not exported |
| OF3 | Start while disconnected | Light, 800 by 1280 | 5002.10 in portrait: "Not started." under the commands; focus stays on Start | Not exported |
| OF4 | Finish while disconnected | Dark, 1280 by 800 | Keyboard station, the keypad behind Keypad: "Not finished." under the commands; focus stays on Finish | Not exported |
| OF5 | Connection back, nothing sent by itself | Light, 1280 by 800 | The chip reads Connected and the strip is gone; nothing is sent by itself, and the error under Send stays until the next press (OFQ4) | Not exported |
| OF6 | Session ended on Send | Light, 1280 by 800 | The report waits for the same badge: the sign-in screen with the Report not sent notice; focus in Badge | Not exported |
| OF7 | Same badge, report sent | Dark, 1280 by 800 | Anna Berg's scan sends the kept report once; focus on the h1; the totals after the report | Not exported |
| OF8 | Another badge, nothing sent | Light, 800 by 1280 | Omar Haddad's scan signs him in; Anna Berg's kept entries stay hidden on the station, with no Send for them | Not exported |
| OF9 | Idle warning | Light, 1920 by 1080 | The frame's idle warning 30 seconds before sign-off, with entries typed; focus on Stay signed in | [production-start-303-station-of9-idle-warning-light-1920.png](production-start-303-station-of9-idle-warning-light-1920.png) |
| OF10 | Idle warning while disconnected | Dark, 1280 by 800 | As OF9 with the Disconnected strip | Not exported |
| OF11 | Signed out when idle | Dark, 800 by 1280 | The sign-in screen with the Entries kept notice; focus in Badge | Not exported |
| OF12 | Send after an update | Light, 1280 by 800 | core.client_outdated: "NorthMES was updated. Reload the station to send." under Send, with Reload; focus stays on Send | Not exported |
| OF13 | After Reload, entries back | Dark, 1280 by 800 | "Your entries are back after the reload. They are not sent yet." beside the h1; focus on the h1 | Not exported |
| OF14 | Reload when idle | Light, 1280 by 800 with notes | The automatic reload after an update, drawn at the sign-in screen, with the three conditions for it | Not exported |
| OF15 | Long strings | Light, 1920 by 1080 | German labels, German and Finnish data, Pause while disconnected; the job column scrolls at 1920 too (OFQ9) | [production-start-303-station-of15-long-strings-light-1920.png](production-start-303-station-of15-long-strings-light-1920.png) |
| OF16 | Tab order | Light, 1280 by 800 with notes | Touch station. The numbered Tab sequence of the station home | [production-start-303-station-of16-tab-order-light-1280.png](production-start-303-station-of16-tab-order-light-1280.png) |
| OF17 | Focus after Start | Light, crop of 1280 by 800 with notes | Start reads Sending and Send is aria-disabled; after the answer focus moves to the job heading | Not exported |
| OF18 | Focus after Send | Dark, crop of 1280 by 800 with notes | Focus stays on Send; the line under it says what was reported | Not exported |
| OF19 | Focus after an error | Light, crop of 1280 by 800 with notes | The error summary takes focus and links to the fields | Not exported |
| OF20 | Switch operator | Dark, 1280 by 800 | Focus in the Badge field; Anna Berg's unsent entries stay on the station for her; Cancel | Not exported |
| OF21 | After Switch operator | Light, 1280 by 800 | Omar Haddad signed in, focus on the h1 | Not exported |
| OF22 | Badge scanned into Good quantity | Dark, crop of 1280 by 800 with notes | A badge scanned into Good quantity types its number into the field; Enter never submits | Not exported |
| OF23 | Targets for gloved hands | Light, 1280 by 800 with notes | Touch station. The target sizes of buttons, fields, reason rows, keys and job rows | [production-start-303-station-of23-targets-for-gloved-hands-light-1280.png](production-start-303-station-of23-targets-for-gloved-hands-light-1280.png) |
| OF24 | D1 focus ring on station surfaces | Light, 1920 by 1080 with notes | The D1 focus ring on each focusable station surface | Not exported |
| OF25 | Targets for gloved hands | Dark, 800 by 1280 with notes | As OF23 in portrait | Not exported |
| OF26 | Build notes, not part of the UI | Light, 1440 by 5400 | Not part of the UI. Components, tokens, ARIA and announcements, the badge and keypad input model, focus after each action, copy, units and WCAG 2.2 for row 3 | [production-start-303-station-of26-build-notes-light.png](production-start-303-station-of26-build-notes-light.png) |
| OF27 | Long strings | Dark, 1920 by 1080 | As OF15 | Not exported |

### Row 4, reporting and corrections

Part file `production-start/production-start-303-station-reporting.dc.html`.

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| RE1 | Large quantity | Light, 1280 by 800 | 900 good on 5001.20, limit 822 pcs; focus on Change quantity | [production-start-303-station-re1-large-quantity-light-1280.png](production-start-303-station-re1-large-quantity-light-1280.png) |
| RE2 | Large quantity | Dark, 1920 by 1080 | As RE1 | Not exported |
| RE3 | Large quantity | Light, 800 by 1280 | As RE1 | Not exported |
| RE4 | Report again | Light, 1920 by 1080 | The report of 13:58 again, 8 minutes later; focus on Do not report | Not exported |
| RE5 | Report again | Dark, 1280 by 800 | As RE4 | Not exported |
| RE6 | Correct a report | Light, 1280 by 800 | Correct on 13:58: corrected totals, the docked keypad, focus on Good quantity | Not exported |
| RE7 | Correct a report | Dark, 1920 by 1080 | As RE6 | [production-start-303-station-re7-correct-a-report-dark-1920.png](production-start-303-station-re7-correct-a-report-dark-1920.png) |
| RE8 | Correct a report | Light, 800 by 1280 | As RE6; the keypad under the fields | Not exported |
| RE9 | Reason missing | Light, 1280 by 800 | Save correction with no reason; focus on Reason | Not exported |
| RE10 | Reason missing | Dark, 800 by 1280 | As RE9 | Not exported |
| RE11 | Correction refused | Light, 1920 by 1080 | Another correction of 13:58 was saved first; values kept, focus on Save correction | Not exported |
| RE12 | Correction refused | Dark, 1280 by 800 | As RE11 | Not exported |
| RE13 | Correction sending | Light, 800 by 1280 | Save correction reads Sending | Not exported |
| RE14 | Correction sending | Dark, 1920 by 1080 | As RE13 | Not exported |
| RE15 | Correct at a keyboard station | Light, 1280 by 800 | The keypad hidden, Keypad starts the footer | Not exported |
| RE16 | Correction saved | Light, 1920 by 1080 | The correction row leads, Good 638, focus back on Correct of 13:58 | Not exported |
| RE17 | Correction saved | Dark, 1280 by 800 | As RE16 | Not exported |
| RE18 | Needs a supervisor | Light, 1920 by 1080 | 5002.10: two reports of Mon 2 Nov have no Correct | Not exported |
| RE19 | Needs a supervisor | Dark, 1280 by 800 | As RE18 | Not exported |
| RE20 | Searchable reasons | Light, 1920 by 1080 | A register of 14 reasons, the search dam finds 2 | Not exported |
| RE21 | Searchable reasons | Dark, 1920 by 1080 | All 14 reasons, Burr chosen and active | Not exported |
| RE22 | Quantity in kg | Light, 1280 by 800 | 5008.10 on Press 3: 12,5 typed with the decimal key | [production-start-303-station-re22-quantity-in-kg-light-1280.png](production-start-303-station-re22-quantity-in-kg-light-1280.png) |
| RE23 | Quantity in kg | Dark, 1920 by 1080 | As RE22 | Not exported |
| RE24 | Server error on Send | Light, 1920 by 1080 | Not sent, entries kept, focus on Send | Not exported |
| RE25 | Server error on Send | Dark, 1280 by 800 | As RE24 | Not exported |
| RE26 | Field errors | Dark, 1280 by 800 | 12,5 in pcs and no reason; focus on the summary | Not exported |
| RE27 | Keyboard station | Light, 1920 by 1080 | The keypad hidden, Keypad ends the fields row | Not exported |
| RE28 | Keyboard station | Light, 800 by 1280 | As RE27; reasons in two columns | Not exported |
| RE29 | After System keyboard | Light, 1280 by 800 | Touch station: the keypad hidden, the pressed toggle ends the fields row | Not exported |
| RE30 | After Keypad | Light, 1280 by 800 | Keyboard station: the keypad docked, Keypad pressed in its caption row | Not exported |
| RE31 | Build notes for reporting and corrections | Light, 1440 by 1840 | Not part of the UI. What RE1 to RE30 fix for the build | [production-start-303-station-re31-build-notes-light.png](production-start-303-station-re31-build-notes-light.png) |

### Frames without a PNG

This record has 28 PNGs in the folder: the header, the four build notes frames, the station home at 1920 in light and dark, at 1280 and in portrait, and at least one frame for each item of the issue's frame list, among them the frames that show the decisions at approval (JO3, JO7, JO30, RE7, RE22).

The other frames are on the design page only:

- Row 1: SI2 to SI5, SI7 to SI12, SI14 to SI17, SI19 to SI36 and SI38 to SI53.
- Row 2: JO4, JO6, JO8 to JO11, JO13 to JO15, JO17 to JO19, JO21 to JO25, JO27, JO29 and JO31.
- Row 3: OF2 to OF8, OF10 to OF14, OF17 to OF22, OF24, OF25 and OF27.
- Row 4: RE2 to RE6, RE8 to RE21 and RE23 to RE30.

## Build notes

Four frames hold the build notes, each marked on the page as not part of the UI: F1 for row 1, JO26 for row 2, OF26 for row 3 and RE31 for row 4. This section carries them over in short, and their PNGs hold the full text. The notes are for the station UI tasks of E11-S01 to E11-S06. When the page and the accessibility rules disagree, the rules win. A line marked proposed needs Krister Johansson's yes, apart from the decisions at approval.

### Frame, layout and routes

- Station screens mount the D2 station frame with the props size, theme, connection, station, plant, operator, title, doc-title, screen and focus. The frame owns the top bar, the h1 ("Press 4, Anna Berg"), the skip link, the connection chip, the Disconnected strip and the idle warning; the station screen adds no second top bar.
- With nobody signed in the top bar keeps More and has no Switch operator or Sign out. Before pairing it reads New station and Not paired (SI1 to SI4).
- Sign-in has the h1 "Sign in at Press 4"; Switch operator has the h1 "Switch operator".
- The admin side belongs to the core module and mounts the D2 shell with Administration, Stations current and New station in the top bar, in the release 1 top bar without the bell. The Stations page is the canonical list of #222; D4 adds only the Pairing requests section and the approval Dialog. At 320 both tables scroll sideways inside a named region with the first column kept in place, and the Dialog shows its facts in one column (SI47).
- At 1920 by 1080 the job list is 420 px, then the job column and the last reports at 600 px, with 20 px gaps. At 1280 by 800 the job list is 320 px and the job column scrolls, with the last reports under the report card; the job header and the report card are compact. In portrait the Change job bar sits over the job column, which scrolls. These widths are proposals.
- Release 1 draws nothing for the later slot `production-start/station/panels/v1`.

### Components

The shadcn components by name, with where the page uses them and frames that draw them:

| Component | Used for | Frames |
|---|---|---|
| Card | The pairing card, the sign-in card, the list column, the job header, the report card, the last reports and "No job selected" | SI1, SI13, JO1, JO20 |
| Field, Label, Input | Badge, PIN, Username and Password, 48 px high, with a Separator reading "or" between Badge and Sign in with username | SI13, SI17, SI29 |
| NumberField (QuantityInput) | Good quantity and Scrap quantity, 56 px, with the unit in the label | JO1, RE22 |
| Button | Each job row is one button at least 96 px high; Start, Pause and Finish are large outline buttons (48 px) in fixed slots; Send is the default button, at least 200 px wide; Sign in with username, Sign in, Scan again, Scan a badge instead, Cancel, Reload, Try again and "Show jobs on Press 3" | JO1, JO6 to JO8, JO22, SI13, OF12 |
| Toggle | System keyboard and Keypad, with aria-pressed; Show password is an icon Button with aria-pressed | SI17, SI29, RE27 to RE30 |
| Toggle Group | The machine switch, one 48 px outline button per machine in the group "Machine" | JO22, JO30, RE22 |
| Badge | StatusBadge with icon and word (planned Info, active Play, paused Pause, finished CircleCheck); the flags "Start overdue" and "Planned on Press 3"; "Unsent entries" with Upload | JO1, JO5, JO8 |
| Radio Group | Scrap reason with eight reasons or fewer, one Tab stop | JO1 |
| Command | Scrap reason with more than eight reasons: a search field, the count and the option list | RE20, RE21 |
| Scroll Area | The job list, and the job column at 1280, in portrait and at 1920 when long strings make it taller than the screen | JO3, JO5, OF15 |
| Skeleton | The list, the job header, the report card and the last reports while the list loads | JO18, JO19 |
| Alert | "Paired." and "New code." at the station, the paused sign-in notes, the job list error and the stale list, Report not sent, Entries kept, Your entries are back, and the correction refusal | SI9, SI25, JO23, JO25, OF6, OF13, RE11 |
| Sheet | Change job in portrait, from the right edge, 560 px wide and modal | JO27, JO28 |
| Table | The last reports; Pairing requests and Stations on the admin side | JO1, RE16, SI43 |
| Dialog | "Approve pairing request" on the admin side; the correction, 900 px wide with the keypad and 640 px without it | SI5, RE6, RE15 |
| Alert Dialog | "Report 900 good?" and "Report again?"; the frame's idle warning | RE1, RE4, OF9 |
| Textarea | Reason (required) in the correction | RE6, RE9 |
| Select, Dropdown Menu | Station in the approval Dialog; each row's actions on the Stations page | SI5, SI43 |
| Keypad (new part) | A group of buttons outside the tab order, named by its caption | SI17, JO1, RE22 |

### Tokens and sizes

- Every color is a D1 token: the status pairs; `--destructive` and `--destructive-subtle` for errors, the error summary and invalid fields; `--warning` and `--warning-subtle` for the stale list and, from the frame, the Disconnected strip and the connection chip; `--accent` for the selected row, the skeletons, the active option and a pressed key; `--muted` for the paused Badge field, the original report and the correction row; `--border`, `--card` and `--muted-foreground`.
- The notices Report not sent, Entries kept and Your entries are back use an `--info` border and the Info icon on `--info-subtle`, with text in `--foreground` (proposed). The line after a confirmed report has CircleCheck in `--success`. The Unsent entries badge has a `--card` fill, `--foreground` text and a 1 px `--foreground` border, so it matches no status, flag or late pair.
- Focus uses the D1 ring: a 2 px `--focus-outline` outline 2 px outside the control with a 2 px `--focus-ring` halo; a focused field also turns its border `--foreground`.
- Targets follow `--nm-target-min-station` (44 px) in the station layout. The 48 px buttons, sign-in fields and reason rows, the 56 px quantity fields, the keys at 72 px at 1920 and 64 px at 1280 and in portrait, the 96 px job rows and the 48 px Plex Mono pairing code are proposals (question 21.9).

### Badge reader, PIN and keypad model

- The badge reader is a keyboard wedge: it types the badge number and Enter. Only a focused Badge field reads a badge, on the sign-in screen and on the Switch operator screen. Each takes focus through a ref when it opens, never through autofocus, and the station has no global key listener.
- Anywhere else a scan types like a keyboard: in Good quantity it leaves the badge number in the field, and Enter in a number field never submits (OF22).
- After an unknown badge the field is cleared and keeps focus. Five unknown badges within 60 s pause badge sign-in on the station for 5 minutes, and the sixth attempt returns 429; while paused, the field keeps focus with `aria-disabled="true"`, takes no input, and Sign in with username becomes the primary button. Five wrong PINs for one badge pause PIN sign-in for that badge for 5 minutes (proposed, question 21.35).
- PIN is one input with `type="password"`, `inputmode="numeric"` and `autocomplete="current-password"` that accepts paste and autofill, never one box per digit. Username has `autocomplete="username"`, `autocapitalize="none"` and `spellcheck="false"`; Password allows paste and has no keypad, since it needs letters. No CAPTCHA.
- A pairing code is valid for 10 minutes. When it runs out the station shows a new one by itself with the status line "New code." (SI41, SI42); the old request leaves the admin's list and the new one appears.
- The keypad shows by default on a station without a keyboard, with System keyboard (`aria-pressed="false"`); on a station with a keyboard it starts hidden behind Keypad. The station keeps the choice in localStorage, inside try/catch.
- While the keypad shows, the quantity fields use `inputmode="none"`, so the device keyboard stays closed; a hardware keyboard and the badge reader still type into the focused field. System keyboard hides the keypad, gives the field `inputmode="numeric"` (decimal for a unit with decimals), returns focus to the field and the pressed toggle ends the fields row (RE29). Keypad docks it, and the pressed toggle moves into the keypad's caption row with focus on it (RE30).
- Keys are buttons with `tabindex="-1"` whose pointerdown is prevented, so the field keeps focus and caret. A key types at the caret of the last focused quantity field, Clear empties that field and Delete last digit removes the digit before the caret. The decimal key exists only for a unit with display decimals, as decided at approval.

### Job list and commands

- The list holds the job orders on the station's equipment sorted by planned start, plus every job order with an open run on that equipment whatever its planned machine: 5006.10 shows "Planned on Press 3". Priority shows as "Priority 2" and is not a sort key (question 21.16). Jobs finished today follow under "Finished today" (question 21.2).
- The list is fetched at sign-in, read cache-first and kept live by the station subscription. Remaining is quantity minus good minus scrap, printed with formatQuantity in the stock unit ("548 of 1 200 pcs left"); times are plant time.
- The selected row has `aria-current="true"`, a 2 px foreground border, the accent fill and a ChevronRight. Choosing a row moves focus to the job heading, an h2 with `tabindex="-1"`.
- Start moves planned or paused to active, Pause moves active to paused, Finish moves active or paused to finished; each is idempotent by target state.
- Every station mutation runs with `AbortSignal.timeout(15000)` and no optimistic response: the StatusBadge, the figures and the list row keep their values until the server answers. While it waits, the pressed button reads "Sending" with LoaderCircle, has `aria-disabled="true"` and `aria-busy="true"` and keeps focus, and a visually hidden role=status says "Sending". Send is aria-disabled while Start, Pause, Finish or Send waits (ADR 0033); it keeps its label and place and stays focusable. The client idle timer does not fire while a command is in flight.
- After 15 s without an answer the error sits under the commands or under Send, the pressed button names it with aria-describedby, focus stays on that button and the polite region says it once. The entries and the client_report_id stay, so a report counts once.

### Lost connection, kept entries and idle sign-off

- A lost connection speaks only through the frame's Disconnected strip. Commands and Send fail with an inline error under the pressed control and keep the entries (OF1 to OF4). Nothing is sent when the connection returns (OF5).
- A session that ends on Send (OPERATOR_SESSION_ENDED) goes to the sign-in screen and keeps the report. The same operator's scan signs in and sends it under the new session with its client_report_id, so it counts once (OF7). Another operator's scan signs that operator in, and the kept entries stay on the station, hidden, with no Send for them (OF8).
- Kept entries without a pressed Send, after an idle sign-off (OF11) or Switch operator (OF20), come back into the form when the same operator signs in again, with the line "Your entries are back." beside the h1, and wait for Send.
- Entries are written to localStorage inside try/catch on every change: operator, job, good, scrap, scrap reason and client_report_id. A confirmed response, a replay included, clears them; a reload, a lost connection and a sign-off keep them.
- The idle warning opens 30 seconds before sign-off; the idle limit is a station setting of at least 120 seconds. After an update, a refused Send shows the error with Reload under Send (OF12); the station reloads by itself only when nobody uses it, no form holds unsent input and the module versions changed (OF14).

### Reporting and corrections

- Large quantity: good plus scrap above the remaining quantity times a plant setting (default 1.5) asks first, before anything is sent. "Report 900 good" sends with confirmedLargeQuantity; "Change quantity" closes the dialog and moves focus to Good quantity with the entries kept.
- Report again: the same job and quantities within 10 minutes under a new client_report_id asks first. "Report again" sends with confirmedRepeat; "Do not report" closes the dialog, keeps the entries and returns focus to Send.
- Both dialogs are role=alertdialog, modal, named by the title and described by the text; the safe choice comes first and has focus, and Escape is the safe choice.
- Correct on a quantity report of the current production day opens the Dialog "Correct the report of 13:58" with focus in Good quantity. The fields hold the corrected totals, so no minus sign is typed, and "Change: -2 good, scrap unchanged" is computed under them. Reason (required) is free text; the keypad cannot type it (question 21.34).
- Save correction with no reason moves focus to Reason with `aria-invalid="true"` (RE9, RE10). A refusal (CORRECTION_EXCEEDS_ORIGINAL) shows the Alert above the footer, keeps the values and keeps focus on Save correction (RE11, RE12).
- After a saved correction the Dialog closes, focus returns to that row's Correct, the polite region says "Correction of 13:58 saved", the correction row leads the last reports, and the figures and the list row show the new totals. A correction counts as the job's last report (proposed). A report from an earlier production day shows "Needs a supervisor" in place of Correct (RE18, RE19, question 21.6).
- More than eight reasons use a Command with "Search scrap reasons", the count "2 of 14 reasons" and the option list; the chosen reason has Check and `aria-selected="true"` (RE20, RE21).
- Field errors: the summary "2 fields need attention" at the top of the report card takes focus and links to Good quantity and to the Scrap reason group (RE26, OF19).

### Focus after each action

| Action | Focus |
|---|---|
| The sign-in screen or Switch operator opens | Badge, through a ref |
| An unknown badge; a wrong PIN; PIN sign-in paused | Stays in the cleared field |
| A badge read with the PIN option on | PIN |
| A wrong username or password | The cleared Password |
| Sign-in, by the same or another operator | The station h1 |
| Cancel on Switch operator | Switch operator |
| A plant in onboarding | The h1 "Plant D is not open yet"; the pairing screen has no focus target |
| Admin: Approve | Station in the Dialog; after Approve pairing the station's link in the table; Cancel returns to Approve; when the request ran out, Close, then the Pairing requests heading |
| Choosing a job; a command that removes the pressed button | The job heading |
| A command or Send fails | Stays on the pressed button |
| Send is confirmed | Stays on Send; the column scrolls the line under Send into view |
| Send with field errors | The error summary |
| Try again succeeds | The list heading "Jobs on Press 4" |
| A machine switch | The list heading "Jobs on Press 3" |
| Change job in portrait | The selected row in the Sheet; choosing a row moves focus to the job heading; Escape and Close return to Change job |
| The idle warning opens and closes | Stay signed in; closing returns focus to the element that had it |
| Reload after an update | The station h1 after the load |
| A dialog of row 4 closes | Change quantity: Good quantity. Do not report: Send. The correction: that row's Correct |
| A message pushes the focused control out of view | The job column scrolls it back into view |

### Tab order

- Sign-in, nobody signed in: Skip to main content, More, Badge, Sign in with username.
- PIN: Skip to main content, More, PIN, System keyboard (or Keypad), Sign in, Scan again. Keypad keys stay out of the tab order.
- Sign in with username: Skip to main content, More, Username, Password, Show password, Sign in, Scan a badge instead.
- Switch operator: Skip to main content, Sign out, More, Badge, Sign in with username, Cancel.
- Station home: Skip to main content, Switch operator, Sign out, More, the machine buttons when shown, the job rows in list order (Change job in portrait), the commands, the report fields, the keypad toggle, the scrap reasons as one stop, Send, the Correct buttons (OF16).
- Admin Dialog: Station, Cancel, Approve pairing; Close alone when the request ran out.

### Announcements

The polite region speaks once per event: "Sending"; each inline error; "5006.10 started", "5001.20 paused" and "5001.20 finished"; "Reported 96 good, 2 scrap on 5001.20"; "Correction of 13:58 saved"; "Live updates resumed" when the connection is back; the sign-in errors ("Badge not recognized. Scan again or sign in with your user name", "PIN not correct. Enter it again, or scan your badge again." and the others). The Disconnected strip is role=status from the frame. The notices on the sign-in card and the line beside the h1 have no live role; the focused field or h1 reads them.

### Units and ranges

- pcs: whole pieces, 0 or more. kg: one display decimal, typed with the decimal comma ("12,5"). A report needs good or scrap above 0 (question 21.23), and scrap above 0 needs a scrap reason. A correction keeps the net per original at 0 or more.
- Numbers use a no-break space between thousands and a decimal comma (1 200, 12,5); times are plant time on a 24-hour clock.

### WCAG 2.2 criteria

The notes cite 1.3.1, 1.3.5, 1.4.1, 1.4.3, 1.4.11, 2.1.1, 2.1.2, 2.1.4, 2.2.1, 2.4.3, 2.4.6, 2.4.7, 2.4.11, 2.5.8, 3.2.2, 3.3.1, 3.3.2, 3.3.3, 3.3.4, 3.3.7, 3.3.8, 4.1.2 and 4.1.3. The ones the station leans on: 2.1.4, because badges are read only in the focused Badge field; 2.2.1, because the idle warning opens 30 seconds ahead with Stay signed in, and the 10-minute pairing code is a security time limit; 2.4.11, because the Disconnected strip and the docked keypad never cover the focused control; 2.5.8, with 44 px as the station minimum; 3.2.2, because Enter never submits and nothing is sent when the connection returns; 3.3.7, because kept entries come back; and 3.3.8, because the badge needs no cognitive test, PIN and Password allow paste, and the admin picks the request instead of typing the code.

### Final English copy

The notes mark as doc copy the unknown badge message, the Disconnected strip, the chip's "Live updates paused, reconnecting", "Report again?", "Sending", the idle warning's title and Stay signed in. A few strings come from D2, such as "Connected" and "Your entries on this screen are kept."; the other strings are proposals, and the build notes PNGs list each with its source. The main strings:

- Pairing: "Pair this station", "Pairing code", "Valid until 14:16. A new code shows when this one runs out.", "Waiting for a plant admin to approve this station.", "Paired. This station is Press cell 1 at Plant A. Operators can sign in now."
- Sign-in: "Sign in at Press 4", "Badge", "Hold your badge to the reader.", "Sign in with username", "Badge read. Enter your PIN.", "Badge not recognized. Scan again or sign in with your user name", "Badge sign-in is paused until 14:08.", "Username or password not correct. Check both and sign in again."
- Plant in onboarding: "Plant D is not open yet", "Onboarding of Plant D is not complete."
- Admin: "Pairing requests", "Approve pairing request", "Check that the station screen shows this code before you approve.", "Station", "Only stations without a paired computer are listed.", "Approve pairing", "Press cell 1 is paired. The station shows its sign-in screen now."
- Station home: "No jobs on Press 4", "Jobs could not be loaded.", "The job list could not be refreshed. It shows the jobs as of 13:40. Error id 7f3a91c2.", "No job selected", "No answer from NorthMES within 15 seconds. Your entries are kept. Press Send again; the report is counted once."
- Lost connection: "No connection to NorthMES. Entries stay on this screen and are not sent until the connection is back.", "Not sent. There is no connection to NorthMES. Your entries are kept. Press Send again when the connection is back.", "Report not sent", "Entries kept", "NorthMES was updated. Reload the station to send. Your entries stay on this screen.", "You will be signed out in 30 seconds", "Stay signed in"
- Reporting: "Report 900 good?", "900 good is more than 1.5 times the remaining 548 pcs. Check the count before you send it.", "Change quantity", "Report again?", "Do not report", "Correct the report of 13:58", "The report stays as it is. Saving adds a correction row that refers to it.", "Reason (required)", "Save correction", "Enter a reason for the correction.", "Needs a supervisor", "Search scrap reasons", "Not sent. NorthMES could not save the report. Your entries are kept. Press Send again. Error id 7f3a91c2."

## Proposals still open

F0 lists these proposals as needing Krister Johansson's yes, beside the five decided at approval:

- Row 1: the pairing screen's top bar reads New station and Not paired, its h1 is "Pair this station", and a new code replaces an expired one by itself (SI1 to SI4). The admin approves in a Dialog from the Pairing requests section of the Stations page, with the request's facts, including the address it came from, and a Select of the stations without a paired computer; nothing is transcribed, and no Decline action is drawn (SI5, SI6). After the approval the admin's focus moves to the station's name in the list, and the station shows a success Alert above the badge card until the first sign-in (SI7 to SI12). While badge sign-in is paused, Badge keeps focus with aria-disabled and Sign in with username becomes the primary button (SI25 to SI28). The PIN screen shows no name before the PIN is checked (SI17 to SI20). A plant in onboarding shows no sign-in form (SI37 to SI40). An expired code and an approval that came too late (SI41, SI42, SI45, SI46). A wrong username or password, and a wrong PIN (SI48 to SI51).
- Row 2: "No job selected" with one line of guidance in the empty and error states (JO20 to JO24); the job column's Scroll Area thumb at 1280 and in portrait, at the screen edge outside the cards; focus on the list heading after a successful Try again; skeletons of the report card and the last reports while the list loads, naming no job (JO18, JO19).
- Row 3: a session that ends on Send goes to the sign-in screen with a Report not sent notice, and the same operator's scan sends the kept report without a second press (OF6, OF7, OFQ5); another operator's scan keeps the entries hidden (OF8, OFQ2); a message under Send scrolls the job column, which at 1280 by 800 with the strip moves the job number out of view (OF1, OFQ8); the error under Send stays after the connection is back (OF5, OFQ4); "Your entries are back" sits beside the h1 (OF13, OFQ7); the automatic reload is drawn at the sign-in screen (OF14, OFQ3); the notices use the Info icon on `--info-subtle`.
- Row 4: the copy of the large-quantity and "Report again?" Alert Dialogs, the safe choice focused first and Escape as the safe choice (RE1 to RE5); the correction Dialog with corrected totals and the computed change (RE6 to RE15); after a correction, focus back on the row's Correct, "Correction of 13:58 saved" in the polite region, and a correction counted as the job's last report (RE16, RE17); a searchable list for more than eight reasons, with the count under the search (RE20, RE21).
- Shared parts: the column widths at 1920 and 1280 with the compact job header and report card at 1280; the keypad's caption follows the last focused field, its keys stay out of the tab order, and the toggle moves between the fields row and the keypad's caption row; the inline error copy, the field errors with the summary, and the line after a confirmed report.

## Assumptions

From the header:

- Every value is fictional: Acme AB, Plant A, Plant D, the people, the stations, the pairing code and address, and the job, article and machine numbers.
- Now is Tue 3 Nov 2026 at 14:06 plant time; the frames after a code ran out (SI41, SI42, SI45, SI46) are at 14:17. Report times are record times (question 21.25).
- Press 4 is bound to one machine, so it shows no machine switch. Press cell 1 has Press 3 and Press 4 and shows the switch in the frame's header slot.
- Finished jobs stay on the station for the production day under "Finished today" (question 21.2). Overdue and planned on another machine show as words only (question 21.1).
- Anna Berg typed 80 good on 5002.10 and changed job without sending, so 5002.10 carries the Unsent entries badge.
- The start of a job is a row among the last five reports, with no Correct (question 21.5). Anna Berg may correct the station's reports today (question 21.6). The report has no note field (question 21.8).
- The D2 frame is frozen: the long-strings frames keep the English top bar (question 21.33), and the parts set aria-busy on their own regions because the frame has no busy prop (question 21.32).
- Every color is a D1 token.

## Known limits

- The report part's markup puts the keypad, and with it the System keyboard toggle, after Send. OF16 numbers the toggle right after the fields, so the build follows OF16.
- At 1920 by 1080 the German strings push Senden below the fold, so the job column scrolls at 1920 too (OF15, OF27, OFQ9). Option A drew no scroll at 1920.
- Row 1 does not draw the keyboard station's PIN screen, an unknown badge inside Switch operator, or the screen after revocation (close code 4403, question 21.13).

## Open questions

From the header, with its numbers:

- 21.1 Which words and icons show overdue, finish pending and planned on another machine? Words only are drawn.
- 21.2 Do finished jobs stay in the list for the production day, and do cancelled jobs show?
- 21.3 Is the station touch only, or does it have a keyboard? Both kinds are drawn.
- 21.4 While a command waits, are the other commands aria-disabled too? The frames disable the pressed command and Send.
- 21.5 Do start, pause and finish rows count among the last five reports?
- 21.6 Who may correct, and what does an operator see on a report they may not correct? "Needs a supervisor" is proposed.
- 21.7 Is Switch operator a route, or a Dialog or Sheet on the job route?
- 21.8 Does the report get a note field, and with which label?
- 21.9 Station buttons at 48 or 44 px, and keypad key sizes for gloves?
- 21.10 The inline error copy on Send, Start, Pause and Finish.
- 21.11 Is the form cleared after a confirmed report, and does the scrap reason stay?
- 21.12 Does the no-break space as group sign read well in Plex Mono at 32 px?
- 21.13 Pairing: the registration route, the code's shape and lifetime, WCAG 3.3.8 for the admin, the admin route and permission, and the screen after revocation.
- 21.14 Is sign-in with username allowed while badge sign-in is locked? Proposed yes.
- 21.15 What does the next operator see of kept entries, and when are they discarded?
- 21.16 Is priority a sort key or only shown? Shown only is drawn.
- 21.17 What happens when the planner moves the selected job off this machine while it has unsent entries?
- 21.19 "Start" or "Resume" on a paused job? The frames say Start.
- 21.20 Does Finish ask for confirmation? None is drawn.
- 21.22 May the operator report on planned, paused and finished jobs? The form shows on every job.
- 21.23 Must good or scrap be above 0, and which range applies per unit?
- 21.24 The copy of the large-quantity and "Report again?" dialogs (RE1 to RE5).
- 21.25 Record time or device time on a report? Record time is drawn.
- 21.26 What separates the frame's reconnecting state from offline?
- 21.28 Who draws the plant-in-onboarding state? D4 draws it inside the frame.
- 21.29 Does the station need a 320 px reflow frame?
- 21.30 Does D4 draw the station form, or the canonical list and form page?
- 21.31 Who owns the scrap reason register, and do reasons show a code?
- 21.32 Does D2 owe a busy prop, so that main carries aria-busy?
- 21.33 Does D2 owe a German top bar for the long-strings frames (OF15, OF27)?
- 21.34 How is the correction reason typed on a station without a keyboard?
- 21.35 Do wrong PINs lock PIN sign-in, and with which limit? Five wrong PINs for one badge pause it for 5 minutes (SI52, SI53).
- OFQ1 to OFQ9 in OF26: a username sign-in sending kept entries, when kept entries are discarded, what counts as idle for the reload, the Send error after the connection is back, the scan that sends a kept report, the badge on the selected job, the line after a reload, and the job column's scroll at 1280 with the strip and at 1920 with German strings.
