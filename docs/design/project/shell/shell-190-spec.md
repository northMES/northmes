# D2 shell, navigation and station frame: spec

Design task D2 is issue northMES/northmes#190 (plan id E04-S02-T01) under story E04-S02 (#40). The waiting UI tasks are those of E04-S02 to E04-S05 and the sign-in task of E05-S05 (#53). The page is `shell-190-navigation.dc.html`, and a variations page with three or more options comes first (`shell-190-variations.dc.html`), because the shell is a new kind of screen. The output is `docs/design/shell/shell-190-navigation.md` with its PNGs, plus the shared frames `Shell.dc.html` and `StationFrame.dc.html` that later pages mount.

This file lists every rule the shell and the station frame must satisfy, each with its source, then the content to draw, the layout axes along which the variations can differ, and the open questions. A rule marked "derived" follows from two or more cited rules but is not written anywhere as such. A rule marked "proposed" is not in the docs and needs Krister's yes.

## Source keys

All paths are relative to the root of the northMES/northmes repository.

| Key | File |
|---|---|
| I190 | GitHub issue #190 (sections Frames, Build notes needed, Output, Acceptance criteria) |
| P03 | `docs/plan/03-modules-and-extensibility.md` |
| P06 | `docs/plan/06-web-and-ux.md` |
| P07 | `docs/plan/07-production-planning.md` |
| P08 | `docs/plan/08-pyramid-connector.md` |
| P09 | `docs/plan/09-operator-station.md` |
| P10 | `docs/plan/10-ai-and-agents.md` |
| P12 | `docs/plan/12-operations-and-security.md` |
| P13 | `docs/plan/13-delivery-and-github.md` |
| P14 | `docs/plan/14-roadmap.md` |
| P16 | `docs/plan/16-open-questions.md` |
| README | `docs/plan/README.md` (Personas) |
| A0010, A0018, A0019, A0021, A0033, A0035, A0043, A0044, A0046, A0053, A0061, A0062, A0064 | `docs/adr/00NN-*.md` |
| D1 | `docs/design/ui/ui-189-tokens.md` (approved 2026-10-05) |
| G | `GLOSSARY.md` |

Inputs fixed before D2: the Graphite direction (IBM Plex Sans for text, IBM Plex Mono for numbers with tabular figures, 6 px radius, 36 px controls, near-black primary `#22272c` light and `#e9ebee` dark), light theme by default on every screen including stations, dark per user or per station (P06 Order of design work; A0061 Theme). The design project has no bound design system (D1 intro). The D1 page and its files, the `ui-d1-direction` pages and BRIEF.md are frozen and never written.

## 0. Page contract (what the D2 page must contain)

