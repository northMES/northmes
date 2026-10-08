# Error and system pages

This is the approval record of design task E04-S02-T02, issue [northMES/northmes#306](https://github.com/northMES/northmes/issues/306), "web: Design the error and system pages (400, 404, 500, maintenance)", for story E04-S02 ([northMES/northmes#40](https://github.com/northMES/northmes/issues/40)). The design page is [shell/shell-306-errors.dc.html](https://claude.ai/design/p/dba068e0-37df-46e5-adcf-4439b6c4c0ad?file=shell%2Fshell-306-errors.dc.html) in the Claude Design project.

Issue #306 had no variations round. The page reuses the ErrorState and EmptyState patterns, the error panel and the pages without a plant that the approved D2 page drew, so it builds on the D2 record ([shell-190-navigation.md](shell-190-navigation.md)) and on the tokens and components of D1 ([ui-189-tokens.md](../ui/ui-189-tokens.md)). D2 stays frozen: the new page mounts `shell/Shell.dc.html` and links the D1 and D2 sheets read only.

The page draws what NorthMES shows when a link cannot be read, a page or a record is not found, the server fails or cannot be reached, NorthMES is down for an upgrade, the session ends, the shell boots or cannot start, and the browser is too old or not on HTTPS. D2's module page not found (ST5), error panel (ST6) and unknown plant (ST29) are the reference and are not drawn again. The no-access states (403, close code 4403) belong to [northMES/northmes#304](https://github.com/northMES/northmes/issues/304).

## Approval

Krister Johansson approved the page on 2026-10-08. The header frame F0 records the approval:

- The status line reads "approved by Krister Johansson on 2026-10-08".
- The acceptance line "Krister approved the page and the design project's README row holds the etag" is ticked, and the other four acceptance lines are unticked. A style block in the header part draws the ticked box, so `shell-306-errors.css` keeps its approved etag.

The classifier sends `CONFLICT` (REST 409) and `PRECONDITION` (REST 412) to the form or dialog whose command got them, never to a page: the Server error (500) trigger in F0 excludes 409 and 412, and What decides the page in BN has a row for them. Both were set in the review of pull request #314, after the approval.

The F0 and BN PNGs show the files at the etags below. The other PNGs were captured from the page on 2026-10-08 before the approval, and their frames are the same at these etags.

## Approved files

| File | Etag |
|---|---|
| `shell/shell-306-errors.dc.html` | `1791416705945540` |
| `shell/shell-306-errors-header.dc.html` | `1791445133120646` |
| `shell/shell-306-errors-inshell.dc.html` | `1791416952765116` |
| `shell/shell-306-errors-outside.dc.html` | `1791416801689168` |
| `shell/shell-306-errors-static.dc.html` | `1791416748547170` |
| `shell/shell-306-errors-keyboard.dc.html` | `1791416871219538` |
| `shell/shell-306-errors-notes.dc.html` | `1791445311125675` |
| `shell/shell-306-errors.css` | `1791416705945540` |

The design project returned these etags for `shell/` on 2026-10-08: the header's with the approval status and the 409 and 412 exclusion, and the notes' with the classifier row for `CONFLICT` and `PRECONDITION`. The page and its stylesheet carry the same etag. The design project's README rows of the page and its parts mark them approved on 2026-10-08 and hold these etags.

The page also loads files outside this set, each approved earlier and unchanged: D2's `shell/Shell.dc.html` (etag `1791305527647556`) and `shell/shell-190-navigation.css` (`1791305250083620`), the folder's `shell/support.js` (`1791221619746846`), and D1's `ui/tokens.css` (`1791221436225089`) and `ui/ui-189-tokens-page.css` (`1791221436079789`). These etags equal the ones in the D1 and D2 records. Icons come from lucide 1.45.0, the version D1 pins.

## Page facts

| Fact | Value |
|---|---|
| Issue | [northMES/northmes#306](https://github.com/northMES/northmes/issues/306), plan task E04-S02-T02 |
| Owning story | E04-S02 ([northMES/northmes#40](https://github.com/northMES/northmes/issues/40)) |
| Waiting UI tasks | The shell's error, not-found and boot handling in E04-S02 to E04-S05, the page states of E04-S07 ([northMES/northmes#45](https://github.com/northMES/northmes/issues/45)), the maintenance page of E17-S02 ([northMES/northmes#150](https://github.com/northMES/northmes/issues/150)) |
| Area | `shell`, which maps to `apps/web`; the maintenance page belongs to the release bundle of E17-S02 |
| Routes | Any route under `/$plant` and `/admin` for the states in main; `/sign-in?redirect=` for the session; `index.html` at boot; Caddy's `handle_errors 502 503 504` for the maintenance page; `/assets/browser-check.js` |
| Personas | Planner (primary); Plant admin, who gets the correlation id and upgrades NorthMES with the customer's IT; Operator at a station, for the maintenance and boot pages |
| Direction | Graphite (D1): IBM Plex Sans for text, IBM Plex Mono for numbers, ids and paths, 6 px radius, 36 px controls, near-black primary, light by default, dark per user |
| Data | Fictional: Acme AB, Plant A, the planner Alex Lund, the company admin Jonas Holm, invented ids, paths and the host `mes.acme.example` |

## Pages, triggers and routes

The header lists each page in short; the build notes below carry the copy, focus and announcements in full.

| Page | Trigger | Renders at | h1 |
|---|---|---|---|
| Link cannot be used (400) | The route's primary request is refused as invalid: GraphQL `BAD_USER_INPUT` (such as `core.list.invalid_cursor`) or a REST 400 problem body, or `validateSearch` throws | The route's error component in main | {route title} could not open this link |
| One setting ignored | One or more search keys fail their own schema: each falls back to its default and the route drops it with a replace navigation | The page itself, with an info Alert | The route's own |
| Unknown path in a plant | No route matches under `/$plant` for a plant the user can open | `defaultNotFoundComponent` in the plant layout | Page not found (doc) |
| Unknown path under /admin | No route matches under `/admin` | `defaultNotFoundComponent` in the admin layout | Page not found (doc) |
| Record not found | The owner throws `NOT_FOUND` for an unknown or hidden id | EmptyState in main | Production order not found |
| Server error (500) | `INTERNAL_SERVER_ERROR` with `core.internal`, HTTP 500, or any other error status except 400, 401, 403, 404, 409, 412 and 502 to 504 | The route's error component in main | {route title} could not be loaded |
| No connection | The route's primary request gets no HTTP response within the timeout (E5) | The route's error component in main | No connection to NorthMES |
| Load while restarting | 502, 503 or 504 from `/graphql` or `/api` at page load | No error page: the restarting strip and the skeleton | The route's own |
| Maintenance | Caddy cannot reach `app`; it answers 503 with `Retry-After: 15` at the original URL | One static HTML file from the release bundle | NorthMES is not available right now |
| Session ended | HTTP 401, `UNAUTHENTICATED` or close code 4401 in a tab that had a session | `/sign-in?redirect={path and search}`, D2's sign-in page | Sign in to NorthMES (D2) |
| Loading NorthMES | Every full page load until the shell renders | The static main of `index.html` | Loading NorthMES (doc) |
| NorthMES could not start | `GET /api/v1/web/modules` fails, or gets no answer | Boot code writes into the static main | NorthMES could not start |
| Newer browser needed | `browser-check.js` finds no `color-mix()` or `@property` | A plain page from that script | NorthMES needs a newer browser |
| HTTPS required | Boot finds no secure context (`crypto.subtle` missing) | Boot code writes into the static main | NorthMES needs HTTPS |

## Rows

The page has a header frame, ten rows of frames and the build notes. The chips above the screens carry the frame ids.

| Row | Part file | Frames | What it shows |
|---|---|---|---|
| F0 Header | `shell/shell-306-errors-header.dc.html` | F0 | Facts, acceptance criteria, how to read the page, pages and triggers, frames by row, the issue's frames, the server error page against D2's error panel, assumptions and open questions |
| 1 A link the app cannot read (400) | `shell/shell-306-errors-inshell.dc.html` | BL1 to BL6 | The route's error component for a link the page cannot use, at 1440 and 320, with and without Go back; the page that ignores one setting with its inline status |
| 2 Not found outside a module (404) | `shell/shell-306-errors-inshell.dc.html` | NF1 to NF8 | An unknown path in a plant and under `/admin`, inside their layouts; a record that does not exist or is hidden, at 1440 and 320 |
| 3 The server failed (500) | `shell/shell-306-errors-inshell.dc.html` | SE1 to SE8 | The server error page with the correlation id, Try again and a way out at 1440, 1280, 1920 and 320, and Try again in its loading state |
| 4 The server cannot be reached | `shell/shell-306-errors-inshell.dc.html` | NC1 to NC8 | No connection with the reconnecting chip, after a failed Try again, at 320, and the boundary with the restarting state |
| 5 Maintenance page | `shell/shell-306-errors-static.dc.html` | MA1 to MA9 | Caddy's static page at 1440, 320, 1920 and the station sizes, and the moment the check gets an answer |
| 6 Signed out (401, close code 4401) | `shell/shell-306-errors-outside.dc.html`, `shell/shell-306-errors-inshell.dc.html` | SO1 to SO5 | Sign-in with the session ended box and the return URL, and the page it returns to with its search kept |
| 7 Boot | `shell/shell-306-errors-outside.dc.html` | BO1 to BO7 | Loading NorthMES, the modules request failing, and no answer at boot at the station landscape size |
| 8 Unsupported browser and HTTPS required | `shell/shell-306-errors-static.dc.html`, `shell/shell-306-errors-outside.dc.html` | UB1 to UB3, HS1 to HS3 | The plain browser check page and the HTTPS page |
| 9 Long strings | `shell/shell-306-errors-inshell.dc.html`, `shell/shell-306-errors-static.dc.html` | LS1 to LS4 | The server error page in German, a Finnish plugin page and the maintenance page in German at 320 |
| 10 Keyboard and focus | `shell/shell-306-errors-keyboard.dc.html` | KF1 to KF15 | Tab order, where focus goes after each action, the polite messages, focus not obscured and the ring on every new control |
| 11 Build notes | `shell/shell-306-errors-notes.dc.html` | BN | Components, tokens, icons, roles, focus, announcements, titles, the error classification, the static page rules, WCAG 2.2 and the final copy |

Where each frame of the issue's Frames list is drawn, as the header gives it:

| Issue frame | Frames |
|---|---|
| 400: search parameters that fail the route's search definition, and a request the server refuses as invalid at page load; plain words, no raw parameters, a way out | BL1 to BL6; KF5, KF6 |
| 404 outside a module: `defaultNotFoundComponent` for an unknown path, the same under `/admin`, and a record that does not exist or is hidden (EmptyState with Back to list); ST5 and ST29 as the reference | NF1 to NF8; KF7 |
| 500: a data request with a server error, as a full page state in main with the correlation id, Try again and a way out; the difference from ST6 stated | SE1 to SE8; LS1 to LS3; KF1 to KF4 |
| The server cannot be reached at page load, with retry | NC1 to NC8 |
| Maintenance: Caddy's static page (502, 503), plain HTML and CSS, the mark, light and dark by `prefers-color-scheme`, reloads by itself | MA1 to MA9; LS4; KF8, KF9 |
| Signed out: 401 and 4401, back to sign-in, keeping the URL | SO1 to SO5; KF10 |
| Boot: Loading NorthMES, and the shell failing to start | BO1 to BO7; KF11 |
| Unsupported browser and HTTPS required | UB1 to UB3; HS1 to HS3; KF12 |
| Titles, the h1 with focus, the status code only where it helps support | Every frame's title annotation; BN |
| Widths 1280, 1440, 1920 and 320; light and dark; long German or Finnish strings | 1280: SE3, BO6, BO7, MA5, LS3; 1920: SE4, MA7; 320: 17 frames; portrait: MA6; LS1 to LS4 |
| Keyboard and focus frames | KF1 to KF15 |

## Frames

Each chip gives the frame id, the state, the theme and the size, then what the frame shows; a 320 chip holds only the theme and the size, and detail that does not fit sits in a note under the screen. Above a screen, the `title` annotation is the document title and the `url` annotation the address bar, where the frame depends on it. Neither is UI. The PNGs were captured from the design page at device scale 1 and show each frame with its chip and annotations. 28 of the 78 frames have a PNG in this folder; a frame marked "Not exported" has none, and [Frames without a PNG](#frames-without-a-png) gives the reasons.

### Header

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| F0 | Header | Light, 1440 by 4388 | Issue, story, area, routes, personas, acceptance criteria, frames by row, assumptions and open questions; the approval status line and the ticked approval line | [shell-306-errors-f0-header-light.png](shell-306-errors-f0-header-light.png) |

### Row 1, a link the app cannot read (400)

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| BL1 | Link cannot be used | Light, 1440 by 900 | The route's error component in main; the h1 has focus. The list query was refused with `BAD_USER_INPUT`, `core.list.invalid_cursor`. Page actions are gone; no raw parameters and no code | [shell-306-errors-bl1-link-cannot-be-used-light.png](shell-306-errors-bl1-link-cannot-be-used-light.png) |
| BL2 | Link cannot be used | Dark, 1440 by 900 | As BL1 | Not exported |
| BL3 | In a new tab | Light, 320 by 640 | As BL1 with no earlier entry in this tab, so no Go back | [shell-306-errors-bl3-in-a-new-tab-light.png](shell-306-errors-bl3-in-a-new-tab-light.png) |
| BL4 | In a new tab | Dark, 320 by 640 | As BL3 | Not exported |
| BL5 | One setting ignored | Light, 1440 by 900 | The page renders with the inline status. Opened as `?status=shipped&q=100`: the status key fell back to its default and the route dropped it with a replace navigation | [shell-306-errors-bl5-one-setting-ignored-light.png](shell-306-errors-bl5-one-setting-ignored-light.png) |
| BL6 | One setting ignored | Dark, 1440 by 900 | As BL5 | Not exported |

### Row 2, not found outside a module (404)

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| NF1 | Unknown path in a plant | Light, 1440 by 900 | No route matches under the plant layout, so `defaultNotFoundComponent` renders inside it at `/plant-a/reports`; no current sidebar entry, the h1 has focus | [shell-306-errors-nf1-unknown-path-in-a-plant-light.png](shell-306-errors-nf1-unknown-path-in-a-plant-light.png) |
| NF2 | Unknown path in a plant | Dark, 1440 by 900 | As NF1 | Not exported |
| NF3 | Unknown path under /admin | Light, 1440 by 900 | Company admin Jonas Holm: `defaultNotFoundComponent` inside the admin frame; trail Admin, Page not found | [shell-306-errors-nf3-unknown-path-under-admin-light.png](shell-306-errors-nf3-unknown-path-under-admin-light.png) |
| NF4 | Unknown path under /admin | Dark, 1440 by 900 | As NF3 | Not exported |
| NF5 | Record not found | Light, 1440 by 900 | The owner threw `NOT_FOUND` for an unknown or hidden id: EmptyState, Back to Production orders; the id is not shown, page actions gone | [shell-306-errors-nf5-record-not-found-light.png](shell-306-errors-nf5-record-not-found-light.png) |
| NF6 | Record not found | Dark, 1440 by 900 | As NF5 | Not exported |
| NF7 | Record not found | Light, 320 by 640 | As NF5 at 320 | Not exported |
| NF8 | Record not found | Dark, 320 by 640 | As NF5 at 320 | Not exported |

### Row 3, the server failed (500)

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| SE1 | Server error | Light, 1440 by 900 | The list query returned `INTERNAL_SERVER_ERROR`, `core.internal`: a full page state in main with the correlation id, Try again and a way out; the h1 has focus | [shell-306-errors-se1-server-error-light.png](shell-306-errors-se1-server-error-light.png) |
| SE2 | Server error | Dark, 1440 by 900 | As SE1 | [shell-306-errors-se2-server-error-dark.png](shell-306-errors-se2-server-error-dark.png) |
| SE3 | Server error | Light, 1280 by 800 | As SE1 | Not exported |
| SE4 | Server error | Dark, 1920 by 1080 | As SE1 | Not exported |
| SE5 | Server error | Light, 320 by 640 | As SE1; the id wraps and the buttons stack | [shell-306-errors-se5-server-error-light.png](shell-306-errors-se5-server-error-light.png) |
| SE6 | Server error | Dark, 320 by 640 | As SE5 | Not exported |
| SE7 | Try again in progress | Light, 1440 by 900 | Try again in the D1 Button loading state with `aria-busy` and `aria-disabled`; focus stays on it | [shell-306-errors-se7-try-again-in-progress-light.png](shell-306-errors-se7-try-again-in-progress-light.png) |
| SE8 | Try again in progress | Dark, 1440 by 900 | As SE7 | Not exported |

### Row 4, the server cannot be reached

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| NC1 | No connection | Light, 1440 by 900 | Proposals opened from the sidebar while the network is down: no response. The socket dropped too, so the top bar shows the reconnecting chip; the h1 has focus | [shell-306-errors-nc1-no-connection-light.png](shell-306-errors-nc1-no-connection-light.png) |
| NC2 | No connection | Dark, 1440 by 900 | As NC1 | Not exported |
| NC3 | Still no connection | Light, 1440 by 900 | Try again failed: focus stays on Try again, the time of the last attempt under it | Not exported |
| NC4 | Still no connection | Dark, 1440 by 900 | As NC3 | Not exported |
| NC5 | No connection | Light, 320 by 640 | As NC1; the chip is a strip | Not exported |
| NC6 | No connection | Dark, 320 by 640 | As NC5 | Not exported |
| NC7 | Load while NorthMES restarts | Light, 1440 by 900 | 503 from Caddy at page load: no error page, the restarting strip and chip. Main has `aria-busy` with the ST23 skeleton; the shell retries and renders the page | [shell-306-errors-nc7-load-while-northmes-restarts-light.png](shell-306-errors-nc7-load-while-northmes-restarts-light.png) |
| NC8 | Load while NorthMES restarts | Dark, 1440 by 900 | As NC7 | Not exported |

### Row 5, maintenance page

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| MA1 | NorthMES not available | Light, 1440 by 900 | Caddy's static page while `app` is down, here at `/plant-a/planning/board`: the mark, a card with the h1, three paragraphs (the middle one is the `role=status` line) and Try again. No Shell, no tokens, no Plex | [shell-306-errors-ma1-northmes-not-available-light.png](shell-306-errors-ma1-northmes-not-available-light.png) |
| MA2 | NorthMES not available | Dark, 1440 by 900 | As MA1, dark by `prefers-color-scheme` | [shell-306-errors-ma2-northmes-not-available-dark.png](shell-306-errors-ma2-northmes-not-available-dark.png) |
| MA3 | Not available | Light, 320 by 640 | As MA1: the card loses its border and padding; Try again spans the width | Not exported |
| MA4 | Not available | Dark, 320 by 640 | As MA3 | Not exported |
| MA5 | At a station | Light, 1280 by 800 | `/station/press-4` at the station landscape size | [shell-306-errors-ma5-at-a-station-light.png](shell-306-errors-ma5-at-a-station-light.png) |
| MA6 | At a station | Dark, 800 by 1280 | As MA5 in portrait | Not exported |
| MA7 | NorthMES not available | Light, 1920 by 1080 | As MA1 | Not exported |
| MA8 | NorthMES is back | Light, 1440 by 900 | The check got an answer from `/health/ready`: the status line changes just before the page reloads the same URL | [shell-306-errors-ma8-northmes-is-back-light.png](shell-306-errors-ma8-northmes-is-back-light.png) |
| MA9 | NorthMES is back | Dark, 1440 by 900 | As MA8 | Not exported |

### Row 6, signed out (401, close code 4401)

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| SO1 | Session ended | Light, 1440 by 900 | A 4401 close on Production orders sent the tab to sign-in with the return URL. D2's sign-in layout with the info box; empty fields; the h1 has focus | [shell-306-errors-so1-session-ended-light.png](shell-306-errors-so1-session-ended-light.png) |
| SO2 | Session ended | Dark, 1440 by 900 | As SO1 | Not exported |
| SO3 | Session ended | Light, 320 by 640 | As SO1 at 320 | Not exported |
| SO4 | Back on the page | Light, 1440 by 900 | After Sign in: the return URL with its search kept, the h1 has focus | [shell-306-errors-so4-back-on-the-page-light.png](shell-306-errors-so4-back-on-the-page-light.png) |
| SO5 | Back on the page | Dark, 1440 by 900 | As SO4 | Not exported |

### Row 7, boot

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| BO1 | Loading NorthMES | Light, 1440 by 900 | The static main of `index.html` before the shell renders: main has `aria-busy`, nothing is focused, the skip link is hidden until focused | [shell-306-errors-bo1-loading-northmes-light.png](shell-306-errors-bo1-loading-northmes-light.png) |
| BO2 | Loading NorthMES | Dark, 1440 by 900 | As BO1 with the stored dark theme | [shell-306-errors-bo2-loading-northmes-dark.png](shell-306-errors-bo2-loading-northmes-dark.png) |
| BO3 | NorthMES could not start | Light, 1440 by 900 | `GET /api/v1/web/modules` answered 500. No sidebar, Help or account menu: nothing is known about the user or the modules; nothing is focused | [shell-306-errors-bo3-northmes-could-not-start-light.png](shell-306-errors-bo3-northmes-could-not-start-light.png) |
| BO4 | NorthMES could not start | Dark, 1440 by 900 | As BO3 | Not exported |
| BO5 | Could not start | Light, 320 by 640 | As BO3 at 320 | Not exported |
| BO6 | No answer at boot | Light, 1280 by 800 | The modules request got no response, or 502, 503 or 504. 1280 by 800 is also the station landscape size | [shell-306-errors-bo6-no-answer-at-boot-light.png](shell-306-errors-bo6-no-answer-at-boot-light.png) |
| BO7 | No answer at boot | Dark, 1280 by 800 | As BO6 | Not exported |

### Row 8, unsupported browser and HTTPS required

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| UB1 | Newer browser needed | Light, 1440 by 900 | The plain page that `/assets/browser-check.js` builds; no controls. The mark, the minimum versions as a list, the browser it found and what to do; system fonts and hex colors only | [shell-306-errors-ub1-newer-browser-needed-light.png](shell-306-errors-ub1-newer-browser-needed-light.png) |
| UB2 | Newer browser needed | Dark, 1440 by 900 | As UB1 with the stored dark theme | Not exported |
| UB3 | Newer browser | Light, 320 by 640 | As UB1 at 320 | Not exported |
| HS1 | HTTPS required | Light, 1440 by 900 | Boot stopped at the secure context check. Open with HTTPS is a link to the same host, path and search with https | [shell-306-errors-hs1-https-required-light.png](shell-306-errors-hs1-https-required-light.png) |
| HS2 | HTTPS required | Dark, 1440 by 900 | As HS1 | Not exported |
| HS3 | HTTPS required | Light, 320 by 640 | As HS1; the address wraps | Not exported |

### Row 9, long strings

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| LS1 | Server error, German | Light, 1440 by 900 | SE1 with German chrome, company, plant and user, and the page text in German. The long plant name truncates in the switcher head and the plant crumb, as D2 draws it | [shell-306-errors-ls1-server-error-german-light.png](shell-306-errors-ls1-server-error-german-light.png) |
| LS2 | Server error, German | Dark, 1440 by 900 | As LS1 | Not exported |
| LS3 | Finnish plugin page, server error | Light, 1280 by 800 | Tool life of the plugin Acme tooling; the route title in the h1 carries `lang` fi. Tool life is the module's first entry, so the way out is Alle Seiten anzeigen | Not exported |
| LS4 | Maintenance | Light, 320 by 640 | MA3 with the German layout text | Not exported |

### Row 10, keyboard and focus

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| KF1 | Tab order, server error | Light, 1440 by 900 | SE1 with every Tab stop numbered in DOM order: the skip link, the sidebar, the top bar, then the panel. The h1 has focus on arrival and is no stop, so the next Tab reaches the skip link | [shell-306-errors-kf1-tab-order-server-error-light.png](shell-306-errors-kf1-tab-order-server-error-light.png) |
| KF2 | Try again pressed | Light, 720 by 400 crop | SE7: the request runs and the button keeps focus with `aria-busy` and `aria-disabled`; on success focus moves to the h1 (KF3) | Not exported |
| KF3 | Data loaded | Light, 1440 by 900 | Production orders rendered after KF2, focus on its h1; no live message, the focused h1 is read | Not exported |
| KF4 | Copy correlation id | Dark, 720 by 320 crop | Crop of SE2: focus stays on Copy correlation id; the polite region says Correlation id copied once | Not exported |
| KF5 | Open without these settings | Light, 720 by 320 crop | BL1 with the link focused. Enter opens the same path with no search keys, with replace, and focus moves to the route's h1 (KF6) | Not exported |
| KF6 | Settings dropped | Light, 1440 by 900 | After KF5: Production orders in its default view, the URL without search, focus on the h1, because the button that had focus is gone | Not exported |
| KF7 | Back to the list | Dark, 720 by 320 crop | Crop of NF6 with focus on Back to Production orders; Enter opens Production orders and focus moves to its h1 | Not exported |
| KF8 | Maintenance page focus | Light, 720 by 400 crop | MA1: Try again, the only stop, with the inline ring: outline 2 px `#171b1f`, offset 2 px, band 2 px `#f9fafb` | Not exported |
| KF9 | Inline ring | Dark, 320 by 640 | MA4 with Try again focused: outline `#f0f2f4`, band `#151719` | Not exported |
| KF10 | Session ended, tab order | Light, 1440 by 900 | SO1: the h1 has focus on arrival; then the skip link, the two fields, Show password and Sign in. Polite region, once: Your session ended. Sign in again to continue. | Not exported |
| KF11 | Boot failure, tab order | Light, 1440 by 900 | BO3: a first load, so nothing is focused; the skip link, Copy correlation id, Reload page. Polite region, once: NorthMES could not start. | Not exported |
| KF12 | HTTPS page, tab order | Dark, 1440 by 900 | HS2: nothing is focused on the first load; the skip link, then Open with HTTPS | Not exported |
| KF13 | Not obscured | Dark, 320 by 640 | SE6 with Go to Planning board focused and the sticky block measured. The page fits the screen, so it does not scroll here; on a taller page the browser scrolls a focused control to `scroll-padding-top`, 8 px under the sticky top bar | Not exported |
| KF14 | Focus ring on every new control | Light, 1440 by 900 | Annotation, as D2 KE17: every control this page adds, ringed | Not exported |
| KF15 | Focus ring on every new control | Dark, 1440 by 900 | As KF14 | Not exported |

### Row 11, build notes

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| BN | Build notes, not part of the UI | Light, 2960 by 6042 | Components, tokens, icons, roles, focus, announcements, titles, the error classification, the pages without the shell, the static page rules, WCAG 2.2 criteria and the final English copy | [shell-306-errors-bn-build-notes-light.png](shell-306-errors-bn-build-notes-light.png) |

### Frames without a PNG

- Dark twins of an exported light frame at the same size, with the same layout and the D1 dark tokens: BL2, BL4, BL6, NF2, NF4, NF6, SE6, SE8, NC2, NC8, SO2, SO5, BO4, BO7, HS2, LS2. MA9 and UB2 are the dark twins of MA8 and UB1 with the hex dark values of the static pages. SE2, MA2 and BO2 show the dark theme.
- Other sizes of an exported state: SE3 at 1280 and SE4 at 1920 in dark (SE1); NF7 and NF8 at 320 (NF5); NC5 and NC6 at 320 (NC1); MA3 and MA4 at 320, MA6 in portrait in dark and MA7 at 1920 (MA1, MA5); SO3 at 320 (SO1); BO5 at 320 (BO3); UB3 at 320 (UB1); HS3 at 320 (HS1). SE5 and BL3 show the 320 reflow.
- Variants of an exported state: NC3 and NC4, NC1 after a failed Try again; LS3, the Finnish plugin page at 1280; LS4, MA3 with the German text. LS1 shows the long strings.
- KF2 to KF15: where focus goes and what the polite region says after each action, which the focus, announcement and WCAG tables below record. KF1 shows the Tab order.

## Build notes

The build notes frame BN, marked on the page as not part of the UI, is for the shell's error, not-found and boot handling in E04-S02 to E04-S05, the page states of E04-S07 and the maintenance page of the release bundle in E17-S02. This section carries it over. A line marked doc is verbatim from the docs, D2 marks approved copy from the D2 record, and every other line is proposed and needs Krister Johansson's yes.

### Components by shadcn name

| shadcn | Used for | Frames |
|---|---|---|
| Card | The state panel in main; the sign-in, boot and HTTPS cards | All |
| Button, variant default | Open {route title} without these settings, Go to {plant}, Go to Overview, Back to Production orders, Try again, Reload page, Open with HTTPS | All |
| Button, variant outline | Go back, See all pages, Go to {first entry} | BL, NF, SE |
| Button, size icon (IconButton) | Copy correlation id; the label is required | SE, BO3 to BO5 |
| Button loading state (D1 Q8) | Try again while the request runs: LoaderCircle and the progress label Trying again, full opacity, `aria-busy`, `aria-disabled` | SE7, SE8, KF2 |
| Alert, info tone | One setting ignored; Your session ended | BL5, BL6, SO1 to SO3 |
| Alert, warning tone, and the D2 Badge chip | The restarting strip and the reconnecting chip, from `Shell.dc.html` | NC1 to NC8 |
| Skeleton (LoadingState) | The page while NorthMES restarts, as D2 ST23 | NC7, NC8 |
| Empty state pattern (EmptyState) | Record not found, page not found | NF |
| Error state pattern (ErrorState) | Link cannot be used, server error, no connection, boot failure, HTTPS | BL, SE, NC, BO, HS |
| SkipLink | First stop on the shell, sign-in, boot and HTTPS pages | All but MA, UB |
| None | The maintenance page and the unsupported browser page: plain HTML elements styled to match | MA, UB |

### What decides the page

One classifier in `@northmes/web-sdk` reads `code` and `errorCode` (plan 05, GraphQL errors). The first matching row wins.

| Signal | Page or state | Frames |
|---|---|---|
| A search key fails its own schema | The page renders; one setting ignored | BL5, BL6 |
| `validateSearch` throws, `BAD_USER_INPUT` or REST 400 on the route's primary request | Link cannot be used | BL1 to BL4 |
| Unmatched path in a plant, or under `/admin` | Page not found in that layout | NF1 to NF4 |
| Unmatched path under a loaded module | D2 ST5 | |
| Unknown plant slug | D2 ST29 | |
| `NOT_FOUND` on the route's entity | Record not found | NF5 to NF8 |
| `FORBIDDEN` on the route's primary request, close code 4403 | #304, not drawn here | |
| HTTP 401, `UNAUTHENTICATED`, close code 4401 | Session ended, sign-in | SO1 to SO5 |
| `CONFLICT` or REST 409, `PRECONDITION` or REST 412 | The form or dialog that sent the command shows it, such as the version conflict in #222 ([DE19](../ui/ui-222-list-form.md#row-3-detail-forms-dialogs-and-the-review-step)); not a page | |
| `INTERNAL_SERVER_ERROR`, HTTP 500, any other error status | Server error | SE1 to SE8 |
| 502, 503, 504 from `/graphql` or `/api` | Restarting strip and skeleton, retry | NC7, NC8 |
| No response or timeout | No connection | NC1 to NC6 |
| The route component throws while it renders | D2 ST6 | |
| Failed dynamic import, `core.client_outdated`, `GRAPHQL_VALIDATION_FAILED` | D2 ST3 reload dialog | |
| `NOT_FOUND` or `FORBIDDEN` on a relation path in a list | Cell state, not a page | |
| A secondary region's request fails (a widget, a side panel, a tab) | That region's ErrorState, not the page | |
| Modules request fails at boot | NorthMES could not start, no answer at boot | BO3 to BO7 |
| No secure context at boot | HTTPS required | HS1 to HS3 |
| `CSS.supports` false in `browser-check.js` | Newer browser needed | UB1 to UB3 |
| Caddy cannot reach `app` on a full page load | Maintenance page | MA1 to MA9 |

### Pages with and without the shell

None of the pages outside the shell shows Help or an account menu, because none of them knows the user. Their header holds only the mark, as on the sign-in page.

| Page | Renders | Why |
|---|---|---|
| Link cannot be used, one setting ignored, record not found, server error, no connection, page load while restarting | Inside `Shell.dc.html`, plant mount, in main | The shell, its routes and the plant are loaded; only the route's data failed (plan 06, Page states) |
| Unknown path in a plant | Inside the Shell, plant mount, no current entry | `defaultNotFoundComponent` renders in the nearest parent layout (`notFoundMode` fuzzy; ADR 0062) |
| Unknown path under /admin | Inside the Shell, `mount="admin"` | As above, in the admin layout |
| Back on the page after sign-in | Inside the Shell | The return URL is an ordinary route |
| Session ended | Outside: D2's sign-in layout | No session, so no plant, sidebar or menus |
| Boot, NorthMES could not start, no answer at boot | Outside: the static main of `index.html`, with D1 tokens and Plex from the shell stylesheet | The shell has not rendered; boot errors are a heading plus text (plan 06, Boot sequence) |
| HTTPS required | Outside: the static main, with tokens and Plex | Boot stops before the modules request |
| Newer browser needed | Outside: a plain page from `browser-check.js`, own sheet, hex colors, system fonts | No app script runs, and the browser may not support the token colors |
| Maintenance | Outside: Caddy's static file, inline CSS and script, system fonts | The app is down; Caddy serves the file without it (ADR 0044) |

### Server error page (SE) against D2's error panel (ST6)

| Aspect | Error panel, D2 ST6 | Server error page, SE |
|---|---|---|
| Cause | The route's component threw while React rendered it: a fault in the remote's code | The server answered the route's data request with an error: a fault on the server |
| Data | The data may have loaded; the screen failed to draw it | No data arrived |
| Reported | The route error component posts stage `render` to `/api/v1/web/client-errors` | Nothing from the browser: the server's exception filter already logged the masked error with its correlation id |
| Correlation id | Shown; the docs name no source for a render error | From the failed response (`extensions.correlationId` or the problem body), the id of the server's log line |
| Rows | Correlation id, Stage `render`, Code `web.render_error` | Correlation id, Code `core.internal`; no Stage, since stages name client lifecycle steps (E6) |
| h1 and title | {route title} could not be shown | {route title} could not be loaded |
| Try again | Renders the route again from the same data; focus to its h1 | Sends the request again; the button keeps focus in its loading state; focus to the h1 on success |
| Shared | Card with the ErrorState pattern in main, CircleAlert in `--destructive`, the D2 second paragraph, Copy correlation id, the way out to the module's first entry, sidebar and crumbs kept, page actions removed, h1 focused, no live message on arrival | Same |

### Landmarks, roles and names

| Element | Role and state | Name |
|---|---|---|
| State panel | Inside main; no role | |
| Description list | `dl` with `dt` and `dd` | |
| Copy correlation id | button | Copy correlation id |
| Try again in progress | button, `aria-busy`, `aria-disabled` | Trying again |
| One setting ignored | Alert without a live role | |
| Session info box | group named by its h2, no live role | Your session ended |
| Maintenance status paragraph | `role="status"` | |
| Boot main | main, `aria-busy` while loading | |
| Version list | `ul` | |
| Page heading | h1, `tabindex -1` | The page's heading |

### Where focus goes

| Control or event | Focus after |
|---|---|
| Arrival on BL, NF, SE, NC, SO | The h1 |
| Arrival on BO, UB, HS, MA (first load) | Nothing; the first Tab reaches the first stop |
| Open {route title} without these settings | The route's h1 (the one exception to the search-change rule, because the focused button disappears) |
| Go back, Go to {plant}, Go to Overview, Go to {first entry}, See all pages, Back to {list} | The new page's h1 |
| Try again (server error, no connection) | Stays on the button while it runs; the h1 on success; stays on failure |
| Copy correlation id | Stays on the button |
| Reload page, maintenance Try again, Open with HTTPS | A fresh page load; nothing focused |
| Sign in after a session ended | The return page's h1 |
| No connection, the page loads by itself | The h1, when focus was on the h1, in main or on Try again; otherwise unchanged |

### Announcements

Messages go once through the polite region in `index.html` outside `#root`. Status boxes carry no live role of their own, except the maintenance page's `role="status"` paragraph, which has no app.

| When | How | Text |
|---|---|---|
| Arrival on a state page | None | The focused h1 is read |
| A search key dropped | Polite, once | This link had 1 setting that no longer applies, so it was ignored. (doc) |
| Correlation id copied | Polite, once | Correlation id copied (D2) |
| Try again failed, server error | Polite, once | {route title} still could not be loaded. The correlation id changed. |
| Try again failed, no connection | Polite, once | Still no connection to NorthMES. |
| Session ended | Polite, once | Your session ended. Sign in again to continue. (D2 S4) |
| Boot failed | Polite, once | NorthMES could not start. |
| Maintenance check answered | The `role="status"` paragraph changes | NorthMES is back. Opening it now. |
| Restarting | Polite, once | D2's strip text |

### Titles

Pattern: specific part, plant, NorthMES. A page without a plant leaves the plant out; a page under `/admin` puts Admin in its place.

| Title | Frames | Source |
|---|---|---|
| Production orders could not open this link · Plant A · NorthMES | BL1 to BL4 | proposed |
| Production orders · Plant A · NorthMES | BL5, BL6, NC7, NC8, SO4, SO5, KF3, KF6 | D2 |
| Page not found · Plant A · NorthMES | NF1, NF2 | proposed |
| Page not found · Admin · NorthMES | NF3, NF4 | proposed |
| Production order not found · Plant A · NorthMES | NF5 to NF8 | proposed |
| Production orders could not be loaded · Plant A · NorthMES | SE1 to SE8 | proposed |
| No connection to NorthMES · Plant A · NorthMES | NC1 to NC6 | proposed |
| NorthMES is not available right now · NorthMES | MA1 to MA9 | proposed |
| Sign in · NorthMES | SO1 to SO3 | D2 |
| Loading · NorthMES | BO1, BO2 | proposed |
| NorthMES could not start · NorthMES | BO3 to BO7 | proposed |
| NorthMES needs a newer browser · NorthMES | UB1 to UB3 | proposed |
| NorthMES needs HTTPS · NorthMES | HS1 to HS3 | proposed |

### Final English copy

Sentence case, no dashes. Braces mark values the page fills in; a middle dot separates strings in one cell.

| Group | Copy | Source |
|---|---|---|
| Link cannot be used | "{route title} could not open this link" | proposed |
| | "The link holds settings this page cannot use, such as a filter value or a position in the list that no longer exists." | proposed |
| | "Open the page without these settings, or go back to the page you came from." · "Open the page without these settings." | proposed |
| | "Open {route title} without these settings" · "Go back" | proposed |
| One setting ignored | "This link had 1 setting that no longer applies, so it was ignored." | doc |
| | "This link had {n} settings that no longer apply, so they were ignored." | proposed |
| Not found | "Page not found" | doc |
| | "{plant} has no page at {path}. The link may be out of date." · "Admin has no page at {path}. The link may be out of date." | proposed |
| | "Go to {plant}" · "Go to Overview" | proposed |
| | "See all pages" | D2 |
| | "{entity type} not found" · "This production order does not exist in {plant}, or you cannot open it. The link may be out of date." · "Back to {list}" | proposed |
| Server error | "{route title} could not be loaded" | proposed |
| | "The server stopped with an error while it loaded the data for this page. Saved data is not affected." | proposed |
| | "Try again. If the error comes back, give your plant admin the correlation id." · "Correlation id copied" · "Try again" | D2 |
| | "Correlation id" · "Code" · "Copy correlation id" · "Go to {first entry}" | D2 |
| | "Trying again" | proposed |
| | "{route title} still could not be loaded. The correlation id changed." | proposed |
| No connection | "No connection to NorthMES" | doc |
| | "{route title} could not load, because this browser cannot reach the NorthMES server. Check the network connection of this computer." | proposed |
| | "The page loads by itself when the connection is back." · "Still no connection at {time}." · "Still no connection to NorthMES." | proposed |
| Restarting | "NorthMES is restarting. Changes are paused until it is back; you do not need to reload." | D2 |
| | "Live updates paused, reconnecting" | doc |
| Maintenance | "NorthMES is not available right now" · "NorthMES is restarting or being updated. Saved data is not affected." | proposed |
| | "This page checks every 10 seconds and opens NorthMES again by itself when it is back. You do not need to reload." | proposed |
| | "NorthMES is back. Opening it now." · "If NorthMES stays unavailable, tell your plant admin." · "Try again" | proposed |
| Session ended | "Sign in to NorthMES" · "Your session ended. Sign in again to continue." | D2 |
| | "Your session ended" · "Sign in again to go back to the page you were on." | proposed |
| Boot | "Loading NorthMES" | doc |
| | "Starting NorthMES in this browser." · "NorthMES could not start" | proposed |
| | "The server sent an error when this browser asked which modules to load, so no page can open." | proposed |
| | "Reload to try again. If NorthMES still does not start, give your plant admin the correlation id." | proposed |
| | "NorthMES did not answer. It may be restarting, or this browser cannot reach the server." · "This page tries again every 10 seconds and opens NorthMES when it answers." | proposed |
| | "Reload page" | D2 |
| Newer browser needed | "NorthMES needs a newer browser" · "NorthMES runs in these browsers, in this version or newer:" | proposed |
| | "Chrome 111" · "Edge 111" · "Firefox 128" · "Safari 16.4" | doc |
| | "This browser is {browser} {version}." · "NorthMES could not tell which browser this is." | proposed |
| | "Update this browser, or open NorthMES in one of the browsers above. If you cannot update it, ask your IT department." | proposed |
| HTTPS required | "NorthMES needs HTTPS" | proposed |
| | "This page was opened over HTTP, which is not secure. NorthMES checks every module it loads, and browsers allow that check only over HTTPS." | proposed |
| | "Open NorthMES at its HTTPS address. If that does not work, ask your IT department." · "Address" · "Open with HTTPS" | proposed |

Plant A, Acme AB, Alex Lund, Jonas Holm, the correlation ids, the paths and the host `mes.acme.example` in the frames are fictional.

### Long-strings text, a layout test, not copy

The screen root carries `lang="de"`; the Finnish route title carries `lang="fi"`.

- LS1, LS2: "Fertigungsaufträge konnten nicht geladen werden" · "Beim Laden der Daten für diese Seite ist auf dem Server ein Fehler aufgetreten. Gespeicherte Daten sind nicht betroffen." · "Versuchen Sie es erneut. Wenn der Fehler wieder auftritt, geben Sie Ihrer Werksadministration die Korrelations-ID." · "Korrelations-ID" · "Code" · "Korrelations-ID kopieren" · "Erneut versuchen" · "Zur Plantafel"
- LS3: "Työkalujen käyttöikä konnte nicht geladen werden", the first two words in `lang="fi"`; the rest as LS1; the outline action "Alle Seiten anzeigen"
- LS4: "NorthMES ist gerade nicht verfügbar" · "NorthMES wird neu gestartet oder aktualisiert. Gespeicherte Daten sind nicht betroffen." · "Diese Seite prüft alle 10 Sekunden und öffnet NorthMES wieder von selbst, sobald es zurück ist. Sie müssen nicht neu laden." · "Wenn NorthMES nicht verfügbar bleibt, wenden Sie sich an Ihre Werksadministration." · "Erneut versuchen"

### Tokens and the values copied from D2

Every UI color on the shell, sign-in, boot and HTTPS frames is a D1 token: `--background`, `--foreground`, `--card`, `--card-foreground`, `--border`, `--input`, `--muted-foreground`, `--accent`, `--primary`, `--primary-foreground`, `--primary-hover`, `--destructive`, `--warning`, `--warning-subtle`, `--info`, `--info-subtle`, `--focus-outline`, `--focus-ring`; sizes `--radius`, `--nm-control-height`, `--nm-target-min`, `--nm-target-min-station`; fonts `--font-sans`, `--font-mono`.

- State panel: `.panel` (D1) plus a grid with a 16 px gap and max-width 640 px; the head row an icon of 24 px and the lead at 16 / 24, 500; paragraphs max 72ch.
- Description list: a top border, rows of a 140 px label and the value, min-height 40 px, 6 px padding above and below, 1 px `--border` under each; 8 px between a value and its Copy button, so the focus ring clears both (D2 ST6 has 4 px); labels 12 / 16, 600, `--muted-foreground`; data in Plex Mono 13 / 18, 500, with `overflow-wrap: anywhere`. At 320 the label sits above the value.
- Actions wrap with 8 px gaps; at 320 they stack and span the width, 36 px high for one line of label (7 px padding above and below), 44 px on the pages a station can show.
- Copy correlation id is an IconButton of 36 by 36 px (44 by 44 px on the boot failure page) that never shrinks; the id wraps beside it.
- Sign-in card: main padding 96 px 24 px 24 px, card 416 px wide (600 px for the boot, boot failure and HTTPS cards, so the boot card keeps its width when boot fails), 32 px padding, 20 px gap, `--radius-xl`; h1 28 / 34, 600, at 320 24 / 30; the status box 12 px 14 px padding, `--radius`, title 14 / 20, 600, with a 16 px icon.
- Mark: 24 px square, `--radius-sm`, 13 px bold N, word 15 / 20, 700.
- Controls on the pages a station can show (boot failure, maintenance, HTTPS) are 44 px high, `--nm-target-min-station` (proposed, E13).

### Inlined values for the static pages

Converted from D1's oklch tokens to sRGB hex. Ratios measured on the hex values: text on page 16.57:1 light, 16.01:1 dark; text on card 17.31:1 and 14.60:1; muted text on page 6.54:1 and 8.06:1, on card 6.84:1 and 7.34:1; button text on button 14.68:1 and 15.19:1; focus outline on page 16.57:1 and 16.01:1.

| Role | D1 token | Light | Dark |
|---|---|---|---|
| Page | `--background` | `#f9fafb` | `#151719` |
| Card | `--card` | `#ffffff` | `#1d2022` |
| Text | `--foreground` | `#171b1f` | `#f0f2f4` |
| Muted text | `--muted-foreground` | `#575b60` | `#aaaeb3` |
| Card and header border | `--border` | `#dbdee1` | `#3a3d41` |
| Button | `--primary` | `#22272c` | `#e9ebee` |
| Button text | `--primary-foreground` | `#fcfcfc` | `#13161a` |
| Button hover | `--primary-hover` | `#383e43` | `#cfd1d3` |
| Focus outline | `--focus-outline` | `#171b1f` | `#f0f2f4` |
| Focus ring band | `--focus-ring` | `#f9fafb` | `#151719` |

### The maintenance page file, proposed unless marked

- One self-contained HTML file in the release bundle next to the vendor Caddyfile: inline `<style>`, inline `<script>`, the mark as inline markup; no web font, no icon library, no `tokens.css`, no request except the check. A request for a separate asset would hit the stopped app and get this page back.
- Served by `handle_errors 502 503 504` with status 503 and `Retry-After: 15` (doc). Caddy sets a CSP header for this response with hashes for the inline style and script and `connect-src 'self'`.
- Head: `<meta charset="utf-8">`, the viewport meta without `maximum-scale`, `<meta name="color-scheme" content="light dark">`, the title.
- Fonts: `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`. Sizes in rem: body 1rem / 1.5rem; h1 1.75rem / 2.125rem from 768 px up, 1.5rem / 1.875rem below. The card is at most 37.5rem wide, as the boot card.
- Colors: the hex values above, light in `:root`, dark in `@media (prefers-color-scheme: dark)` (doc in #306). Radius 6 px on the button, 8 px on the card. Below 768 px the card loses its border and padding and Try again spans the width.
- The check: a script requests `/health/ready` every 10 seconds (doc interval) with `cache: "no-store"`; on a 200 it writes "NorthMES is back. Opening it now." into the status element and reloads the same URL. It never reloads while the app is down, so a screen reader is not moved to the top every 10 seconds (F41 under 2.2.1). Without script, a `<meta http-equiv="refresh" content="10">` inside `<noscript>` reloads instead.
- Try again is a real link to the current URL, 44 px high, so it works without script.
- Focus ring with inlined values: a 2 px outline in the text color at a 2 px offset plus a 2 px box-shadow in the page color, on `:focus-visible`.
- The button keeps a 1 px transparent border, so forced-colors mode draws its edge; no `forced-color-adjust`. No animation.
- The page also serves `/station/...`; an unattended station comes back within 30 s after the app is up (doc), which the 10 s check meets (plan 09, section 9).
- On the canvas the class `er-x-dark` stands in for the media query and `er-x-n` for the narrow layout.

### The unsupported browser page, proposed unless marked

- `/assets/browser-check.js` is ES2017 and loads no other script (doc). It builds the page with DOM calls; its styles come from a static sheet such as `/assets/browser-check.css`, because the CSP refuses inline style elements.
- The sheet uses the hex values above, system fonts and plain selectors: no custom properties, `oklch()`, `color-mix()`, `@property`, nesting or `:has()`.
- Theme: the script reads the stored theme key; light by default. No controls, nothing focused.

### Shell props per frame

Every mount sets `bell="off"` (release 1 ships without the notifications module) and `show-title="on"`, with the hint height plus 36 px.

| Frames | Shell attributes |
|---|---|
| BL1 to BL4 | `nav="planning.orders" title="Production orders could not open this link" actions="none" focus="h1"` |
| BL5, BL6 | `nav="planning.orders"`; content: the inline status, then a placeholder naming the list and form page |
| NF1, NF2 | `nav="none" title="Page not found" crumbs="Page not found" doc-title="Page not found · Plant A · NorthMES" focus="h1"` |
| NF3, NF4 | `role="company-admin" mount="admin" nav="none" title="Page not found" crumbs="Admin\|Page not found" doc-title="Page not found · Admin · NorthMES" focus="h1"` |
| NF5 to NF8 | `nav="planning.orders" title="Production order not found" crumbs="Planning\|Production orders\|Production order not found" actions="none" focus="h1"` |
| SE1 to SE8 | `nav="planning.orders" title="Production orders could not be loaded" actions="none" focus="h1"`; SE7 and SE8 without focus, the ring on Try again |
| NC1 to NC6 | `nav="planning.proposals" title="No connection to NorthMES" actions="none" status="reconnecting" focus="h1"` |
| NC7, NC8 | `nav="planning.orders" status="both" banner-kind="warning" banner="NorthMES is restarting. ..." actions="none" busy="true" focus="h1"`; content: the ST23 skeleton |
| SO4, SO5 | `nav="planning.orders" focus="h1"` |
| LS1, LS2 | `strings="long" nav="planning.orders" title="Fertigungsaufträge konnten nicht geladen werden" actions="none" focus="h1"` |
| LS3 | `strings="long" width="1280" nav="acme.tool-life" heading="none" actions="none" page-lang="de"`; the h1 drawn in the content with its `lang="fi"` span and the ring |

### Icons, lucide 1.45.0

Decorative next to their text (`aria-hidden`). Link2Off, WifiOff, ShieldAlert and ArrowLeft are new to the D1 icon list (E20); the others are in D1 or D2.

| Icon | Where |
|---|---|
| Link2Off | Link cannot be used, `--muted-foreground` |
| SearchX | Page not found, record not found, `--muted-foreground` |
| CircleAlert | Server error, boot failure, `--destructive` |
| WifiOff | No connection, no answer at boot, `--warning` |
| ShieldAlert | HTTPS required, `--warning` |
| Info | One setting ignored, Your session ended, `--info` |
| LoaderCircle | Loading NorthMES; Try again in progress; no rotation under `prefers-reduced-motion` |
| RotateCw | Try again, Reload page |
| ArrowLeft | Go back, Back to Production orders |
| Copy | Copy correlation id |
| TriangleAlert | The restarting strip (D2) |

### WCAG 2.2 criteria

| Criterion | Where |
|---|---|
| 1.3.1 | Headings, the description lists, the version list, landmarks on every page |
| 1.4.1 | Icon and text on every state; the info, warning and error tones repeat the words |
| 1.4.3, 1.4.11 | D1 tokens; the static pages' measured values |
| 1.4.4, 1.4.10, 1.4.12 | The 320 frames; rem sizes; wrapping paths and ids |
| 2.1.1 | Every control by keyboard; KF frames |
| 2.2.1 | The maintenance check is no time limit and never reloads while the app is down; sessions last 7 days, above the 20 hour exception (plan 15) |
| 2.4.1 | Skip link on the shell, sign-in, boot and HTTPS pages; landmarks on the maintenance and unsupported browser pages |
| 2.4.2 | Unique titles |
| 2.4.3 | Focus to the h1 on arrival; retries keep focus |
| 2.4.4 | Action names carry their target: Go to Plant A, Back to Production orders |
| 2.4.5 | See all pages on the not-found pages |
| 2.4.6 | Each h1 names what happened |
| 2.4.7 | Two-tone ring on every stop, KF14, KF15 |
| 2.4.11 | `scroll-padding-top`, KF13 |
| 2.5.8 | 24 px minimum, 36 px shell controls, 44 px on the pages a station can show |
| 3.1.1, 3.1.2 | `lang="en"`; the Finnish route title in LS3 carries `lang="fi"` |
| 3.2.1, 3.2.2 | Nothing changes on focus; the maintenance page reloads only when the server answers, as its text says |
| 3.2.6 | Help keeps its place on the shell pages |
| 3.3.1 | The link and server error pages say what went wrong in text |
| 3.3.7 | The return URL keeps the page and its search after sign-in |
| 3.3.8 | The sign-in rules of D2 |
| 4.1.2 | Names, roles and states above |
| 4.1.3 | The announcements above, each read once |

### Rules for every frame

- Each screen has exactly one h1 and a unique title. The status code or correlation id shows only where it helps support: the correlation id and code on the server error and boot failure pages; the browser and version on the unsupported browser page; the address on the HTTPS page; the path on the unknown path pages; nothing on the link, record not found, no connection, maintenance and session pages.
- Each page says what happened in plain words and offers a way out or a retry; a record not found offers Back to {list}.
- Inside the shell the skip link, the sidebar with the switcher and user button, the top bar, the crumbs and Help keep their places; the route's page actions leave the top bar, as in ST6. The h1 is the state's own heading, rendered by PageFrame outside every data Suspense, `tabindex -1`, focused one frame after the route renders.
- A secondary region's failure never becomes the page state. The page while the server restarts shows no error component (plan 06, Failure handling).
- Outside the shell: a header with the mark only, then main with one h1, `<html lang="en">`. Boot, boot failure, HTTPS and session pages have the skip link first. On a first load nothing is focused. The boot screen and boot errors follow the stored theme, applied before first paint (E15).
- At 320 by 640 nothing scrolls sideways; long paths and correlation ids wrap; no fixed heights on text containers.
- Focus order equals the visual order. A retry keeps focus in its loading state; success moves focus to the h1; failure leaves focus on the button and says so once. The focused control is never under the sticky top bar. No single-key shortcut.

## Assumptions

The header frame lists these assumptions:

1. Every planner frame shows the planner Alex Lund at Plant A of Acme AB, except NF3 and NF4 (company admin Jonas Holm on `/admin`).
2. Release 1 has no bell, so every top bar ends with Help (D2 PL26).
3. TanStack Router's default `notFoundMode` fuzzy keeps the plant and admin layouts for an unknown path.
4. The no-access states (403, close code 4403) are #304's; station screens and their own failures are D4's. Only the maintenance and boot pages are drawn at station sizes.
5. The mark is D2's placeholder square with N.
6. D2's sign-in path `/sign-in`, the All pages index and the plant root `/{slug}` keep D2's open status (Q2, Q3).
7. The list on Production orders is a placeholder; the list and form page draws it.

## Open questions

The header lists E1 to E24, each with a recommended answer, and the frames draw that answer. E1 is the main conflict.

| Id | Question | What the frames draw |
|---|---|---|
| E1 | Issue #306 says search parameters that fail the route's search definition render the route's error component; ADR 0062 and plan 06 say each key falls back on its own and PageFrame shows a polite status. Which holds? | The docs: BL5 and BL6 draw the fallback; BL1 to BL4 cover a `validateSearch` that throws anyway and the server refusing the request. |
| E2 | Where does the status "This link had 1 setting that no longer applies" sit, how long does it stay, and does this page or the list and form page own it? | An inline info Alert under the h1, gone at the next navigation, owned by PageFrame; drawn in BL5. |
| E3 | Issue #306 names GraphQL INTERNAL; plan 05 sends `INTERNAL_SERVER_ERROR` with `core.internal`. | Plan 05's names, drawn in SE. |
| E4 | A DomainError of kind unavailable (GraphQL `UNAVAILABLE`, REST 503 from the app) at page load: server error page, or the restarting path? | The restarting path with retry, as NC7; not drawn separately. |
| E5 | The docs set no timeout for a page's data request. How long before No connection? | 30 seconds. |
| E6 | E04-S06 says route error components show the stage and the code; a failed data request has no client stage. | The server error page shows Correlation id and Code, no Stage. |
| E7 | The return URL's search key name and rules after a 401 or 4401 (D2 Q17). | `redirect`, a same-origin path with one leading slash, else `/`; after a plain sign-in, `/`. |
| E8 | A 401 or 4401 while a form holds unsaved input loses it on navigation. Open a dialog first, as the reload dialog does? | Navigate at once in release 1, as plan 06 says; sessions last 7 days, so the case is rare. |
| E9 | Prefill the username after a session ended? | No, as after Sign out (D2 SI19); planner PCs may be shared. |
| E10 | The maintenance page follows `prefers-color-scheme` (#306), while every other screen follows the stored choice, light by default. | `prefers-color-scheme`, as the issue says. |
| E11 | Plan 09 says the page retries every 10 s. A meta refresh reloads every 10 s and moves a screen reader to the top each time (F41). | A script that checks `/health/ready` and reloads only on an answer, with a `noscript` meta refresh as the fallback; Caddy sends a CSP with hashes. |
| E12 | E17-S02 says "Design: maintenance page (plain HTML, no design task)". | Its Design line names this page once approved. |
| E13 | 44 px controls on the boot failure, maintenance and HTTPS pages, which a station can show, against Graphite's 36 px. | 44 px, `--nm-target-min-station`. |
| E14 | Go to {plant} opens `/{slug}`, whose content is not decided (D2 Q3). | Keep the link; the plant root decides what opens. |
| E15 | The stored theme is applied by the shell entry, after the static boot markup paints, so a dark user sees a light flash. | A small external script in head applies the theme before first paint (the CSP allows `'self'`). |
| E16 | No client error stage fits a failed modules request at boot. | No browser report; the server logged the error. |
| E17 | Stage `insecure-context` is reported to `/api/v1/web/client-errors`, which needs the session cookie; the cookie is Secure, so it is not sent over HTTP. | Drop the report for this stage; Caddy's 308 makes the page rare. |
| E18 | Open with HTTPS goes to the same host with https; the certificate may name another host. | Keep the link; the page shows the address so IT can compare. |
| E19 | Does the All pages index list the admin pages on `/admin` (NF3)? | Yes, the pages the user can open in the current mount. |
| E20 | Four new icons: Link2Off, WifiOff, ShieldAlert, ArrowLeft. | Use them; the D1 icon list gains them. |
| E21 | The no connection page retries by itself and shows "Still no connection at {time}" after a failed Try again. Wanted? | Yes, drawn in NC3 and NC4. |
| E22 | D1's Button loading state swaps in a progress label, so Try again reads Trying again while the request runs (SE7, KF2), and the name changes with it. | Keep D1's pattern; the polite region still reports only the outcome. |
| E23 | Focus not obscured at 320 (KF13): the server error page fits a 320 by 640 screen, so it cannot scroll there. | KF13 shows the measured sticky block and the rule; the scroll case is checked on the list page at 320. |
| E24 | Plan 06 Page states says the Error state shows the correlation id. The link page (BL1 to BL4) shows none, also when the server refused the request with `BAD_USER_INPUT` and sent one; the no connection page (NC1 to NC6) has none to show. | No correlation id on the link page: the person fixes the link with Open without these settings, and plan 05 logs domain errors below error level. Plan 06 Page states gains: the correlation id where a response carried one and support needs it. |