- 0.1 A variations round of three or more options before the spec page, because the shell is a new kind of screen. [P06 Order of design work, item 3; I190 Page line]
- 0.2 A header frame: owning issue (#190, story #40), area `shell` (maps to `apps/web`), routes (`/$plant/...` and `/station/$stationId`), primary persona from the persona list (Planner for the shell, Operator for the station frame; personas are Planner, Operator, Plant admin, Plugin developer, Maintainer, Hosting partner), acceptance criteria, assumptions and open questions. [P06 What every design page contains; README Personas]
- 0.3 Every frame in I190's list in light and dark. [I190 Acceptance criteria; P06 What every design page contains]
- 0.4 Widths: planner pages at 1280, 1440 and 1920 px plus a 320 px reflow frame; station frame at 1280 by 800, 1920 by 1080 and portrait. [I190 Frames; P06 What every design page contains]
- 0.5 One long-strings frame with German or Finnish labels and data at full length. [I190 Frames; P06 What every design page contains]
- 0.6 Keyboard and focus frames: tab order, keys, where focus goes after each action, the focus ring, and the sticky offsets that keep focus visible. [P06 What every design page contains]
- 0.7 States: populated, empty, loading as a skeleton of the populated layout, error with a way out, forms with field errors, the error summary and a server error that keeps values. For D2 the forms are the sign-in page. [P06 What every design page contains]
- 0.8 Build notes, marked as not part of the UI: shadcn components by their shadcn names, tokens from D1, keyboard and focus order, landmarks, ARIA roles, accessible names and announcements, slot ids and what a contribution may render there, final English copy, WCAG 2.2 criteria by number. [I190 Build notes needed; P06 What every design page contains]
- 0.9 States the shell owns (module unavailable placeholder and the rest of section 3) are drawn once, in the shell page; module pages mount `Shell.dc.html` and station pages mount `StationFrame.dc.html`. [P06 What every design page contains]
- 0.10 The implementer takes layout, region order, states and transitions, copy verbatim, the keyboard model and slot placements, never markup, class names, inline styles, token values, canvas icons or demo numbers. A value that is not a D1 token is a question, not a new color. When the design and the accessibility rules disagree, the rules win. [P06 Approval and what the implementer takes; P13 What the implementing agent does with a design]

## 1. Shell regions and what each holds

Root layout (shell route): landmarks, skip link, top bar, sidebar, and live regions outside `#root`. [P06 Shell routes and mount points]

### 1.1 Sidebar (`nav` landmark)

- 1.1.1 Three sections in this order: core items first, then module items, then plugins in their own section. The order comes from the manifests (`order` is required) and is stable (WCAG 3.2.3). Order never follows usage. [P06 Shell layout; A0062 Decision outcome; A0021 Shell services]
- 1.1.2 `/api/v1/web/modules` gives each module `kind` (`core`, `module` or `plugin`), which decides the section, plus `label` and `order` from the backend manifest, so a failed module keeps its entry and position. [P06 GET /api/v1/web/modules; A0062]
- 1.1.3 Each module is one sidebar group, headed by its manifest `web.label`, at its manifest order. [P06 Shell layout; A0062; P14 E04-S02]
- 1.1.4 A group's items are its nav entries, ordered by `nav.order`, then by declaration order. `nav.parent` nests an entry one level under another entry of the same module. Only one level of nesting exists. [P06 Shell layout; A0062]
- 1.1.5 Nav entries come only from routes: `screenRoute({ nav: { label, order?, parent?, search? } })`. An entry exists only on a route with a title, its `to` is the route's `fullPath`, a preset `search` makes an entry that links to that search, and its permission is the route's permission. `defineWebModule` has no nav list. [P06 Routes and typed links; A0062]
- 1.1.6 Nav entries carry no icon field: the shape is `{ label, order?, parent?, search? }`, and the manifest `web` block holds `label`, `permission`, `order`, `slots` and `contributes`. A design that shows an icon per entry or per module needs a contract change. [derived from P06 Routes and typed links and P03 manifest table]
- 1.1.7 Labels are plain strings, never React nodes. [P06 Rules the shell and CI enforce]
- 1.1.8 Nav items filter on the current plant's permissions; a route the plant's permissions deny has no entry. [P06 Plant switch; A0019 Plant switch; P14 E04-S02 tests]
- 1.1.9 A module that failed to load shows its group header with "(unavailable)" and no items, at its usual position; the sidebar order equals a run with all remotes present. [P06 Shell layout; P06 Failure handling; A0019]
- 1.1.10 Collapsed rail and a 320 px sheet are required frames. [I190 Frames; P06 Order of design work item 2]
- 1.1.11 Tokens: `--sidebar` surface, `--sidebar-foreground` text, `--sidebar-primary` with `--sidebar-primary-foreground` for the current item (14.62:1 light, 15.17:1 dark), `--sidebar-accent` hover, `--sidebar-border` divider, `--sidebar-ring` focus outline half; muted text on the sidebar is `--muted-foreground` (6.81:1 light). [D1 shadcn sidebar tokens; D1 Contrast P4, P10]
- 1.1.12 Proposed: the current entry carries `aria-current="page"`, and the sidebar `nav` has an accessible name distinct from the breadcrumb's.

### 1.2 Top bar (`header` landmark)

- 1.2.1 Holds the breadcrumb, a page actions slot, the live-updates status, one help menu at a fixed place, and the user menu. [P06 Shell layout]
- 1.2.2 Page actions: remotes fill the slot through the `TopBarActions` portal from `@northmes/ui`; `PageFrame` renders actions into the top bar slot. [P06 Shell layout; P06 Patterns in @northmes/ui]
- 1.2.3 Breadcrumb: `useBreadcrumbs()` returns `{ label, href }` for each route match with a title; a detail route yields module, list and entity crumbs. `PageFrame` takes `crumbs` and an optional `entityLabel`, which replaces the last crumb and the specific part of the title ("Order 1001 · Plant A · NorthMES"). Breadcrumb links render through `LinkProvider` (`ModuleLink`), so they never reload the document. [P06 Routes and typed links; A0062; P14 E04-S03]
- 1.2.4 Help menu: one menu at a fixed place (WCAG 3.2.6). Modules add entries through `help` in `defineWebModule` (`{ id, label, href }`), shown grouped by module under the module label. Modules never add their own top-level help. [P06 Shell layout; P06 defineWebModule; A0062; A0021 Shell services]
- 1.2.5 User menu: present; its contents are not listed in the docs (see open questions). The D1 build notes list the icons User, Sun and Moon. [P06 Shell layout; D1 Fonts and icons]
- 1.2.6 The top bar is sticky over the page scroller: the page scroller sets `scroll-padding-top` to the top bar height (2.4.11). [P06 Focus; D1 Keyboard and focus]
- 1.2.7 Live-updates status: "Live updates paused, reconnecting" shows in the top bar through the polite live region while the socket is down. [P06 Live data; A0018 Decision outcome; P14 E04-S05]

### 1.3 Plant switcher

- 1.3.1 A menu of links (WCAG 3.2.2), in the shell only; it is not a `@northmes/ui` component. Its place on the page is not fixed by the docs. [P06 Plant switch; P06 Patterns in @northmes/ui]
- 1.3.2 Each plant link keeps the current route and its search when the route's only path param is `$plant`. On a route with entity params it goes to the nearest ancestor route without them and drops the search ("on /plant-a/planning/orders/1 the plant-b link is /plant-b/planning/orders"). [P06 Plant switch; A0062; P14 E04-S04]
- 1.3.3 The plant lives in the URL (first path segment) and in a header on every request, never on the session, so two plants can be open in two tabs. [P06 Plant switch; P14 E04-S04]
- 1.3.4 A plant change either swaps permissions, presentation context and Apollo client in place, or does one full navigation when the module set differs. The design draws no intermediate state for either beyond the normal route loading state. [P06 Plant switch; derived]
- 1.3.5 An unknown plant slug is NOT_FOUND, never a default plant. [P06 Shell routes and mount points]

### 1.4 Main (`main` landmark)

- 1.4.1 `PageFrame` renders the `h1` (`tabindex="-1"`) from the route title outside every data Suspense, plus the breadcrumb and the actions into the top bar slot. Exactly one `h1` per route. [P06 Patterns in @northmes/ui; P06 Gates and tests]
- 1.4.2 `main` carries `aria-busy` while a route loads; loading states are skeletons of the populated layout. [P06 Shell layout; P06 Page states]
- 1.4.3 A link with a search key that fails its schema shows a polite status from `PageFrame`: "This link had 1 setting that no longer applies, so it was ignored." [P06 View state in the URL; A0062]

### 1.5 Aside slot (`aside` landmark) and the AI chat panel

- 1.5.1 One shell aside slot where the AI chat panel mounts, so it survives route changes. At most one panel docks beside `main`. Below about 640 px the chat panel opens as a modal sheet. [P06 Shell layout; A0035; P10 Chat panel]
- 1.5.2 Release 1 has the chat panel: the read-only planning assistant is in release 1 (last of the three AI features on the cut list). [P10 intro and Scope and cut order; A0035]
- 1.5.3 With no provider configured the feature is off and the panel is hidden. [P06 AI chat panel; A0035; P10]
- 1.5.4 The panel itself is designed in its own task under E14-S03 (#136). D2 draws the slot, its docked and sheet geometry and the trigger, not the panel's content. [P14 E14-S03 "Design: chat panel (a design task under this story)"; derived]
- 1.5.5 Panel rules the frame must leave room for: opening moves focus to the input, Escape or Close returns it to the trigger, a Stop button while streaming, a fixed header text "Written by an AI assistant. Check before you commit.", an "AI-generated" label on each assistant message, headings h3 to h6 under the panel's h2. [P06 AI chat panel; A0035]

### 1.6 Shell-wide singletons

- 1.6.1 One `Toaster`, one dialog stack. Toasts sit away from the board and form areas; toasts only echo what is visible elsewhere. [P06 Shell layout; P06 Focus; P06 Live regions]
- 1.6.2 Two live regions, polite and assertive, in `index.html` outside `#root`, with explicit `aria-live` and `aria-atomic`, so they work while a modal is open. [P06 Shell services; A0021]
- 1.6.3 An "All pages" index route in the shell lists every route title (WCAG 2.4.5). [P06 Shell routes and mount points; P06 Shell services]
- 1.6.4 Admin and planner banners the shell shows: an admin banner built from the `/health/ready` JSON [A0046; P14 E16-S02]; an admin banner fed by `ai.budget_state` (ok, warning, exhausted) [P10 Usage metering, budgets and audit; P14 E13-S05]; a 24-hour banner for admins and planners, "Data restored to <time>; changes after that were lost.", whose design E18-S04 assigns to D2 [P12 A production restore; P14 E18-S04 "Design: restore banner (part of D2)"].

## 2. Title pattern, landmarks and skip link

- 2.1 `<html lang="en">`; landmarks `header`, `nav`, `main`, `aside`. [P06 Shell services; A0021]
- 2.2 A "Skip to main content" link is the first focusable element and moves focus into `main` (2.4.1). The route suite checks on every route that the first Tab focuses the skip link and that it moves focus into `main`. [P06 Shell services; P06 Gates and tests; D1 Keyboard and focus]
- 2.3 SkipLink tokens: `--primary` with `--primary-foreground`, drawn focused. [D1 Components]
- 2.4 Title pattern: specific part first, then plant, then product: "Planning board · Plant A · NorthMES" (separator is the middle dot, U+00B7). With `entityLabel`: "Order 1001 · Plant A · NorthMES". Titles are unique per route. [P06 Shell services; P06 Routes and typed links; A0021; P06 Gates and tests]
- 2.5 Fixed title forms: placeholder "Production start unavailable · Plant A · NorthMES"; module not found "Page not found · <module label> · Plant A · NorthMES". [P06 Failure handling; P06 Shell routes and mount points; A0062]
- 2.6 `screenRoute` requires a title; placeholder routes, the error component and the reload dialog have a title and an `h1`. [P06 Shell services; A0021]
- 2.7 Boot: `index.html` ships a static `main` with an `h1` "Loading NorthMES" and a status line, so a failed boot still leaves a heading and text; a boot error renders as a heading plus text. [P06 Boot sequence]
- 2.8 Station routes are in the route suite (it enumerates `router.routesById`), so the station frame also needs the skip link, landmarks, a unique title and one `h1`. [derived from P06 Gates and tests and P09 tests "The station flows also run in the keyboard-only Playwright suite and the axe route suite"]

## 3. Failure and status states the shell owns

Issue frames first, then the other shell-owned states the docs name.

- 3.1 Module unavailable placeholder: route `/$plant/<id>/$` added for each failed module, title "<Label> unavailable · Plant A · NorthMES", one focused `h1`, and the stage and code of the failure (stages `manifest`, `entry`, `validate`, `render`, `slot`, `chunk`, `csp`, `insecure-context`). The sidebar shows the module header with "(unavailable)" and no items, at its usual position. [P06 Shell routes and mount points; P06 Failure handling; P06 Browser errors reach the server; A0043]
- 3.2 Slow remote: a per-remote loading indicator after 2 s, a retry with a new request, and the placeholder only after the timeout (10 s planner layout, 30 s station layout). [P06 Boot sequence; P06 Failure handling; A0019]
- 3.3 Module not-found page: each loaded module's subtree gets a `notFoundComponent` with the title "Page not found · <module label> · Plant A · NorthMES", one `h1` and a link to the module's first nav entry. The router's `defaultNotFoundComponent` covers all other paths. [P06 Shell routes and mount points; A0062; P14 E04-S02]
- 3.4 Error panel: a remote screen that throws renders `defaultErrorComponent` with a title and `h1`; header and menu stay. It shows the stage and code. The `ErrorState` pattern is "text error with the correlation id and a way out". [P06 Failure handling; A0043; P06 Page states]
- 3.5 Minimal status route: a shell route that still renders when the core remote fails, because System health lives in the core remote. [P06 Shell routes and mount points; A0019; A0043]
- 3.6 Blocking reload dialog: opens on a build mismatch, on `GRAPHQL_VALIDATION_FAILED`, on a failed dynamic import (lazy chunk missing), and on a changed supergraph hash or manifest integrity. While it is open, the client refuses mutations. It has a title and an `h1`. Stations reload by themselves only when idle, no form holds unsent input and the module versions changed. [P06 Live data; P06 Failure handling; A0021; P09 section 9]
- 3.7 "Live updates paused, reconnecting": top bar status through the polite region while the socket reconnects; the board's Pause control shares that state and board moves are disabled. The banner is gone after reconnect. [P06 Live data; P06 Failure handling; P14 E04-S05]
- 3.8 Server restarting (502 or 503 from `/graphql` or `/api`): the top bar shows that the server is restarting through the polite region, moves and mutations stay disabled, the shell retries and recovers without a reload; it must not show the route error component. A full page load gets Caddy's maintenance page. D2 owes the final English copy. [P06 Failure handling]
- 3.9 Close code 4401 sends the user to sign-in; close code 4403 shows an access message. [P06 Live data; A0018]
- 3.10 Unsupported browser: a plain page naming the browser and the minimum version (Chrome and Edge 111, Firefox 128, Safari 16.4), loaded by `/assets/browser-check.js` with no other script. [P06 Boot sequence; P06 Supported browsers; A0019]
- 3.11 Plain HTTP: a message that NorthMES needs HTTPS (stage `insecure-context`). [P06 Boot sequence; P06 Failure handling]
- 3.12 Slot contribution failure: a fallback inside that contribution's frame with a role and an accessible name; focus moves to it when focus was inside the widget; selecting another entity resets it. Contributions render in `WidgetFrame`, a section with `aria-labelledby` from the contribution's required `label`. [P06 Failure handling; P03 UI slots]
- 3.13 Unknown plant slug: NOT_FOUND, never a default plant. [P06 Shell routes and mount points]
- 3.14 The banners of 1.6.4 (readiness, AI budget, restore). [A0046; P14 E13-S05; P14 E18-S04]
- 3.15 Caddy's maintenance page (503, `Retry-After: 15`, `role=status`, retries every 10 s and returns to the original URL) is outside the shell; the design may show it for reference only. [P09 section 9, citing A0044]

## 4. Sign-in page

- 4.1 A shell route: Better Auth sign-in for planners and admins. Operators at a station sign in through the station screens (D4), not here. [P06 Shell routes and mount points; P09 section 3.2]
- 4.2 Fields: username or email, and password (Better Auth username plugin). [P14 E05-S05 user story; A0010 Decision outcome]
- 4.3 Accessible authentication (3.3.8): `autocomplete="username"` and `autocomplete="current-password"`, paste and autofill allowed, a show-password toggle, no CAPTCHA anywhere. [P06 Forms and sign-in; A0021 scope; P09 section 3.3]
- 4.4 A wrong password shows the error and keeps the username (3.3.7, tested by `e2e/sign-in.spec.ts`). [I190 Frames; P14 E05-S05 tests; P06 Forms and sign-in]
- 4.5 Errors: text next to the field, `aria-invalid`, `aria-describedby`, and an error summary at the top that receives focus on submit and links to each field (3.3.1, 3.3.3). Messages state the rule and the fix. [P06 Forms and sign-in; P06 Forms]
- 4.6 Sign-up is disabled, so the page has no "create account" path. [derived from A0010 and P14 E05-S05]
- 4.7 A password an administrator sets is temporary and must be changed at the next sign-in before any other request succeeds. [A0010; P09 section 3.1; P14 E05-S08]
- 4.8 Rate-limit storage is in the database; failed sign-in writes a security event. [P14 E05-S05]
- 4.9 The page has a title, one `h1`, the skip link and `main` like every route. [derived from P06 Gates and tests]
- 4.10 Proposed: the show-password toggle uses lucide `Eye` (D1 lists it for Q13), drawn here because D1 Q13 left the password toggle to D2, D4 or the form page.

## 5. Station frame

- 5.1 Route `/station/$stationId`: a shell layout, full screen, with no sidebar; the production-start remote fills it through `stationRoutes(stationRoute)`. [P06 Shell routes and mount points; P09 section 1; A0033]
- 5.2 Station remotes load with a 30 s timeout; every station chunk preloads right after sign-in. [P09 section 1; A0033]
- 5.3 Targets: `--nm-target-min` is 44 px in the station layout (`--nm-target-min-station`) until a glove test on pilot hardware sets the final value; every `@northmes/ui` primitive reads it, so shell chrome and plugin panels follow. At 1280 by 800 with touch, every visible interactive element, shell chrome included, measures at least 44 by 44 px. [P06 Target size; P09 section 4.4; P09 tests `station-targets.spec.ts`; D1 Shared values]
- 5.4 Sizes: 1280 by 800, 1920 by 1080 and portrait. [I190 Frames; P06 What every design page contains]
- 5.5 Devices: a shared PC at one or more machines with a keyboard-wedge badge reader, gloved hands and a network that can drop; the browser runs full screen in a persistent profile (for example Chrome `--kiosk` with a fixed `--user-data-dir`), never Edge kiosk mode. [A0033 Context; P09 section 11]
- 5.6 Theme: light by default, dark per station; the choice is stored per device in `localStorage` and applied before the first render. [P06 Order of design work; A0061 Theme]
- 5.7 Sign-in at the station: badge is the default; personal login (username and password) and badge plus PIN are options. A PIN is one `<input type="password" inputmode="numeric" autocomplete="current-password">` that accepts paste, never one box per digit; an on-screen keypad only adds digits to it. Personal login uses `autocomplete="username"` and `"current-password"`, paste and a show-password toggle. [P09 sections 3.2, 3.3; P06 Forms and sign-in]
- 5.8 Badge input is read only in the focused badge field (focused on load through a ref, not `autofocus`) and on the Switch operator screen. No global key listener (2.1.4, speech input). Every station screen has a visible Switch operator button. [P09 section 3.3; P06 Forms and sign-in]
- 5.9 A failed scan: "Badge not recognized. Scan again or sign in with your user name", next to the field and in the polite region. After sign-in, focus moves to the station heading, for example "Press 4, Anna Berg". [P09 section 3.3]
- 5.10 Disconnected state: a `role=status` banner "No connection to NorthMES. Entries stay on this screen and are not sent until the connection is back.", announced once on change. The top bar shows "Live updates paused, reconnecting" meanwhile. [P09 section 9; A0033]
- 5.11 Idle sign-off warning: a modal dialog 30 s before sign-off ("You will be signed out in 30 seconds. Stay signed in"), saying entries are kept. [P09 section 8; P06 Time limits]
- 5.12 The plant comes from the station credential; the station shows the station plant's zone and presentation values. A station has no plant switcher. [P09 sections 1, 2; derived]
- 5.13 Station screen content (sign-in screen, job list, report form, corrections) belongs to D4 (E11). D2 draws the frame with the no-operator and signed-in states as placeholders. [P13 Order; P14 E11 stories "Design: D4"]
- 5.14 Station numbers use the Station number type role: 2rem / 2.5rem (32 / 40), 600 Mono. [D1 Fonts and icons, type scale]

## 6. Widths, reflow, zoom, themes and long strings

- 6.1 Planner frames at 1280, 1440 and 1920 px and a 320 px reflow frame. [I190; P06 What every design page contains]
- 6.2 At 320 CSS px only the board grid and data tables scroll in two dimensions, each in its own container. Toolbars collapse into a menu, filters wrap, the detail panel becomes a full-width sheet and the chat panel a modal sheet. The reflow check at 320 by 640 fails on horizontal scroll outside the board and table containers. [P06 Reflow; P06 Gates and tests; A0021]
- 6.3 The sidebar becomes a sheet at 320 px. [I190 Frames; P06 Order of design work]
- 6.4 Text sizes in rem; 200 percent text zoom grows rows and text containers; no fixed heights on text containers except board blocks; no `maximum-scale` or `user-scalable=no`. [P06 Reflow; D1 Fonts and icons]
- 6.5 Text spacing (1.4.12): text containers grow. [D1 WCAG 2.2 criteria]
- 6.6 Light and dark for every frame; D1 tokens in both themes. [I190; D1 Tokens]
- 6.7 The UI ships in English only; labels stay plain strings so later translation is mechanical; master data text carries `lang` from the company's data-language setting. The long-strings frame shows German or Finnish labels and data at full length. [P06 Language, citing A0053; I190]
- 6.8 Media runs repeat the flows in forced colors, reduced motion and dark scheme. Under reduced motion, toasts do not slide. In forced colors the focus ring's outer half (an outline) survives. [P06 Gates and tests; P06 Color and contrast; D1 Focus ring]

## 7. Keyboard and focus rules for the shell

- 7.1 Focus order starts with the skip link. D1's list-page example order is: Skip to main content, the navigation links, the account button, search, the status filter, Clear filters, New order, the sortable column headers, the row links, Next; a disabled Previous is skipped. [D1 Keyboard and focus]
- 7.2 Route change (2.4.3): on `onRendered` with `pathChanged`, `focusPageHeading` waits one frame, focuses the `h1` and falls back to `main`. Search parameter changes (filters, zoom, `?view=table`) do not move focus. [P06 Shell services; A0021; D1 Keyboard and focus]
- 7.3 Every focus stop draws the two-tone ring: 2 px outline in `--focus-outline` at 2 px offset plus a 2 px `--focus-ring` box-shadow. Menu and listbox items draw a 2 px inset outline in `--focus-outline` on the `--accent` highlight instead. [D1 Focus ring; P06 Color and contrast]
- 7.4 Menus (help, user, plant switcher): Enter, Space or Down opens; Up and Down move; Enter activates; Escape closes; focus returns to the trigger. [D1 Keyboard and focus table, Dropdown Menu]
- 7.5 Dialog, Alert Dialog and Sheet (reload dialog, 320 px nav sheet, chat sheet): Tab and Shift+Tab stay inside, Escape closes, opening moves focus inside, closing returns it to the trigger. [D1 Keyboard and focus table; P06 Focus]
- 7.6 Tooltips (for example on a collapsed rail) open at once on focus, after a delay on hover, close on Escape without moving focus, and hold no interactive content (1.4.13). [D1 Components and Keyboard and focus; P06 Focus]
- 7.7 Focus not obscured (2.4.11): `scroll-padding-top` equals the sticky top bar height; docked panels sit beside content instead of over it; toasts sit away from board and form areas. [P06 Focus; D1 Keyboard and focus]
- 7.8 Focusing an element scrolls it into view and does nothing else (3.2.1); panels open on Enter or click. [P06 Focus; D1 Keyboard and focus]
- 7.9 Letter commands exist only while a board cell has focus (2.1.4), and stations have no global key listener; so the shell adds no single-character shortcut. [derived from P06 Moving board blocks and P09 section 3.3]
- 7.10 Targets: every interactive control is at least 24 by 24 CSS px (`--nm-target-min`); controls are 36 px (`--nm-control-height`); `IconButton` has a required `label` prop. [P06 Target size; P06 Patterns in @northmes/ui; D1 Shared values]
- 7.11 Keyboard-only end-to-end flows run without `page.mouse`; every shell control must be reachable and operable by keyboard. [P06 Gates and tests; D1 Keyboard and focus]

## 8. Content to draw

Values from the docs are marked (doc). Everything else is invented for the drawing and must not be read as a decision.

### 8.1 Plants and people

- Plants: "Plant A" (slug `plant-a`) and "Plant B" (`plant-b`) (doc: P06, A0062 tests). For the switcher menu, add two or three invented plants. Long-strings frame: an invented German or Finnish plant name of 35 to 45 characters.
- Planner "Alex Lund" (doc: P06 cluster example), second planner "Planner B" (doc: D1), operator "Anna Berg" at station "Press 4" (doc: P09). Machines "Mill 1", groups Milling and Turning (doc: D1 samples). Orders 1001, 5001.20, 5006.10 (doc).
- Draw two permission variants: a Planner and a Plant admin (persona list, README), because nav filters on permissions.

### 8.2 Release 1 modules and nav entries

Release 1 modules: core, audit, ai, planning, production-start, pyramid-connector, plus the plugins example-validator and example-widget (P03 Release 1 modules). Which of audit, ai and pyramid-connector ship their own remote is open (P03 Open items; P16 M-31; P06 Open points). The labels and order values below are a proposal unless marked.

| Section | Group (`web.label`) | Nav entries to draw | Source of the screen |
|---|---|---|---|
| Core | label not decided ("Core" or similar) | Master data (parent) with Equipment groups, Machines, Tools, Articles, Routings, Calendars, Warehouses, Customers; Users; Roles; Stations; Integrations; Settings; System health | P03 core row; P06 Master-data kit UI; G (`equipment` has UI label "Machine"); P14 E05-S06, E05-S08, E06-S05 to S10, E11-S01; A0021 test names "Integrations"; A0043 System health |
| Module | Planning (doc: `label: "Planning"`, `order: 20` in the P03 manifest example) | Board (route title "Planning board", doc), Job table (preset search `view=table`; label proposed, glossary term "job order table view", UI label for job order is "Job"), Production orders, Proposals (agent proposal review), Settings | P07 Planning board; P07 Job order table view; P14 E15-S02; P07 Settings |
| Module | Production start | No planner nav entry in release 1 (station routes and a panel in `planning/order/panels/v1` only); draw its "(unavailable)" header to test the placeholder | P03; P09 section 1; P06 Failure handling title example |
| Module | Pyramid connector | Import log, Import inbox, Pending changes, Settings; the integration card with Sync now may sit on the core Integrations page instead | P08 section 13; P06 Open points |
| Module | AI | Usage; provider integration cards on the Integrations page | P14 E13-S05; A0035 |
| Module | Audit | Audit log (admin audit list); the History tab sits on detail pages, not in the nav | P14 E05-S11 |
| Plugins | example-widget has no routes (contribution only); example-validator has no remote | Invent one plugin with routes for the drawing, for example label "Acme tooling" (prefix `acme`, doc: P06 CSS rules) with one or two entries | P03 The two example plugins; P06 defineWebModule |

### 8.3 Slots and other content

- `planning/board/side/v1`: example-widget contribution "Large orders" (contribution id `example-widget.large-orders`, doc: P06 defineWebModule); props carry `plantId` and `paused`. [P06 Remotes in release 1]
- `planning/board/header/v1`: "Pyramid data as of <time>" from the Pyramid connector. [P06 Remotes in release 1; P08 section 13]
- `planning/order/panels/v1`: production-start's reported quantities panel. [P06; P09 section 1]
- Shell aside slot: the AI chat panel trigger and docked or sheet geometry. [P06]
- Help entries (invented): Planning "Board keyboard commands", Core "Set up a plant", Pyramid connector "Import inbox codes"; plus the "All pages" index and the docs site's "Accessibility" page (P06 Gates and tests names that page).
- Breadcrumb examples: Planning / Production orders / Order 1001; Core / Master data / Machines / Mill 1.
- Main content for shell frames: a short production orders list (D1 F8 list-page shape) and a board placeholder; the board itself is D3's.
- Station frame: heading "Press 4, Anna Berg", Switch operator button, connection status, and a placeholder job list; D4 draws the real screens.
- Long-strings frame (invented examples): German nav labels such as "Betriebsmittelgruppen", "Fertigungsaufträge", "Schichtkalenderabweichungen", a Finnish module label such as "Tuotannonohjauksen asetukset", and long article names with `lang`.

## 9. Layout axes for the variations round

Each axis lists options the variations can take and the constraints every option keeps.

### 9.1 Navigation container

Options: a persistent labelled sidebar that collapses to a rail on demand; an icon rail by default with a flyout per module group; module tabs or a module switcher in the top bar with a second-level sidebar for the current module.

Constraints: section order core, modules, plugins and group order from manifests (1.1.1, 3.2.3); one group per module headed by `web.label`; one nesting level; the "(unavailable)" header in place; the collapsed rail and the 320 px sheet both exist (I190); entries and modules have no icon field (1.1.6), so a rail needs another source (initials, a generic icon, or a contract change); flyouts and tooltips meet 1.4.13 and open by keyboard; 24 px targets; current entry visible in every state. A module switcher in the top bar still has to show every module group in the same relative order on every page.

### 9.2 Where the plant switcher lives

Options: top bar start, next to the product mark; sidebar head; as the first breadcrumb crumb; inside the user menu.

Constraints: a menu of links (3.2.2), shell only, same relative place on every planner page (3.2.3, derived); the current plant is visible on every planner page (the title carries it too); link targets follow 1.3.2; absent on the station frame; reachable at 320 px.

### 9.3 Top bar content: breadcrumb or page title

Options: breadcrumb in the top bar with the `h1` in `main`; a compact page title in the top bar with the breadcrumb above the `h1` in `main`; breadcrumb and `h1` both in a page header band inside `main`, with the top bar holding only global controls.

Constraints: P06 Shell layout lists the breadcrumb in the top bar, and `PageFrame` renders both the breadcrumb and the `h1`; the `h1` is the route-change focus target and the fallback is `main` (7.2), so the `h1` belongs in `main` (derived); exactly one `h1`; page actions go to the top bar slot through `TopBarActions` (1.2.2); help menu at a fixed place (3.2.6); breadcrumb truncation at 320 px keeps the full trail available.

### 9.4 Live-updates and restart status

Options: a status chip inside the top bar; a full-width strip under the top bar; both (chip for reconnecting, strip for restarting and banners).

Constraints: text goes through the polite live region and is read once per change (4.1.3); it never covers focused content (2.4.11); the board's Pause control shares the reconnecting state; banners of 1.6.4 need a place too; the station adds its own `role=status` Disconnected banner (5.10).

### 9.5 How the board page uses width

Options: the sidebar stays as the user left it; the board route starts with the rail and the user can expand it; the board uses a full-bleed `main` while list and form pages keep a readable max width.

Constraints: the board needs width for the sticky machine column (capped at about 40 percent of the board width) and the time axis (P06 Reflow); the board's detail panel docks beside the board inside `main`; at most one shell panel docks beside `main`, so the chat aside and the board compete for width (P06 Shell layout); collapsed state is personal view state and stays out of the URL (P06 View state in the URL, derived); a route must not reorder the sidebar (3.2.3); sticky top bar height reduces board rows, and `scroll-padding-top` must match it.

### 9.6 Help and user menus

Options: both at the top bar end; both in the sidebar footer; help in the top bar and the user menu in the sidebar footer.

Constraints: help at one fixed place on every page (3.2.6) with entries grouped by module label; the theme switch (light or dark, stored per browser) needs a home, likely the user menu (proposed); the D1 tab order puts the navigation links before the account button.

### 9.7 Chat trigger and aside geometry

Options: a top bar button that docks a panel at the right edge and narrows `main`; a panel that overlays `main` at narrow widths; a launcher at the sidebar foot.

Constraints: `aside` landmark; survives route changes; at most one docked panel; below about 640 px a modal sheet; hidden when no provider is configured; opening focuses the input and Escape returns to the trigger; the panel design itself is E14-S03's.

### 9.8 Station frame header

Options: a slim top bar (station name and operator at the start, connection status, Switch operator at the end); a tall header with the station heading as `h1`; a bottom action bar holding Switch operator for reach in portrait.

Constraints: no sidebar; 44 px targets; Switch operator visible on every station screen; the Disconnected banner and the reconnecting status both have a place without double announcement; one `h1`; skip link and landmarks; light default and a per-device dark choice; works at 1280 by 800, 1920 by 1080 and portrait.

### 9.9 Section headings in the sidebar

Options: visible section headings ("Core", "Modules", "Plugins"); dividers only; module group headers only.

Constraints: plugins sit in their own section (1.1.1); group headers are the manifest labels; the structure has to be readable to a screen reader (proposed: headings or labelled lists).

## 10. Open questions

1. The nav contract has no icon field (`nav` is `{ label, order?, parent?, search? }`, manifest `web` has `label`, `permission`, `order`). What does a collapsed rail show: initials, one generic icon, module-level icons through a new manifest field, or text only? A new field changes `@northmes/web-sdk` and ADR 0062.
2. The sign-in route, the minimal status route and the "All pages" index have no paths. If they sit at the root, their first segments must join the reserved plant slugs (`api`, `graphql`, `mcp`, `health`, `modules`, `assets`, `station`; A0064). What are the paths?
3. What does `/` show: a redirect to the user's only plant, a plant chooser for users with several plants, or a dashboard (P16 M-32 is open)?
4. Where does the plant switcher get its plant list? `/api/v1/web/modules` returns only the current plant; MCP has `core_list_plants` ("plants the user can reach").
5. What is core's `web.label`, and does core group its registers under one parent entry ("Master data")? With one nesting level, Users, Roles, Stations, Integrations, Settings and System health stay flat under core.
6. Does a module with no planner nav entries (production-start in release 1) show a sidebar group, and does its failure show an "(unavailable)" header in the planner layout? The plan's example placeholder title is "Production start unavailable · Plant A · NorthMES".
7. Is the "(unavailable)" header a link to the placeholder route, or plain text?
8. Release 1 may have no plugin with nav entries (example-widget is contribution only, example-validator has no remote). Does the Plugins section hide when empty?
9. Which remotes own the Pyramid connector, AI and audit screens (P16 M-31)? This decides their sidebar groups.
10. Title pattern for routes outside `/$plant`: the sign-in page, the status route, the "All pages" index and the station routes (for example "Press 4 · Plant A · NorthMES"?).
11. The reload dialog "has a title and an `h1`" (A0021, P06), while the route suite requires exactly one `h1` per route. Does the dialog use an `h2`, or does the page `h1` become inert while it is open?
12. Breadcrumb placement: P06 Shell layout puts it in the top bar, while `PageFrame` (inside the screen) renders it. Which landmark holds it?
13. Page actions: P06 puts them in the top bar through `TopBarActions`, but D1 F8's list-page tab order places "New order" after the filters, inside the page. Which order do the keyboard frames show?
14. Station: does the station frame have a help menu (3.2.6 applies per set of pages), where does the per-device theme switch sit, and does it show the plant name?
15. Station: the top bar "Live updates paused, reconnecting" and the station's Disconnected banner can both appear. Which one speaks, so the operator hears one message?
16. Station portrait size is not given. Which dimensions (for example 800 by 1280 or 1080 by 1920)? Screen size and gloves are pilot IT question IT-22, due "before the station design".
17. Sign-in: the copy for a wrong password, for the database rate limit, and for a banned account; the "set a new password" step after a temporary password; and where the user lands after sign-in from a 4401 (the original URL or the plant root). Does D2 draw the new-password step or leave it to E05-S08?
18. User menu contents: name, theme switch, sign out; anything else (change password)?
19. Does the collapsed or expanded sidebar state persist per browser like the theme, or reset on reload?
20. Banners (readiness, AI budget, restore): where do they sit, can a user dismiss them, and in which order do they stack? The restore banner is D2's per E18-S04.
21. Server restarting: D2 owes the final English copy (P06 Failure handling). Proposal to review in the variations round.
22. The 4403 access message: a page, a dialog or a banner?
23. Does D2 draw the boot states (static "Loading NorthMES"), the unsupported-browser page, the HTTPS-required page and the "All pages" index, which the docs name but I190's frame list does not?
24. shadcn Sidebar and Breadcrumb are not in D1's component table. D2 names them in its build notes; are their states (current, hover, focus, collapsed) part of D2's frames?
25. Where do toasts sit so they stay away from the board and form areas (P06 Focus)?
26. Doc drift to know about: A0019 still shows `nav` in `defineWebModule` and the path `/api/web/modules`; A0062 removed `nav` and A0064 moved the path to `/api/v1/web/modules`. This spec follows the newer ADRs.
