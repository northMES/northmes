# D2 shell, navigation and station frame

This is the approval record of design task D2, issue [northMES/northmes#190](https://github.com/northMES/northmes/issues/190), for story E04-S02 ([northMES/northmes#40](https://github.com/northMES/northmes/issues/40)). The design page is [shell/shell-190-navigation.dc.html](https://claude.ai/design/p/dba068e0-37df-46e5-adcf-4439b6c4c0ad?file=shell%2Fshell-190-navigation.dc.html) in the Claude Design project. It builds on the direction chosen in the variations round ([shell-190-variations.md](shell-190-variations.md)) and on the tokens and components of D1 ([ui-189-tokens.md](../ui/ui-189-tokens.md)).

Every planner and station screen mounts one of two shared frames, `shell/Shell.dc.html` or `shell/StationFrame.dc.html`, so the page draws the states the shell owns once and module pages reuse them. The sign-in page renders outside the shell with the same top bar classes.

## Approval

Krister Johansson approved the page on 2026-10-06.

After the approval he decided, the same day, that the plant wizard is named onboarding, not setup, because [GLOSSARY.md](../../../GLOSSARY.md) uses setup for the first part of a job order. The page was then renamed to match, and the etags below are those of the renamed files. The rename made these changes:

- `Shell.dc.html`: the prop `setup` is now `onboarding`, with the same values. The badge reads Onboarding, and a visually hidden comma makes the link read "Plant D, Onboarding". The German long-strings variant also reads Onboarding. Comments and the placeholder of the admin Plants page say "onboarding state" and `core.onboarding:manage`.
- `shell-190-navigation.css`: the class `.sh-setup` is now `.sh-onboarding`.
- Chips: PL32 and PL33 read "Company admin, plant in onboarding", NA23 "In onboarding", ST36 and ST37 "Plant in onboarding", ST40 and ST41 "Plant not open yet", ST42 and ST43 "Company not open yet".
- Copy: the ST36 banner links "Continue onboarding" to `/$plant/core/onboarding`. ST40 to ST43 use the headings, text and document titles in the copy list below. ST42 and ST43 dropped a second, muted line about the company admin running the setup, because the new text already says that an admin completes onboarding.
- Build notes: the header, ST33 and KE23 use onboarding, `onboardingState` and `core.onboarding:manage` throughout, the copy lists and the WCAG 1.4.1 row included.
- Layout: the longer words made the PL32 chip run into PL33 and wrapped the NA23 chip to two lines; both now fit. The spec page's hint sizes follow the parts: the header is 1440 by 6728 and the states part 3120 by 24524.

The help entry "Set up a plant" (German "Ein Werk einrichten") in core's help group stays, because it uses "set up" as an ordinary verb and existed before the wizard. Frame ids did not change. After the rename the full page rendered all 189 frames over the uploaded files with no console errors, failed requests, empty icons, duplicate ids, dangling ARIA references, overlapping frames or em and en dashes, and `Shell.dc.html` passed the same checks in 59 prop states, with the top bar and the sidebar head at 56 px in each.

The header frame still reads "spec page, in review", and its acceptance list has no checked boxes. This record holds the approval.

## Approved files

| File | Etag |
|---|---|
| `shell/shell-190-navigation.dc.html` | `1791306240917384` |
| `shell/shell-190-navigation-header.dc.html` | `1791306205473278` |
| `shell/shell-190-navigation-planner.dc.html` | `1791305793431939` |
| `shell/shell-190-navigation-narrow.dc.html` | `1791306066857549` |
| `shell/shell-190-navigation-states.dc.html` | `1791306623760539` |
| `shell/shell-190-navigation-signin.dc.html` | `1791232323406503` |
| `shell/shell-190-navigation-station.dc.html` | `1791232473527259` |
| `shell/shell-190-navigation-keyboard.dc.html` | `1791307095247190` |
| `shell/shell-190-navigation.css` | `1791305250083620` |
| `shell/Shell.dc.html` | `1791305527647556` |
| `shell/StationFrame.dc.html` | `1791231752474671` |

The design project returned these etags for `shell/` on 2026-10-06. The rename changed `Shell.dc.html`, the CSS file, the entry page and the header, planner, narrow, states and keyboard parts. The sign-in part, the station part and `StationFrame.dc.html` keep the etags they had before the rename.

The page also loads files outside this set: the folder's `shell/support.js` (etag `1791221619746846`), and D1's `ui/tokens.css` and `ui/ui-189-tokens-page.css`, whose etags still equal the ones in the D1 record. Rule numbers such as 1.1.9 and question numbers such as Q11 point into the D2 spec `shell/shell-190-spec.md` (etag `1791221615601582`), which lists every rule with its source.

## Page facts

| Fact | Value |
|---|---|
| Issue | [northMES/northmes#190](https://github.com/northMES/northmes/issues/190), plan task E04-S02-T01 |
| Owning story | E04-S02 ([northMES/northmes#40](https://github.com/northMES/northmes/issues/40)) |
| Waiting tasks | The UI tasks of E04-S02 to E04-S05, the sign-in task of E05-S05 ([northMES/northmes#53](https://github.com/northMES/northmes/issues/53)) and the admin frame task of E05-S15 |
| Area | `shell`, which maps to `apps/web` |
| Routes | `/$plant/...` in the planner layout; `/admin/...` in the admin layout without a plant (proposed ADR 0066); `/` for the plant list; `/station/$stationId` in the station layout; the sign-in route, drawn as `/sign-in` (Q2) |
| Personas | Planner (primary) for the planner shell, Operator for the station frame. A Plant admin, and a company admin who also sees plants in onboarding and reaches the admin pages, appear where navigation depends on permissions |
| Tokens and components | D1, approved on 2026-10-05 ([northMES/northmes#189](https://github.com/northMES/northmes/issues/189)): Graphite, IBM Plex Sans and Mono, shadcn components, lucide 1.45.0 icons |
| Shared files | `shell/Shell.dc.html` (planner shell), `shell/StationFrame.dc.html` (station frame) and `shell/shell-190-navigation.css` |

## Direction and decisions

The planner shell is option A: a labelled sidebar with core, module and plugin sections, the company and plant switcher at its top, the user menu at its foot and an icon on every entry. It collapses to a 64 px rail of icons and becomes a sheet at 320 px. From option C it keeps the status split: a top bar chip for reconnecting and a strip under the top bar for banners. The breadcrumb starts with the plant as a link, and the bell for notifications ends the top bar.

Companies come from the command line on the host, so no role sits above a company and no page creates one. Company admins create plants on the admin pages under `/admin`, which they reach from Admin in the switcher menu, or in the user menu when the switcher is hidden; D2 draws the admin frame around those pages and the plant list at `/`. A new plant stays closed until its onboarding wizard is complete. Until then the switcher lists it only for holders of `core.onboarding:manage`, with Onboarding in its link text; they work under a banner that links to the wizard, and anyone else with a role there reads that the plant is not open yet. The onboarding wizard is its own design task, E06-S14, and not part of D2.

The station frame is S1, a top bar with the station, the connection chip, Switch operator, Sign out and More, in the same header pattern as the planner shell. The review left the station frame and the sign-in page unchanged (C8).

Krister Johansson chose the direction on 2026-10-05 (see [shell-190-variations.md](shell-190-variations.md)) and changed it after his review the same day. He also decided how companies and plants are created, which the proposed ADR 0066 and ADR 0067 record. The page lists the changes as C1 to C9:

- C1: The company and plant switcher sits at the top of the sidebar, with plants grouped by company; with plants of one company the menu has no company label. A user with roles in one plant sees the company and plant as static text, with no switcher. A plant in onboarding, which the switcher lists only for a holder of `core.onboarding:manage`, carries Onboarding in its link text (ADR 0067).
- C2: The user menu sits at the foot of the sidebar with Profile, Theme, Presentation settings and Sign out. The rail shows the avatar only.
- C3: The bell for notifications follows Assistant and Help in the top bar, as a contribution to a top bar slot; when it fails, a fallback keeps its place (ADR 0067). Release 1 has no bell, because it ships without the notifications module (ADR 0055).
- C4: Every nav entry has a lucide icon. The rail shows one icon per top-level entry, with a tooltip, and opens nested entries in a flyout. Monograms are gone.
- C5: The breadcrumb starts with the plant as a plain link, after the company when the user has plants in more than one company.
- C6: The sidebar trigger moves from the sidebar head to the start of the top bar.
- C7: An Administration section above the user footer, for admins only: Users, Roles, Stations, Integrations, Settings and System health. Plants and the company pages live under `/admin`, outside any plant, and companies come from the command line, so Administration has neither a Plants nor a Companies entry (ADR 0066).
- C8: The station frame S1 and the sign-in page do not change.
- C9: The admin pages at `/admin` get the admin frame: no plant, so no plant crumb and no Assistant, with the switcher at the top of the sidebar as the way back to the plants. Admin, in the switcher menu or in the user menu when the switcher is hidden, opens it. The plant list at `/` and the pages for a plant or a company in onboarding render without a sidebar (ADR 0066, ADR 0067).

The build notes in KE23 add:

- ADR 0067: a plant whose onboarding is in progress is listed in the switcher only for a holder of `core.onboarding:manage`, such as a company admin, and carries Onboarding in its link text. The menu item draws a Badge with Onboarding after the plant name, and the link reads Plant D, Onboarding (PL32, PL33, NA23). The rail and the 320 sheet show the same menu. A company admin reaches `/admin` through Admin after All plants, or through Admin in the user menu when the switcher is hidden (PL32, PL42).
- Decided in this part (proposed): the DOM order is skip link, nav, header, main, aside, so focus order equals reading order (spec 2.1, 2.2; WCAG 2.4.3). shadcn renders Sidebar before SidebarInset, which holds the header, so the library order already matches.
- Contract changes these decisions imply: nav entries and module manifests gain an icon field (spec 1.1.6, ADR 0067); core's admin routes in a plant need a way to land in Administration; the admin pages come from adminRoutes under `/admin` (ADR 0066); the switcher needs the companies and plants the user holds roles in, with the onboarding state of each plant, which ADR 0066 proposes as the fields companies and admin of `/api/v1/web/modules` (spec Q4); the bell becomes a contribution to the top bar slot; plant slugs are unique per installation.
- The frames draw three roles: planner, plant admin and company admin. PL32, PL33, PL42 to PL47 and NA23 draw the company admin, who holds core's company admin role, sees a plant in onboarding in the switcher and reaches `/admin` through Admin. A narrower permission, such as one that only manages users, would show only its own entries in Administration; no frame draws it.

On 2026-10-06 Krister Johansson confirmed `/admin` as the path of the admin mount, with `admin` a reserved plant slug (M-59 in the proposed ADR 0066). The page, approved the same day, still marks `/admin` as proposed.

## Rows

The page has a header frame, then one row per part file. The chips above the screens carry the frame ids.

| Row | Part file | Frames | What it shows |
|---|---|---|---|
| F0 Header | `shell/shell-190-navigation-header.dc.html` | F0 | Issue, direction and the review of 2026-10-05, acceptance, frames by row, build notes, assumptions and open questions |
| 1 Planner shell | `shell/shell-190-navigation-planner.dc.html` | PL1 to PL49 | The planning board at 1440, 1280 and 1920 in light and dark; the expanded sidebar with its icons; the rail with a tooltip, a flyout, the user and switcher menus and the static head of one plant; the switcher, help and user menus; one plant with a static head, plants in two companies and the switcher menu of one company; the bell with unread notifications, with its panel open and failed, and the release 1 top bar without it; the plant admin sidebar with Administration; a company admin's switcher menu with Plant D in onboarding and Admin, and the user menu with Admin; the admin frame at `/admin` and its switcher menu; the skip link with the landmarks outlined. |
| 2 Reflow at 320 and long strings | `shell/shell-190-navigation-narrow.dc.html` | NA1 to NA23 | Production orders at 320 by 640 with the menu button, the navigation sheet with the switcher and with the static head of one plant, an admin's Administration section, the user menu, the switcher menu with short and with long names and a company admin's with a plant in onboarding, the assistant sheet and a deep trail with Show the full path; German labels and a Finnish plugin page at 1440 in light and dark. |
| 3 States the shell owns | `shell/shell-190-navigation-states.dc.html` | ST1 to ST43 | Module unavailable in the sidebar and in the rail, the reload dialog, page not found, the error panel, the minimal status route, reconnecting, paused, the banners, route loading, a slow remote, a failed slot, an unknown plant, no AI provider, a plant in onboarding with its banner, the plant list at `/`, and the pages for a plant and a company in onboarding, each in light and dark. ST33 holds their build notes. |
| 4 Sign-in page | `shell/shell-190-navigation-signin.dc.html` | SI1 to SI22 | Default, field errors, wrong password, rate limited, blocked, the new password step and signed out, in light and dark at 1440 and light at 320. SI22 holds the sign-in build notes. |
| 5 Station frame | `shell/shell-190-navigation-station.dc.html` | SF1 to SF20 | Station frame S1 at 1280 by 800, 1920 by 1080 and 800 by 1280, disconnected, the idle warning, the Switch operator screens, nobody signed in, the More menu and the landmarks. SF20 holds the station build notes. |
| 6 Keyboard and focus | `shell/shell-190-navigation-keyboard.dc.html` | KE1 to KE32 | Tab order with the sidebar, the rail and Administration; route change; the switcher, user and help menus, the notifications panel and the rail flyout; the sheet with its menus; the reload dialog; the focus ring on every shell surface; focus not obscured and the station. KE23 holds the build notes of rows 1, 2 and 6. |

Where each frame of the issue's Frames list is drawn, as the header gives it:

| Issue frame | Frames |
|---|---|
| Sidebar with core, module and plugin sections in a stable order, one group per module, entries nested one level | PL1, PL2, PL5, PL30, PL31, NA7, NA13 |
| The collapsed rail | PL6, PL16 to PL19, PL34 to PL39, ST2, ST34, ST11 to ST13, ST20 to ST22, KE2, KE5, KE28, KE29 |
| The 320 px sheet | NA3 to NA6, NA15 to NA23, KE11 to KE13, KE30, KE31 |
| Top bar with breadcrumb and page actions slot | PL1 to PL4, PL10, NA8, NA11, NA12 |
| Help menu with entries grouped by module | PL8, PL12, KE15, KE16 |
| User menu, at the foot of the sidebar (C2) | PL9, PL13, PL34, PL35, NA17, NA16, KE24, KE25, KE31 |
| Plant switcher as a menu of links, at the top of the sidebar and grouped by company, with a plant in onboarding marked Onboarding; the company and plant crumbs (C1, C5) | PL7, PL11, PL36, PL37, NA5, NA6, NA19, NA20, KE7 to KE9, KE30; one company: PL48, PL49; one plant: PL20, PL21, PL38, PL39, NA21, NA22; a plant in onboarding: PL32, PL33, PL46, PL47, NA23; crumbs: PL1, PL22, PL23 |
| The admin frame at `/admin` without a plant, and Admin, the link to it | PL44 to PL47; PL32, PL33, PL42, PL43, NA23 |
| The plant list at `/` | ST38, ST39 |
| The pages "Your company is not open yet" and "{plant} is not open yet" | ST42, ST43; ST40, ST41 |
| Skip link, landmarks and the title pattern | PL14, PL15, SF18, SF19, KE1; titles on the chips |
| Module unavailable placeholder with its "(unavailable)" menu entry | ST1, ST35; ST34, ST2 |
| Module not-found page, error panel and minimal status route | ST5, ST14; ST6, ST15; ST7, ST16 |
| Blocking reload dialog | ST3, ST4; KE10, KE14 |
| "Live updates paused, reconnecting" | ST8, ST17; NA8, NA14; KE17, KE18, KE20 |
| Restore, readiness and AI budget banners (spec 1.6.4) | ST10 to ST13, ST19 to ST22 |
| Other shell states of spec 0.7 and section 3 | ST23 to ST32, NA9, NA10 |
| Sign-in page, with a wrong password that keeps the username | SI1 to SI21; SI7 to SI9 |
| Station frame | SF1 to SF19; KE21, KE22 |
| Planner widths 1280, 1440, 1920 and the 320 reflow | PL3, KE4; PL1, PL2; PL4, PL10; NA1 to NA6, NA9 to NA12, NA15 to NA23 |
| Station at 1280 by 800, 1920 by 1080 and portrait | SF1, SF4; SF2, SF13; SF3, SF6, SF12 |
| One frame with long German or Finnish labels | NA7, NA8, NA13, NA14, NA19, NA20 |
| Keyboard and focus frames | KE1 to KE22, KE24 to KE32 |
| Breadcrumb from the plant, or from the company when the user has plants in several companies (C5) | PL1, PL22, PL23, NA11, NA12, KE9 |
| Bell for notifications: unread, the panel open, a failed top bar item, and the release 1 top bar without it (C3) | PL24 to PL29, PL40, PL41; KE15, KE16, KE26, KE27 |
| Administration section for admins (C7) | PL30, PL31, NA15, NA18, KE32 |
| A plant in onboarding: the banner that links to the wizard (ADR 0066) | ST36, ST37 |
| Icons on every entry, the rail tooltip and flyout (C4) | PL5, PL6, PL16 to PL19, KE2, KE28, KE29 |
| Sidebar trigger at the top bar start (C6) | PL1, KE5, KE17 |

## Frames

Each chip gives the frame id, the state, the theme and the size. The PNGs were captured from the uploaded page at device scale 1 in a 2400 by 1600 viewport. They show each frame with its chip, except in row 1: the planner chip sits outside the frame element, so the PL PNGs show the screen alone. The header and the KE23 build notes are split into parts to keep each file under 1.5 MB. A frame marked "Not exported" has no PNG in this folder; [Frames without a PNG](#frames-without-a-png) gives the reasons.

### Header

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| F0 | Header | Light, 1440 by 6728 | Issue, direction and the review of 2026-10-05, acceptance, frames by row, build notes, assumptions and open questions | [part 1](shell-190-navigation-f0-header-light-1.png), [part 2](shell-190-navigation-f0-header-light-2.png) |

### Row 1, planner shell

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| PL1 | Planning board | Light, 1440 by 900 | Switcher in the sidebar head, user menu in the footer, bell in the top bar, plugin side slot outlined | [shell-190-navigation-pl1-planning-board-light.png](shell-190-navigation-pl1-planning-board-light.png) |
| PL2 | Planning board | Dark, 1440 by 900 | As PL1 | [shell-190-navigation-pl2-planning-board-dark.png](shell-190-navigation-pl2-planning-board-dark.png) |
| PL3 | Planning board | Light, 1280 by 800 | Expanded sidebar, plugin side slot outlined | [shell-190-navigation-pl3-planning-board-1280-light.png](shell-190-navigation-pl3-planning-board-1280-light.png) |
| PL4 | Planning board | Light, 1920 by 1080 | Expanded sidebar, plugin side slot outlined | [shell-190-navigation-pl4-planning-board-1920-light.png](shell-190-navigation-pl4-planning-board-1920-light.png) |
| PL5 | Expanded sidebar | Light, 1440 by 900 | Core, module and plugin sections, an icon on every entry; Master data and Board open one level | [shell-190-navigation-pl5-expanded-sidebar-light.png](shell-190-navigation-pl5-expanded-sidebar-light.png) |
| PL6 | Collapsed rail | Light, 1440 by 900 | Company mark, one icon per top-level entry, a rule between module groups, avatar; Board current | [shell-190-navigation-pl6-collapsed-rail-light.png](shell-190-navigation-pl6-collapsed-rail-light.png) |
| PL7 | Switcher menu open | Light, 1440 by 900 | Plants grouped by company: Acme AB, Nordic Tools AB, then All plants | [shell-190-navigation-pl7-switcher-menu-light.png](shell-190-navigation-pl7-switcher-menu-light.png) |
| PL8 | Help menu open | Light, 1440 by 900 | Entries grouped by module, then All pages and Accessibility | [shell-190-navigation-pl8-help-menu-light.png](shell-190-navigation-pl8-help-menu-light.png) |
| PL9 | User menu open | Light, 1440 by 900 | Opens upward from the sidebar footer: Profile, Theme, Presentation settings, Sign out | [shell-190-navigation-pl9-user-menu-light.png](shell-190-navigation-pl9-user-menu-light.png) |
| PL10 | Planning board | Dark, 1920 by 1080 | As PL4 | Not exported |
| PL11 | Switcher menu open | Dark, 1440 by 900 | As PL7 | Not exported |
| PL12 | Help menu open | Dark, 1440 by 900 | As PL8 | Not exported |
| PL13 | User menu open | Dark, 1440 by 900 | As PL9; Dark is checked | Not exported |
| PL14 | Skip link and landmarks | Light, 1440 by 900 | The skip link focused; nav, header, the breadcrumb nav, main and aside outlined | [shell-190-navigation-pl14-skip-link-landmarks-light.png](shell-190-navigation-pl14-skip-link-landmarks-light.png) |
| PL15 | Skip link and landmarks | Dark, 1440 by 900 | As PL14 | Not exported |
| PL16 | Rail tooltip | Light, 1440 by 900 | Pointer on the Production orders icon: its label in a tooltip beside the rail | [shell-190-navigation-pl16-rail-tooltip-light.png](shell-190-navigation-pl16-rail-tooltip-light.png) |
| PL17 | Rail tooltip | Dark, 1440 by 900 | As PL16 | Not exported |
| PL18 | Rail flyout open | Light, 1440 by 900 | The Board icon opens a flyout headed Planning: Board, checked, and Job table | [shell-190-navigation-pl18-rail-flyout-light.png](shell-190-navigation-pl18-rail-flyout-light.png) |
| PL19 | Rail flyout open | Dark, 1440 by 900 | As PL18 | Not exported |
| PL20 | One plant | Light, 1440 by 900 | Roles in Plant A only: the sidebar head is static text with no chevron, no switcher | [shell-190-navigation-pl20-one-plant-light.png](shell-190-navigation-pl20-one-plant-light.png) |
| PL21 | One plant | Dark, 1440 by 900 | As PL20 | Not exported |
| PL22 | Plants in two companies | Light, 1440 by 900 | The trail starts with the company: Acme AB, Plant A, Planning, Planning board | [shell-190-navigation-pl22-two-companies-light.png](shell-190-navigation-pl22-two-companies-light.png) |
| PL23 | Plants in two companies | Dark, 1440 by 900 | As PL22 | Not exported |
| PL24 | Unread notifications | Light, 1440 by 900 | The bell with a count badge, named Notifications, 3 unread | [shell-190-navigation-pl24-bell-unread-light.png](shell-190-navigation-pl24-bell-unread-light.png) |
| PL25 | Notifications open | Light, 1440 by 900 | The panel under the bell with the empty state No notifications | [shell-190-navigation-pl25-notifications-open-light.png](shell-190-navigation-pl25-notifications-open-light.png) |
| PL26 | Release 1 top bar | Light, 1440 by 900 | No bell: release 1 ships without the notifications module (ADR 0055) | [shell-190-navigation-pl26-release-1-top-bar-light.png](shell-190-navigation-pl26-release-1-top-bar-light.png) |
| PL27 | Unread notifications | Dark, 1440 by 900 | As PL24 | Not exported |
| PL28 | Notifications open | Dark, 1440 by 900 | As PL25 | Not exported |
| PL29 | Release 1 top bar | Dark, 1440 by 900 | As PL26 | Not exported |
| PL30 | Plant admin | Light, 1440 by 900 | Module admin entries; Administration above the user footer, the nav scrolled to its end | [shell-190-navigation-pl30-plant-admin-light.png](shell-190-navigation-pl30-plant-admin-light.png) |
| PL31 | Plant admin | Dark, 1440 by 900 | As PL30 | Not exported |
| PL32 | Company admin, plant in onboarding | Light, 1440 by 900 | A company admin's switcher menu: Plant D is in onboarding, so its link reads Plant D, Onboarding, with a badge; after All plants, Admin opens `/admin` | [shell-190-navigation-pl32-company-admin-onboarding-light.png](shell-190-navigation-pl32-company-admin-onboarding-light.png) |
| PL33 | Company admin, plant in onboarding | Dark, 1440 by 900 | As PL32 | [shell-190-navigation-pl33-company-admin-onboarding-dark.png](shell-190-navigation-pl33-company-admin-onboarding-dark.png) |
| PL34 | Rail user menu open | Light, 1440 by 900 | The avatar at the rail foot opens the user menu to its right: Profile, Theme, Presentation settings, Sign out | [shell-190-navigation-pl34-rail-user-menu-light.png](shell-190-navigation-pl34-rail-user-menu-light.png) |
| PL35 | Rail user menu open | Dark, 1440 by 900 | As PL34; Dark is checked | Not exported |
| PL36 | Rail switcher menu open | Light, 1440 by 900 | The company mark opens the switcher menu to its right: plants grouped by company, then All plants | [shell-190-navigation-pl36-rail-switcher-menu-light.png](shell-190-navigation-pl36-rail-switcher-menu-light.png) |
| PL37 | Rail switcher menu open | Dark, 1440 by 900 | As PL36 | Not exported |
| PL38 | One plant in the rail | Light, 1440 by 900 | Roles in Plant A only: the rail head shows the company mark as static text, not a button | [shell-190-navigation-pl38-one-plant-rail-light.png](shell-190-navigation-pl38-one-plant-rail-light.png) |
| PL39 | One plant in the rail | Dark, 1440 by 900 | As PL38 | Not exported |
| PL40 | Top bar item failed | Light, 1440 by 900 | The notifications contribution threw at stage slot: its place holds an icon button with a dashed border, named Notifications (unavailable); focus opens its tooltip | [shell-190-navigation-pl40-top-bar-item-failed-light.png](shell-190-navigation-pl40-top-bar-item-failed-light.png) |
| PL41 | Top bar item failed | Dark, 1440 by 900 | As PL40 | Not exported |
| PL42 | Company admin, one plant | Light, 1440 by 900 | Roles in Plant A only, so no switcher: the user menu holds Admin, the link to `/admin` | [shell-190-navigation-pl42-company-admin-one-plant-light.png](shell-190-navigation-pl42-company-admin-one-plant-light.png) |
| PL43 | Company admin, one plant | Dark, 1440 by 900 | As PL42 | Not exported |
| PL44 | Admin frame | Light, 1440 by 900 | `/admin/core/plants`: no plant crumb and no Assistant; the switcher reads Admin, Choose a plant | [shell-190-navigation-pl44-admin-frame-light.png](shell-190-navigation-pl44-admin-frame-light.png) |
| PL45 | Admin frame | Dark, 1440 by 900 | As PL44 | Not exported |
| PL46 | Admin frame, switcher menu open | Light, 1440 by 900 | The way back to the plants: the user's plants by company with none current, Plant D with Onboarding, then All plants | [shell-190-navigation-pl46-admin-frame-switcher-light.png](shell-190-navigation-pl46-admin-frame-switcher-light.png) |
| PL47 | Admin frame, switcher menu open | Dark, 1440 by 900 | As PL46 | Not exported |
| PL48 | Switcher menu, one company | Light, 1440 by 900 | Plants of one company: the menu has no company label (ADR 0067); Plant A current, then All plants | [shell-190-navigation-pl48-switcher-one-company-light.png](shell-190-navigation-pl48-switcher-one-company-light.png) |
| PL49 | Switcher menu, one company | Dark, 1440 by 900 | As PL48 | Not exported |

### Row 2, reflow at 320 and long strings

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| NA1 | Page | Light, 320 by 640 | Page with the menu button | [shell-190-navigation-na1-page-320-light.png](shell-190-navigation-na1-page-320-light.png) |
| NA2 | Page | Dark, 320 by 640 | Page with the menu button | Not exported |
| NA3 | Sheet open | Light, 320 by 640 | Navigation sheet open | [shell-190-navigation-na3-sheet-open-light.png](shell-190-navigation-na3-sheet-open-light.png) |
| NA4 | Sheet open | Dark, 320 by 640 | Navigation sheet open | Not exported |
| NA5 | Switcher menu | Light, 320 by 640 | Switcher menu open in the sheet | [shell-190-navigation-na5-sheet-switcher-light.png](shell-190-navigation-na5-sheet-switcher-light.png) |
| NA6 | Switcher menu | Dark, 320 by 640 | Switcher menu open in the sheet | Not exported |
| NA7 | Long strings, German | Light, 1440 by 900 | Plants in two companies: long names truncated in the switcher head and the trail, crumbs and page actions folded, a wrapped entry | [shell-190-navigation-na7-long-strings-german-light.png](shell-190-navigation-na7-long-strings-german-light.png) |
| NA8 | Long strings, Finnish plugin page | Light, 1440 by 900 | The route text has `lang` fi; the top bar folds the crumbs, the page actions, then the Assistant label; menu open | [shell-190-navigation-na8-long-strings-finnish-light.png](shell-190-navigation-na8-long-strings-finnish-light.png) |
| NA9 | Assistant sheet | Light, 320 by 640 | Assistant sheet open | [shell-190-navigation-na9-assistant-sheet-light.png](shell-190-navigation-na9-assistant-sheet-light.png) |
| NA10 | Assistant sheet | Dark, 320 by 640 | Assistant sheet open | Not exported |
| NA11 | Deep trail | Light, 320 by 640 | Deep trail, ellipsis focused | [shell-190-navigation-na11-deep-trail-light.png](shell-190-navigation-na11-deep-trail-light.png) |
| NA12 | Full path | Dark, 320 by 640 | Deep trail, full path menu open | [shell-190-navigation-na12-full-path-menu-dark.png](shell-190-navigation-na12-full-path-menu-dark.png) |
| NA13 | Long strings, German | Dark, 1440 by 900 | As NA7 | Not exported |
| NA14 | Long strings, Finnish plugin page | Dark, 1440 by 900 | As NA8 | Not exported |
| NA15 | Administration | Light, 320 by 640 | Navigation sheet with Administration | [shell-190-navigation-na15-sheet-administration-light.png](shell-190-navigation-na15-sheet-administration-light.png) |
| NA16 | User menu | Dark, 320 by 640 | User menu open in the sheet | Not exported |
| NA17 | User menu | Light, 320 by 640 | User menu open in the sheet | [shell-190-navigation-na17-sheet-user-menu-light.png](shell-190-navigation-na17-sheet-user-menu-light.png) |
| NA18 | Administration | Dark, 320 by 640 | Navigation sheet with Administration | Not exported |
| NA19 | Long names | Light, 320 by 640 | Switcher menu with long names in the sheet | [shell-190-navigation-na19-sheet-long-names-light.png](shell-190-navigation-na19-sheet-long-names-light.png) |
| NA20 | Long names | Dark, 320 by 640 | Switcher menu with long names in the sheet | Not exported |
| NA21 | One plant | Light, 320 by 640 | Navigation sheet with one plant | [shell-190-navigation-na21-sheet-one-plant-light.png](shell-190-navigation-na21-sheet-one-plant-light.png) |
| NA22 | One plant | Dark, 320 by 640 | Navigation sheet with one plant | Not exported |
| NA23 | In onboarding | Light, 320 by 640 | Switcher menu with a plant in onboarding in the sheet | [shell-190-navigation-na23-sheet-onboarding-light.png](shell-190-navigation-na23-sheet-onboarding-light.png) |

### Row 3, states the shell owns

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| ST1 | Module unavailable | Light, 1440 by 900 | Pyramid connector failed at stage manifest; its sidebar group keeps its place with (unavailable) and no entries; placeholder route with the focused h1 | [shell-190-navigation-st1-module-unavailable-light.png](shell-190-navigation-st1-module-unavailable-light.png) |
| ST2 | Module unavailable in the rail | Dark, 1440 by 900 | As ST1 on the rail: the Pyramid connector icon keeps its place, marked unavailable, with its tooltip in the hover state | Not exported |
| ST3 | Reload dialog | Light, 1440 by 900 | Build mismatch on the Planning board; the dialog holds the only h1, the page is inert | [shell-190-navigation-st3-reload-dialog-light.png](shell-190-navigation-st3-reload-dialog-light.png) |
| ST4 | Reload dialog | Dark, 1440 by 900 | As ST3, without annotations | Not exported |
| ST5 | Module page not found | Light, 1440 by 900 | Planning's notFoundComponent with a link to its first nav entry; the h1 has focus | [shell-190-navigation-st5-page-not-found-light.png](shell-190-navigation-st5-page-not-found-light.png) |
| ST6 | Error panel | Light, 1440 by 900 | Production orders threw at stage render; sidebar and top bar stay, the route's page actions are gone; the h1 has focus | [shell-190-navigation-st6-error-panel-light.png](shell-190-navigation-st6-error-panel-light.png) |
| ST7 | Minimal status route | Light, 1440 by 900 | Plant admin. Core failed at stage entry: Core and Administration show (unavailable); the shell's own status route still renders | [shell-190-navigation-st7-status-route-light.png](shell-190-navigation-st7-status-route-light.png) |
| ST8 | Reconnecting | Light, 1440 by 900 | Socket closed: the chip in the top bar; the board's Resume control is disabled and moves are off | [shell-190-navigation-st8-reconnecting-light.png](shell-190-navigation-st8-reconnecting-light.png) |
| ST9 | Live updates paused | Light, 1440 by 900 | The planner paused live updates on the board; the shell adds no status | Not exported |
| ST10 | Restore banner | Light, 1440 by 900 | Planner. Shown to planners and admins for 24 hours after a restore or rollback (E18-S04) | [shell-190-navigation-st10-restore-banner-light.png](shell-190-navigation-st10-restore-banner-light.png) |
| ST11 | Readiness banner | Light, 1440 by 900 | Plant admin, sidebar on the rail. Built from the degraded list in `/health/ready` (E16-S02) | [shell-190-navigation-st11-readiness-banner-light.png](shell-190-navigation-st11-readiness-banner-light.png) |
| ST12 | AI budget banner, warning | Light, 1440 by 900 | Plant admin, sidebar on the rail. `ai.budget_state` is warning (E13-S05) | [shell-190-navigation-st12-ai-budget-warning-light.png](shell-190-navigation-st12-ai-budget-warning-light.png) |
| ST13 | AI budget banner, exhausted | Light, 1440 by 900 | Plant admin. `ai.budget_state` is exhausted: the Assistant toggle stays in place, disabled (aria-disabled) | [shell-190-navigation-st13-ai-budget-exhausted-light.png](shell-190-navigation-st13-ai-budget-exhausted-light.png) |
| ST14 | Module page not found | Dark, 1440 by 900 | As ST5 | Not exported |
| ST15 | Error panel | Dark, 1440 by 900 | As ST6 | Not exported |
| ST16 | Minimal status route | Dark, 1440 by 900 | Plant admin. As ST7 | Not exported |
| ST17 | Reconnecting | Dark, 1440 by 900 | As ST8 | Not exported |
| ST18 | Live updates paused | Dark, 1440 by 900 | As ST9 | Not exported |
| ST19 | Restore banner | Dark, 1440 by 900 | Planner. As ST10 | Not exported |
| ST20 | Readiness banner | Dark, 1440 by 900 | Plant admin. As ST11 | Not exported |
| ST21 | AI budget banner, warning | Dark, 1440 by 900 | Plant admin. As ST12 | Not exported |
| ST22 | AI budget banner, exhausted | Dark, 1440 by 900 | Plant admin. Focus on the disabled Assistant toggle: its tooltip opens at once | [shell-190-navigation-st22-ai-budget-exhausted-dark.png](shell-190-navigation-st22-ai-budget-exhausted-dark.png) |
| ST23 | Route loading | Light, 1440 by 900 | Production orders while its data loads: a skeleton of the list, main has aria-busy, the h1 is there and focused | [shell-190-navigation-st23-route-loading-light.png](shell-190-navigation-st23-route-loading-light.png) |
| ST24 | Route loading | Dark, 1440 by 900 | As ST23 | Not exported |
| ST25 | Slow remote | Light, 1440 by 900 | The Planning remote has not loaded after 2 s: the indicator with Try again; its sidebar group shows (loading) | [shell-190-navigation-st25-slow-remote-light.png](shell-190-navigation-st25-slow-remote-light.png) |
| ST26 | Slow remote | Dark, 1440 by 900 | As ST25 | Not exported |
| ST27 | Slot contribution failed | Light, 1440 by 900 | Large orders (`planning/board/side/v1`) threw at stage slot; the fallback stays inside its WidgetFrame | [shell-190-navigation-st27-slot-failed-light.png](shell-190-navigation-st27-slot-failed-light.png) |
| ST28 | Slot contribution failed | Dark, 1440 by 900 | Focus was inside the widget, so it moves to the fallback | [shell-190-navigation-st28-slot-failed-dark.png](shell-190-navigation-st28-slot-failed-dark.png) |
| ST29 | Unknown plant | Light, 1440 by 900 | `/plant-d` is no plant this user can open: NOT_FOUND without a plant, so no sidebar and no crumbs; the user's plants by company | [shell-190-navigation-st29-unknown-plant-light.png](shell-190-navigation-st29-unknown-plant-light.png) |
| ST30 | Unknown plant | Dark, 1440 by 900 | As ST29 | Not exported |
| ST31 | No AI provider | Light, 1440 by 900 | No provider is configured: no Assistant toggle and no aside; Help and the bell keep their places | [shell-190-navigation-st31-no-ai-provider-light.png](shell-190-navigation-st31-no-ai-provider-light.png) |
| ST32 | No AI provider | Dark, 1440 by 900 | As ST31 | Not exported |
| ST33 | States build notes, not part of the UI | Light, 2960 wide | Components, roles, focus, announcements, titles, criteria and copy for ST1 to ST32 and ST34 to ST43 | [shell-190-navigation-st33-build-notes-light.png](shell-190-navigation-st33-build-notes-light.png) |
| ST34 | Module unavailable in the rail | Light, 1440 by 900 | As ST2: the Pyramid connector icon keeps its place, marked unavailable, with its tooltip in the hover state | [shell-190-navigation-st34-module-unavailable-rail-light.png](shell-190-navigation-st34-module-unavailable-rail-light.png) |
| ST35 | Module unavailable | Dark, 1440 by 900 | As ST1: the Pyramid connector group keeps its place with (unavailable) and no entries; placeholder route with the focused h1 | Not exported |
| ST36 | Plant in onboarding | Light, 1440 by 900 | Company admin. Plant D is in onboarding, so a holder of `core.onboarding:manage` uses it as usual under a banner that links to the plant wizard | [shell-190-navigation-st36-plant-onboarding-light.png](shell-190-navigation-st36-plant-onboarding-light.png) |
| ST37 | Plant in onboarding | Dark, 1440 by 900 | Company admin. As ST36 | Not exported |
| ST38 | Plant list | Light, 1440 by 900 | `/` for a company admin with plants in two companies: no plant, so no sidebar and no crumbs; the plants by company, Plant D with Onboarding, and Admin in the top bar | [shell-190-navigation-st38-plant-list-light.png](shell-190-navigation-st38-plant-list-light.png) |
| ST39 | Plant list | Dark, 1440 by 900 | As ST38 | Not exported |
| ST40 | Plant not open yet | Light, 1440 by 900 | `/plant-d` for a planner with a role at Plant D, which is in onboarding: the plant does not open, and the planner's open plants are listed | [shell-190-navigation-st40-plant-not-open-light.png](shell-190-navigation-st40-plant-not-open-light.png) |
| ST41 | Plant not open yet | Dark, 1440 by 900 | As ST40 | Not exported |
| ST42 | Company not open yet | Light, 1440 by 900 | `/` for a planner whose only plant, Plant D, is in onboarding: no open plant and no admin page | [shell-190-navigation-st42-company-not-open-light.png](shell-190-navigation-st42-company-not-open-light.png) |
| ST43 | Company not open yet | Dark, 1440 by 900 | As ST42 | Not exported |

### Row 4, sign-in page

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| SI1 | Default | Light, 1440 by 900 | Empty form, nothing focused | [shell-190-navigation-si1-sign-in-light.png](shell-190-navigation-si1-sign-in-light.png) |
| SI2 | Default | Dark, 1440 by 900 | Empty form, nothing focused | [shell-190-navigation-si2-sign-in-dark.png](shell-190-navigation-si2-sign-in-dark.png) |
| SI3 | Default | Light, 320 by 640 | Empty form at 320 | [shell-190-navigation-si3-sign-in-320-light.png](shell-190-navigation-si3-sign-in-320-light.png) |
| SI4 | Field errors | Light, 1440 by 900 | Sign in pressed with both fields empty, focus on the error summary | [shell-190-navigation-si4-field-errors-light.png](shell-190-navigation-si4-field-errors-light.png) |
| SI5 | Field errors | Dark, 1440 by 900 | Sign in pressed with both fields empty, focus on the error summary | Not exported |
| SI6 | Field errors | Light, 320 by 640 | As SI4 at 320 | Not exported |
| SI7 | Wrong password | Light, 1440 by 900 | Username kept, password cleared and marked invalid, focus on the error summary | [shell-190-navigation-si7-wrong-password-light.png](shell-190-navigation-si7-wrong-password-light.png) |
| SI8 | Wrong password | Dark, 1440 by 900 | Username kept, password cleared and marked invalid, focus on the error summary | [shell-190-navigation-si8-wrong-password-dark.png](shell-190-navigation-si8-wrong-password-dark.png) |
| SI9 | Wrong password | Light, 320 by 640 | As SI7 at 320 | Not exported |
| SI10 | Rate limited | Light, 1440 by 900 | Too many attempts, username kept, focus on the error summary | Not exported |
| SI11 | Rate limited | Dark, 1440 by 900 | Too many attempts, username kept, focus on the error summary | Not exported |
| SI12 | Rate limited | Light, 320 by 640 | As SI10 at 320 | Not exported |
| SI13 | Account blocked | Light, 1440 by 900 | Right password for a banned account, focus on the error summary | Not exported |
| SI14 | Account blocked | Dark, 1440 by 900 | Right password for a banned account, focus on the error summary | Not exported |
| SI15 | Blocked | Light, 320 by 640 | As SI13 at 320 | Not exported |
| SI16 | New password | Light, 1440 by 900 | After a sign-in with a temporary password, new password typed, focus in the field | [shell-190-navigation-si16-new-password-light.png](shell-190-navigation-si16-new-password-light.png) |
| SI17 | New password | Dark, 1440 by 900 | After a sign-in with a temporary password, new password typed, focus in the field | [shell-190-navigation-si17-new-password-dark.png](shell-190-navigation-si17-new-password-dark.png) |
| SI18 | New password | Light, 320 by 640 | As SI16 at 320 | Not exported |
| SI19 | Signed out | Light, 1440 by 900 | After Sign out, status shown, focus on the h1 | [shell-190-navigation-si19-signed-out-light.png](shell-190-navigation-si19-signed-out-light.png) |
| SI20 | Signed out | Dark, 1440 by 900 | After Sign out, status shown, focus on the h1 | [shell-190-navigation-si20-signed-out-dark.png](shell-190-navigation-si20-signed-out-dark.png) |
| SI21 | Signed out | Light, 320 by 640 | As SI19 at 320 | Not exported |
| SI22 | Sign-in build notes | Light, 1440 wide | Route, title, landmarks, components, fields, accessible authentication, errors, focus and questions for SI1 to SI21 | [shell-190-navigation-si22-build-notes-light.png](shell-190-navigation-si22-build-notes-light.png) |

### Row 5, station frame

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| SF1 | Station frame | Light, 1280 by 800 | Anna Berg signed in, connected | [shell-190-navigation-sf1-station-1280-light.png](shell-190-navigation-sf1-station-1280-light.png) |
| SF2 | Station frame | Light, 1920 by 1080 | Anna Berg signed in, connected | [shell-190-navigation-sf2-station-1920-light.png](shell-190-navigation-sf2-station-1920-light.png) |
| SF3 | Station frame | Light, 800 by 1280 portrait | Anna Berg signed in, connected, in portrait | [shell-190-navigation-sf3-station-portrait-light.png](shell-190-navigation-sf3-station-portrait-light.png) |
| SF4 | Station frame | Dark, 1280 by 800 | Anna Berg signed in, connected | [shell-190-navigation-sf4-station-1280-dark.png](shell-190-navigation-sf4-station-1280-dark.png) |
| SF5 | Disconnected | Light, 1280 by 800 | Status strip under the top bar | [shell-190-navigation-sf5-disconnected-light.png](shell-190-navigation-sf5-disconnected-light.png) |
| SF6 | Disconnected | Dark, 800 by 1280 portrait | Disconnected in portrait | Not exported |
| SF7 | Idle sign-out warning | Light, 1280 by 800 | Focus on Stay signed in | [shell-190-navigation-sf7-idle-warning-light.png](shell-190-navigation-sf7-idle-warning-light.png) |
| SF8 | Idle sign-out warning | Dark, 1280 by 800 | Focus on Stay signed in | Not exported |
| SF9 | Switch operator, badge | Light, 1280 by 800 | Focus in the badge field; proposal for D4 | Not exported |
| SF10 | Badge not recognized | Dark, 1280 by 800 | The field is cleared and keeps focus; proposal for D4 | Not exported |
| SF11 | Switch operator, username | Light, 1280 by 800 | Focus in Password; proposal for D4 | Not exported |
| SF12 | Switch operator, username | Dark, 800 by 1280 | As SF11, in portrait | Not exported |
| SF13 | Station frame | Dark, 1920 by 1080 | Anna Berg signed in, connected | Not exported |
| SF14 | Nobody signed in | Light, 1280 by 800 | No operator: no Switch operator or Sign out; the D4 badge field takes focus through a ref | [shell-190-navigation-sf14-nobody-signed-in-light.png](shell-190-navigation-sf14-nobody-signed-in-light.png) |
| SF15 | Nobody signed in | Dark, 1280 by 800 | As SF14 | Not exported |
| SF16 | More menu open | Light, 1280 by 800 | Help and Theme on this station; focus on Help, the first item | [shell-190-navigation-sf16-more-menu-light.png](shell-190-navigation-sf16-more-menu-light.png) |
| SF17 | More menu open | Dark, 1280 by 800 | As SF16; Dark is checked | Not exported |
| SF18 | Landmarks | Light, 1280 by 800 | Skip link focused; header and main outlined | [shell-190-navigation-sf18-landmarks-light.png](shell-190-navigation-sf18-landmarks-light.png) |
| SF19 | Landmarks | Dark, 1280 by 800 | As SF18 | Not exported |
| SF20 | Station build notes, not part of the UI | Light, 1440 wide | Components, focus, the station sign-in rules, announcements, copy and criteria for SF1 to SF19 | [shell-190-navigation-sf20-build-notes-light.png](shell-190-navigation-sf20-build-notes-light.png) |

### Row 6, keyboard and focus

| Frame | State | Theme, size | What it shows | PNG |
|---|---|---|---|---|
| KE1 | Tab order | Light, 1440 by 900 | Planner on Production orders, all 32 stops numbered, the skip link focused | [shell-190-navigation-ke1-tab-order-light.png](shell-190-navigation-ke1-tab-order-light.png) |
| KE2 | Tab order with the rail | Dark, 1280 by 800 | Planning board, focus on the Board icon with its tooltip | [shell-190-navigation-ke2-tab-order-rail-dark.png](shell-190-navigation-ke2-tab-order-rail-dark.png) |
| KE3 | Route change | Light, 1440 by 900 | Enter on 1001, then the h1 Order 1001 has focus | [shell-190-navigation-ke3-route-change-light.png](shell-190-navigation-ke3-route-change-light.png) |
| KE4 | Route change | Dark, 1280 by 800 | The same step at 1280 | Not exported |
| KE5 | Collapse keeps focus | Light, 720 by 240 crop | The sidebar trigger, now Expand sidebar | [shell-190-navigation-ke5-collapse-keeps-focus-light.png](shell-190-navigation-ke5-collapse-keeps-focus-light.png) |
| KE6 | Fallback to main | Light, 960 by 360 crop | No h1, so main has focus | [shell-190-navigation-ke6-fallback-to-main-light.png](shell-190-navigation-ke6-fallback-to-main-light.png) |
| KE7 | Switcher menu open | Light, 720 by 320 crop | Plants in two companies, focus on Plant B | [shell-190-navigation-ke7-switcher-menu-focus-light.png](shell-190-navigation-ke7-switcher-menu-focus-light.png) |
| KE8 | Switcher menu closed | Light, 720 by 200 crop | Focus back on the switcher | Not exported |
| KE9 | Plant chosen | Dark, 1440 by 900 | Production orders in Plant B, its h1 focused | Not exported |
| KE10 | Reload dialog, focus trap | Light, 1440 by 900 | The focus trap on Reload page, annotated | [shell-190-navigation-ke10-reload-dialog-focus-light.png](shell-190-navigation-ke10-reload-dialog-focus-light.png) |
| KE11 | Sheet open | Light, 320 by 640 | Focus on Close navigation; numbers are the Tab cycle inside the sheet | [shell-190-navigation-ke11-sheet-focus-light.png](shell-190-navigation-ke11-sheet-focus-light.png) |
| KE12 | Sheet closed | Light, 320 by 640 | Focus back on Open navigation | Not exported |
| KE13 | Entry chosen | Dark, 320 by 640 | Proposals, its h1 focused; title Proposals · Plant A · NorthMES | Not exported |
| KE14 | Reload dialog | Dark, 320 by 640 | Focus on Reload page | Not exported |
| KE15 | Help menu open | Light, 720 by 360 crop | The release 1 top bar with no bell, focus on the first entry | [shell-190-navigation-ke15-help-menu-focus-light.png](shell-190-navigation-ke15-help-menu-focus-light.png) |
| KE16 | Help menu closed | Dark, 720 by 200 crop | Focus back on Help, the last top bar stop in release 1 | Not exported |
| KE17 | Focus ring on every shell surface | Light, 1440 by 900 | Every stop ringed at once, as an annotation | [shell-190-navigation-ke17-focus-ring-light.png](shell-190-navigation-ke17-focus-ring-light.png) |
| KE18 | Focus ring on every shell surface | Dark, 1440 by 900 | The same annotation in dark | [shell-190-navigation-ke18-focus-ring-dark.png](shell-190-navigation-ke18-focus-ring-dark.png) |
| KE19 | Focus not obscured | Light, 1280 by 800 | `scroll-padding-top` measured under the restarting strip | [shell-190-navigation-ke19-focus-not-obscured-light.png](shell-190-navigation-ke19-focus-not-obscured-light.png) |
| KE20 | Not obscured | Dark, 320 by 640 | Two strips under the top bar; the table scrolls sideways | [shell-190-navigation-ke20-focus-not-obscured-320-dark.png](shell-190-navigation-ke20-focus-not-obscured-320-dark.png) |
| KE21 | Station tab order | Light, 1280 by 800 | Skip link focused, 48 px targets | [shell-190-navigation-ke21-station-tab-order-light.png](shell-190-navigation-ke21-station-tab-order-light.png) |
| KE22 | Idle warning closed | Dark, 1280 by 800 | Focus back on the first job of the D4 list | Not exported |
| KE23 | Build notes, not part of the UI | Light, 1440 wide | Keyboard, roles, icons, slots and copy for rows 1, 2 and 6 | [part 1](shell-190-navigation-ke23-build-notes-light-1.png), [part 2](shell-190-navigation-ke23-build-notes-light-2.png), [part 3](shell-190-navigation-ke23-build-notes-light-3.png) |
| KE24 | User menu open | Light, 720 by 400 crop | Opens upward with focus on Profile | [shell-190-navigation-ke24-user-menu-focus-light.png](shell-190-navigation-ke24-user-menu-focus-light.png) |
| KE25 | User menu closed | Dark, 720 by 200 crop | Focus back on the user button | Not exported |
| KE26 | Notifications panel open | Light, 720 by 320 crop | The panel has focus and reads No notifications | [shell-190-navigation-ke26-notifications-panel-focus-light.png](shell-190-navigation-ke26-notifications-panel-focus-light.png) |
| KE27 | Notifications panel closed | Dark, 720 by 200 crop | Focus back on the bell | Not exported |
| KE28 | Rail flyout open | Light, 720 by 420 crop | Master data's flyout, focus on its first item | [shell-190-navigation-ke28-rail-flyout-focus-light.png](shell-190-navigation-ke28-rail-flyout-focus-light.png) |
| KE29 | Rail flyout closed | Dark, 720 by 240 crop | Focus back on the Master data icon, its tooltip open | Not exported |
| KE30 | Switcher menu | Light, 320 by 640 | Plants in two companies, focus on Plant B | Not exported |
| KE31 | User menu | Dark, 320 by 640 | Focus on Profile | Not exported |
| KE32 | Tab order, admin | Light, 480 by 900 crop | An admin on Users, the sidebar at its end; numbers count the entries scrolled out of view | [shell-190-navigation-ke32-tab-order-admin-light.png](shell-190-navigation-ke32-tab-order-admin-light.png) |

### Frames without a PNG

- Dark twins of an exported light frame, with the same layout and the D1 dark tokens: PL10 to PL13, PL15, PL17, PL19, PL21, PL23, PL27 to PL29, PL31, PL35, PL37, PL39, PL41, PL43, PL45, PL47, PL49; NA2, NA4, NA6, NA10, NA13, NA14, NA16, NA18, NA20, NA22; ST2, ST4, ST14 to ST17, ST19 to ST21, ST24, ST26, ST30, ST32, ST35, ST37, ST39, ST41, ST43; SI5; SF8, SF13, SF15, SF17, SF19. PL2, PL33, NA12, ST22, ST28, SI2, SI8, SI17, SI20, SF4, KE2, KE18 and KE20 show the dark theme.
- ST9 and ST18: the planner paused live updates on the board, and the shell adds no status. Resume live updates and the count of waiting changes belong to the board toolbar of D3.
- SI6, SI9, SI12, SI15, SI18 and SI21: the sign-in states at 320, reflowed like SI3.
- SI10, SI11, SI13 and SI14: rate limited and blocked use the same error summary as SI7 with other copy, which the sign-in copy list holds.
- SF6: the Disconnected strip of SF5 in portrait, the size SF3 shows.
- SF9 to SF12: the Switch operator screens are proposals for D4, which owns the station sign-in screens. SF20 and the station copy list hold their rules and copy.
- KE4: KE3 at 1280 in dark.
- KE8, KE12, KE16, KE25, KE27 and KE29: focus back on the trigger after a layer closes, which the keys table records.
- KE9 and KE13: focus on the new h1 after a choice in a layer changes the route, the rule KE3 shows.
- KE14: the reload dialog of KE10 at 320 in dark.
- KE22: focus back on the element that had it after the station idle warning closes.
- KE30 and KE31: the switcher and user menus in the sheet, as NA5 and NA17, with focus marked.

## Build notes

Four frames hold the build notes, marked on the page as not part of the UI: KE23 for rows 1, 2 and 6, ST33 for row 3, SI22 for row 4 and SF20 for row 5. This section carries them over. A line marked proposed is not in the docs and needs Krister Johansson's yes. Copy marked doc is verbatim from the docs; every other label and line of copy is a proposal.

### Planner shell components

| Component | Used for | Frames |
|---|---|---|
| Sidebar | collapsible="icon": the labelled sidebar (256 px) and the rail (64 px). One nav landmark, Main, wraps SidebarHeader, SidebarContent and SidebarFooter, so the switcher and the user button sit in the same landmark as the entries. | KE1, KE2, KE32 |
| SidebarHeader | The company and plant switcher on the TeamSwitcher pattern: a SidebarMenuButton size lg (48 px) as the DropdownMenu trigger, with the company mark, the company over the plant and ChevronsUpDown. With roles in one plant it is static text, not a button. In the rail the company mark alone is the trigger, and with one plant it is static. On `/admin` the mark shows Building2 and the trigger reads Admin, Choose a plant. | KE7, KE8, KE30, PL32, PL36 to PL38, PL44, PL46 |
| SidebarGroup | One group per module under its SidebarGroupLabel, in the sections core, modules, plugins, then Administration at the bottom for admins. An unavailable or loading module keeps its label with (unavailable) or (loading). | KE1, KE32 |
| SidebarMenu, SidebarMenuSub | Entries as SidebarMenuButton links with the icon before the label and aria-current="page" on the current one. Nested entries sit in SidebarMenuSub behind a Collapsible disclosure. In the rail each top-level entry is an icon with a Tooltip, and a parent opens a DropdownMenu flyout to its right with itself and its nested entries. | KE1, KE2, KE28, KE29 |
| SidebarFooter | The user menu on the NavUser pattern: Avatar, name, username and ChevronsUpDown in a 48 px button. Its DropdownMenu opens upward, as wide as the button. In the rail the avatar alone opens it to the right. | KE24, KE25, KE31, PL34, PL35 |
| SidebarTrigger | At the top bar start with PanelLeft: Collapse sidebar or Expand sidebar, with aria-expanded and aria-controls the sidebar. Focus stays on it when the state flips. At 320 the Menu button opens the Sheet instead. | KE5, KE11, KE12 |
| SidebarInset | The column with the top bar, the strips and main. It renders as a div, not the main element shadcn gives it, so the header stays the banner landmark and main holds only the route (proposed). | KE1 |
| Tooltip | The labels of the rail icons, side right; the reason on the disabled Assistant; the retry hint under a failed top bar item, side bottom. Opens at once on focus and after a delay on hover; Escape closes it and focus stays. | KE2, KE29, ST22, PL40 |
| DropdownMenu | The switcher (one DropdownMenuGroup per company under a DropdownMenuLabel when the plants span two or more companies, plants as link items, then All plants and, for a company admin, Admin after a separator), the user menu (Profile, Admin for a company admin whose switcher is hidden, a DropdownMenuRadioGroup for the theme, Presentation settings, Sign out), Help, the rail flyout, Show the full path, and Page actions when the bar folds or at 320. | KE7, KE15, KE24, KE28, PL32, PL42, PL48 |
| Popover | The notifications panel under the bell: role dialog, not modal, labelled by its h2 Notifications and described by the empty state No notifications. With nothing focusable inside, the panel itself takes focus through tabindex -1 and draws the two-tone ring. | KE26, KE27 |
| Breadcrumb | BreadcrumbLink for the plant crumb, a plain link to the plant home; the company as plain text when the user has plants in two or more companies; BreadcrumbLink for the route crumbs, BreadcrumbPage for the current page and BreadcrumbEllipsis with the Show the full path menu. | KE1, KE9, NA11 |
| Avatar | AvatarFallback with the initials on `--secondary` with an inset `--border` ring, in the footer button, the rail and the user menu header. It is decorative: the name is text beside it, or the button's name in the rail. | KE24, KE31 |
| Badge | The unread count on the bell in Plex Mono, 9+ above nine, aria-hidden because the bell's name carries the number; the reconnecting chip in the top bar; Onboarding after the name of a plant in onboarding in the switcher menu, `--warning` on `--warning-subtle`, whose word is part of the link text after a visually hidden comma. None is a focus stop. | KE17, KE18, PL32, PL33, NA23 |
| Sheet | Navigation at 320 from the left: the switcher head with Close navigation, the entries, then one footer row with the user button, Assistant, Help and the bell. Opening moves focus to Close navigation. The assistant sheet at 320 opens from the right edge to the full screen. | KE11 to KE13, KE30, KE31 |
| Dialog | The reload dialog and the station idle warning, both as Alert Dialog (role alertdialog). | KE10, KE14, SF7 |
| Alert | Banner strips under the top bar, without role="alert": their text goes through the polite live region once. The link in a strip is 24 px high. | KE17, KE19 |
| Button | Page actions and Assistant; IconButton with its required label for the sidebar trigger, Help, the bell, Open navigation and Close navigation, and for the fallback of a failed top bar item, with CircleAlert and a dashed `--muted-foreground` border; 48 px at the station (question K10). | All, PL40 |
| SkipLink | A NorthMES pattern, not shadcn (D1 Q12): the first stop, in the primary colors. | KE1, KE21, PL14 |

### Tokens

Every color is a D1 token.

- Focus ring: `--focus-outline` is the 2 px outline at 2 px offset, `--focus-ring` the 2 px band that touches the control. `--ring` and `--sidebar-ring` hold the outline value. Menu items: `--accent` with a 2 px inset `--focus-outline`. Main as the fallback target: the outline at -4 px offset plus an inset `--focus-ring` band (KE6).
- Surfaces the ring sits on (KE17, KE18): `--background`, `--card`, `--popover`, `--sidebar`, `--sidebar-primary`, `--primary`, `--accent` and `--destructive-subtle`; the station top bar is `--card`.
- Skip link and tooltips: `--primary` and `--primary-foreground`. Sidebar: `--sidebar`, `--sidebar-foreground`, `--sidebar-primary` with `--sidebar-primary-foreground` for the current entry and the company mark, `--sidebar-accent` for hover and for the switcher and user button while their menu is open, `--sidebar-border` and `--muted-foreground`. Row links: `--link`.
- Avatar: `--secondary` with a 1 px inset `--border` ring, so it stays visible on `--sidebar-accent`. Unread badge: `--primary` and `--primary-foreground` with a 2 px ring in the surface color.
- Status: `--warning` and `--warning-subtle` for the chip, the restarting strip and the Onboarding badge, `--destructive` and `--destructive-subtle` for the database strip, `--info` and `--info-subtle` for the restore strip and the plant in onboarding strip, `--success` and `--success-subtle` for the station chip. A failed top bar item draws `--muted-foreground` with a dashed border, as an unavailable module does in the rail.
- Sizes: the top bar, the sidebar head and the rail head are 56 px, so their rules meet on one line. The switcher and the user button are 48 px (SidebarMenuButton size lg), rail icons 32 px, the rail mark and the avatar 40 px. `--nm-control-height` (36 px) for the trigger, Help, the bell and Assistant; `--nm-target-min` (24 px), which the crumb links, the ellipsis and the strip links meet; `--nm-target-min-station` (44 px). Station buttons draw 48 px, which no D1 token holds yet (question K10). The overlay, black at 50 percent, is still D1's open question.
- Type: the h1 uses the D1 Page title role, 28 / 34, from 1280 up. At 320 it is 1.5rem / 1.875rem (24 / 30), proposed for D1 Q18.

### Icons

| Group | Entry and lucide icon |
|---|---|
| Core: Master data and its nested entries | Master data: Database; Equipment groups: Layers; Machines: Drill; Tools: Hammer; Articles: Package; Routings: Route; Calendars: CalendarDays; Warehouses: Warehouse; Customers: Handshake |
| Planning | Board: ChartGantt; Job table: Table; Production orders: ClipboardList; Proposals: ListChecks; Settings: CalendarCog |
| Pyramid connector, AI and Audit | Pending changes: FileDiff; Import log: Logs; Import inbox: Inbox; Settings: ServerCog; Usage: Gauge; Audit log: ScrollText |
| Acme tooling (plugin) | Tool life: Hourglass; Tool changes: Repeat |
| Administration | Users: Users; Roles: Shield; Stations: Monitor; Integrations: Plug; Settings: Settings; System health: Activity |
| Admin pages at `/admin` | Overview: LayoutDashboard; Plants: Factory |
| Module icons, drawn in the rail only while a module is unavailable or loading | Core: Database; Planning: ChartGantt; Production start: CirclePlay; Pyramid connector: ArrowLeftRight; AI: Sparkles; Audit: ScrollText; Acme tooling: Wrench; Administration: Shield |
| Shell chrome | Switcher and user button: ChevronsUpDown; Plants in the switcher: Factory; All plants: LayoutGrid; Sidebar trigger: PanelLeft; Open navigation: Menu; Notifications: Bell; Help: CircleHelp; Assistant: Sparkles; Profile: User; Light: Sun; Dark: Moon; Presentation settings: SlidersHorizontal; Sign out: LogOut; Current item: Check; Disclosure, crumb separator: ChevronRight; Show the full path, Page actions: Ellipsis; Close: X; Admin, and the mark on `/admin`: Building2; A failed top bar item: CircleAlert; Fallback for an icon name NavIcon does not know: Shapes |

Every name is an icon of lucide 1.45.0, the version D1 pins, and each one renders on the design page. All of them are proposals until the manifests carry an icon (spec 1.1.6). Planning and its Board entry share ChartGantt, and Administration and Roles share Shield; a module icon shows only in the rail while that module is unavailable or loading. The three Settings entries have their own icons: CalendarCog for Planning, ServerCog for Pyramid connector and Settings for Administration. In the rail a label that repeats gives way to the route title as the name and the tooltip (Planning settings, Pyramid connector settings, Settings). Building2 marks Admin and the mark of the admin frame; Factory marks the plants in the switcher and Plants under `/admin`. NavIcon draws Shapes for a name it does not know, so a plugin built against a newer list still loads (ADR 0067).

### Focus order

Tab order in KE1, a planner on Production orders at 1440:

1. Skip to main content
2. Acme AB, Plant A, switch plant
3. Master data
4. Entries under Master data
5. Board
6. Entries under Board
7. Job table
8. Production orders (current)
9. Proposals
10. Pending changes
11. Import log
12. Tool life
13. Tool changes
14. Alex Lund, alex.lund, account
15. Collapse sidebar
16. Plant A (crumb)
17. Planning (crumb)
18. New order
19. Assistant
20. Help
21. Notifications
22. Search orders
23. Status
24. Clear filters
25. Order (sort)
26. Deadline (sort)
27. 1001
28. 1002
29. 1003
30. 1004
31. 1005
32. Next (Previous is disabled and skipped)

Other orders:

- KE2, the rail: 1 the skip link, 2 the company mark (Acme AB, Plant A, switch plant), 3 to 10 the icons Master data, Board, Production orders, Proposals, Pending changes, Import log, Tool life and Tool changes, 11 the avatar (Alex Lund, alex.lund, account), 12 Expand sidebar, 13 Plant A, 14 Planning, 15 Run autoplan, 16 Save, 17 Assistant, 18 Help, 19 Notifications, 20 the board grid as one stop.
- KE32, an admin: the admin entries Settings, Import inbox, Settings, Usage and Audit log join their modules, and after Tool changes come Users, Roles, Stations, Integrations, Settings and System health, then the user button and the top bar.
- PL44, the admin frame: 1 the skip link, 2 the switcher (Admin, choose a plant), 3 Overview, 4 Plants, 5 the user button, 6 Collapse sidebar, 7 Admin (crumb), 8 New plant, 9 Help, 10 Notifications, then the page.
- KE11, the sheet: Tab cycles through the switcher, Close navigation, the entries, the user button, Assistant, Help and Notifications, then back to the switcher.
- One plant: no switcher stop. Release 1: no Notifications stop.
- KE21, the station: 1 Skip to main content, 2 Switch operator, 3 Sign out, 4 More, 5 the first stop of the D4 screen. SF20 holds the station build notes.

### Focus rules

- DOM order: skip link, the nav Main (switcher, entries, Administration, user button), the header (sidebar trigger, breadcrumb, page actions, Assistant, Help, bell), main, then the docked aside. Focus order follows the DOM and the DOM follows the visual order: the sidebar is the left column from the top left corner, so it comes before the top bar (2.4.3). The h1 and main have tabindex -1, so Tab never stops on them.
- The sidebar trigger controls the sidebar before it in the DOM through aria-controls. Collapsing or expanding keeps focus on the trigger (KE5). The rail keeps the same order: company mark, one icon per top-level entry, avatar.
- Route change: on onRendered with pathChanged, focusPageHeading waits one frame and focuses the h1, else main (spec 7.2; KE3, KE4, KE6). A change of search parameters only, such as filters, sort or ?view=table, leaves focus where it is.
- First load: nothing in the page has focus, so the first Tab reaches the skip link, which the route suite checks (derived from spec 2.2 and 7.2). The same holds after Reload page.
- Layers: menus, the rail flyout, the notifications Popover, the sheet and dialogs move focus inside when they open and return it to their trigger when they close (spec 7.4, 7.5). When a choice inside a layer changes the route, the route change wins and focus goes to the new h1 (KE9, KE13). Inside the 320 sheet, Escape closes an open menu first and the sheet on a second press.
- One plant: the head is static text with no stop, so the first Tab after the skip link reaches the first entry. Release 1: no bell, so Help is the last top bar stop (KE16).
- Focus not obscured: the top bar and the strips under it form one sticky block. The page scroller sets scroll-padding-top to the block's height plus 8 px, read with a ResizeObserver, because strips wrap, appear and go (proposed, K3; KE19, KE20). Docked panels sit beside main, never over it (spec 7.7). Menus, the flyout and tooltips open beside or above their trigger and never cover the focused item.
- The shell adds no single-key shortcut (spec 7.9), and the station has no global key listener. The Ctrl+B and Cmd+B toggle that shadcn Sidebar ships is left off (question K12).

### Keys and where focus goes

| Control | Keys | Focus after | Frames |
|---|---|---|---|
| Skip to main content | Tab reaches it first; Enter follows it | Focus moves to main; the next Tab reaches the first stop in the content | KE1, KE21 |
| Sidebar entry, rail icon, flyout item, breadcrumb link | Enter | The route changes and focus moves to the new h1, else to main; an open flyout closes first | KE3, KE4, KE6 |
| Entries under Board | Enter or Space | Stays on the button; aria-expanded flips and the nested entries follow it in the Tab order | KE1 |
| Collapse sidebar, Expand sidebar | Enter or Space | Stays on the trigger at the top bar start, whose name and aria-expanded flip; the sidebar becomes the rail or the labelled sidebar | KE5 |
| Rail icon | Tab onto it; Escape | Its tooltip opens at once; Escape closes the tooltip and focus stays | KE2 |
| Rail parent icon (Master data, Board) | Enter, Space or Down opens; Up, Down, Home and End move; Enter follows; Escape closes | The flyout opens to the right with focus on its first item, the parent entry. Escape returns focus to the icon, whose tooltip opens again (K13) | KE28, KE29 |
| Switcher | Enter, Space or Down opens; Up, Down, Home and End move across the companies; Enter follows; Escape closes | Opens with focus on the first plant other than the current one (proposed, K1). Escape returns to the switcher. Another plant opens the same page there with focus on its h1; All plants opens `/`, and Admin opens `/admin` in a full navigation with focus on its h1. On `/admin` no plant is current, so focus starts on the first plant | KE7, KE8, KE9, PL32, PL46 |
| User button | As the switcher; Enter or Space on Light or Dark | Opens upward with focus on Profile. Choosing a theme closes the menu and focus returns to the user button (proposed, K7); Admin, for a company admin whose switcher is hidden, opens `/admin`; Sign out goes to the sign-in page | KE24, KE25, PL42 |
| Switcher or user menu at 320 | As above, inside the open sheet; Escape | The menu opens inside the sheet. Escape closes the menu and focus returns to its button in the sheet; a second Escape closes the sheet | KE30, KE31 |
| Notifications (bell) | Enter or Space opens; Escape closes | The Popover opens and focus moves into it; with no notifications the panel itself has focus: tabindex -1, the two-tone ring, aria-describedby the empty state (proposed, K11). Escape returns focus to the bell | KE26, KE27 |
| Notifications at 320 | Enter or Space on the bell in the navigation sheet footer; Escape | The navigation sheet closes and the panel opens as a sheet with focus in it; Escape returns focus to Open navigation (proposed, not drawn). Whether Open navigation shows an unread marker while the sheet is closed is question K14 | NA3, NA4 |
| Failed top bar item | Tab onto it; Enter or Space | Its tooltip opens at once on focus. Enter or Space mounts the contribution again, and focus stays at its place, on the control it renders (proposed) | PL40, PL41 |
| Help | As the switcher | Opens with focus on the first entry; Escape returns to Help; an in-app entry such as All pages moves focus to its h1 | KE15, KE16 |
| Show the full path | As the switcher | Opens with focus on the plant, the first link of the trail; Escape returns to the ellipsis; a link changes the route and focus moves to its h1 | NA11, NA12 |
| Page actions | As the switcher | Escape, or an action that stays on the page, returns focus to the trigger | NA8 |
| Open navigation (320) | Enter or Space | The sheet opens with focus on Close navigation; Tab and Shift+Tab stay inside | KE11 |
| Close navigation | Enter or Space; Escape anywhere in the sheet | The sheet closes and focus returns to Open navigation | KE12 |
| Entry in the sheet | Enter | The sheet closes, the route changes and focus moves to the new h1 | KE13 |
| Assistant | Enter or Space | The panel docks and focus moves to its message input; Escape or Close assistant returns focus to Assistant | KE17, PL14 |
| Assistant at 320 | Enter or Space in the navigation sheet footer | The navigation sheet closes and the assistant sheet opens with focus in the message input; Close assistant returns focus to Open navigation (proposed) | NA9, NA10 |
| Assistant, disabled | Tab onto it | Focus stays; its tooltip opens at once and names the reason; Enter and Space do nothing | ST22 |
| Reload page (dialog) | Tab and Shift+Tab stay on it; Escape does nothing (question K8) | Opening moves focus to Reload page; the reload starts a fresh page with nothing focused | KE10, KE14 |
| Reload page (placeholder, status route) | Enter or Space | A fresh page loads with nothing focused | ST1, ST7 |
| Try again (error panel) | Enter or Space | The route renders again and focus moves to its h1 (spec 7.2) | ST6 |
| Copy correlation id | Enter or Space | Focus stays on the button; the polite region says Correlation id copied (proposed) | ST6 |
| Switch operator, Sign out, More (station) | Enter or Space | Switch operator opens the Switch operator screen with focus in the badge field. Sign out goes to the sign-in screen, whose badge field takes focus through a ref. More opens with focus on Help | KE21, SF9, SF16 |
| Idle warning (station) | Tab stays on Stay signed in; Escape: question K6 | Opening moves focus to Stay signed in; closing returns focus to where it was | SF7, SF8, KE22 |

Controls in the states the shell owns (ST33):

| Control | Focus after |
|---|---|
| Reload page (placeholder, status route) | A fresh page loads with nothing focused; the first Tab reaches the skip link. |
| Try again (error panel) | The route renders again and focus moves to its h1 (7.2). |
| Copy correlation id | Focus stays on the button; the polite region says Correlation id copied. |
| Try again (slow remote) | Focus stays on the button until the remote loads, then moves to the h1. |
| Try again (slot fallback) | The contribution mounts again; focus moves to its first focusable element, else to the WidgetFrame heading. |
| Go to Planning board, See all pages, plant links | The route changes and focus moves to the new h1. |
| Open System health, Open AI usage | As any link: the route changes and focus moves to the new h1. |
| Account menu (pages without a plant) | The user menu opens with focus on its first item, as from the sidebar foot; Escape closes it and focus returns to the avatar. |
| Continue onboarding | As any link: the plant wizard opens and focus moves to its h1. |
| Admin (plant list) | `/admin` opens in a full navigation, and focus moves to its h1. |

### Landmarks, roles and accessible names

| Element | Role and state | Accessible name |
|---|---|---|
| Skip link | link to main | Skip to main content |
| Sidebar | nav; holds the switcher, the entries, Administration and the user button; at 320 it sits inside the sheet | Main |
| Switcher | button, aria-haspopup="menu", aria-expanded; the company mark is aria-hidden; the name starts with the visible company and plant (2.5.3) | Acme AB, Plant A, switch plant; on `/admin`: Admin, choose a plant |
| Static head (one plant) | text with no role and no stop; in the rail the mark carries the same words, visually hidden | Acme AB, Plant A |
| Switcher menu | menu; one group per company, labelled by the company name, when the plants span two or more companies, and no group with one company; plants are menuitem links, the current one with aria-current="page" and a check, none on `/admin`; a plant in onboarding ends its link text with Onboarding, drawn as a Badge; All plants and, for a company admin, Admin after a separator | Switch plant; a plant in onboarding: Plant D, Onboarding |
| Module group | header text plus a list with aria-labelledby; an unavailable or loading module keeps the header and has no list | Planning; Pyramid connector (unavailable) |
| Administration | a group like a module group, after the plugins, drawn only for admin permissions | Administration |
| Entry | link; the icon is aria-hidden; aria-current="page" on the current one | its label |
| Disclosure | button, aria-expanded | Entries under Board |
| Rail icon | link named by its entry, aria-current="page" on the current one; a parent is a button with aria-haspopup="menu" and aria-expanded, and a parent that holds the current page carries aria-current, page for its own route and true when a nested entry is current. Each module's icons sit in one list labelled by the module. Rail names use the route title when a label repeats, so an admin's three Settings read Planning settings, Pyramid connector settings and Settings. A Tooltip with role tooltip shows the same name | Production orders; Master data; Planning settings; Pyramid connector (unavailable) |
| Rail flyout | menu; the group label above the items is presentation; items are menuitem links, the current one with aria-current="page" and a check | Master data |
| User button | button, aria-haspopup="menu", aria-expanded; the avatar is aria-hidden | Alex Lund, alex.lund, account |
| User menu | menu; the header with avatar, name and username is presentation; Profile, Admin (a company admin whose switcher is hidden) and Presentation settings are links, Light and Dark are menuitemradio with aria-checked, Sign out is a menuitem | Alex Lund, alex.lund, account |
| Sidebar trigger | button, aria-expanded, aria-controls the sidebar | Collapse sidebar, Expand sidebar |
| Open navigation | button, aria-haspopup="dialog", aria-expanded | Open navigation |
| Navigation sheet | dialog, aria-modal="true"; holds the switcher, the nav Main and the footer row | Navigation |
| Top bar | header (banner landmark) | None |
| Breadcrumb | nav with an ordered list: the company as text when there are several, the plant crumb as a link to the plant home, then the route crumbs; the last crumb has aria-current="page"; crumbs of a module page carry the module's lang; on `/admin` the trail starts with Admin | Breadcrumb |
| Ellipsis crumb | button, aria-haspopup="menu", aria-expanded; its menu, labelled by the company, lists the plant and every crumb above the current page as links | Show the full path |
| Help menu | menu; one group per module, labelled by the module label | Help |
| Bell | button, aria-haspopup="dialog", aria-expanded, aria-controls the panel while it is open; the count badge is aria-hidden | Notifications; Notifications, 3 unread |
| Failed top bar item | button at the contribution's place; aria-describedby its tooltip while the tooltip shows; the icon is aria-hidden | Notifications (unavailable) |
| Notifications panel | Popover with role dialog, not modal, aria-labelledby its h2, aria-describedby the empty state; tabindex -1, so it takes focus when nothing inside can, with the two-tone ring (KE26) | Notifications |
| Assistant | button, aria-expanded, aria-controls the aside while it is docked; when disabled, aria-disabled and aria-describedby its tooltip | Assistant |
| Assistant panel | aside (complementary), aria-labelledby its h2; at 320 a dialog with aria-modal | Assistant |
| Main | main, tabindex="-1", aria-busy while the route loads | None |
| Page heading | h1, tabindex="-1" | the route title or the entity label |
| Reload dialog | alertdialog, aria-modal="true", aria-labelledby its heading, aria-describedby its text; the app root behind it is inert | NorthMES was updated |
| Station | header and main after the skip link; the idle warning is an alertdialog; the offline strip has role="status" (SF20) | You will be signed out in 30 seconds |

### Announcements

| When | How | Text |
|---|---|---|
| Live updates stop (planner layout) | Polite region, once | Live updates paused, reconnecting |
| Live updates are back | Polite region, once (proposed, K5) | Live updates resumed |
| Server restarting (502 or 503) | Polite region, once; the strip stays | NorthMES is restarting. Changes are paused until it is back; you do not need to reload. |
| Database not ready (admins) | Polite region, once | The database is not ready. Changes cannot be saved until it is back. |
| Restore banner (24 hours) | Polite region, once per page load (proposed) | Data restored to 2026-10-04 22:00; changes after that were lost. |
| Readiness or AI budget changes (admins) | Polite region, once per change | The banner text (ST11, ST12, ST13) |
| Route change or plant switch | No live message: the focused h1 is read and the title changes | None |
| Sidebar collapses or expands | No live message: the trigger's name and aria-expanded change while it keeps focus | None |
| A top bar item fails | Polite region, once, only when focus was elsewhere (proposed) | Notifications could not load. |
| Unread count changes | No live message from the shell: the bell's name carries the count; what a new notification announces belongs to the notifications module | None |
| Reload dialog opens | No live message: the alertdialog is read when focus moves into it | None |
| Station loses the connection | The role="status" strip, once per change. The station layout sends nothing to the polite region for the drop, and its chip has no live role (Q15) | No connection to NorthMES. Entries stay on this screen and are not sent until the connection is back. |

The polite and assertive regions sit in index.html outside #root, with aria-live and aria-atomic set, so they work while a modal is open (spec 1.6.2). In the planner layout the chip, the strips and the dialogs carry no live role of their own, so each message is read once. At the station the Disconnected strip is the one element with its own role="status", and nothing else speaks for a drop.

### Slots

| Slot | Place, contents and rules |
|---|---|
| TopBarActions | The page actions slot (pin 1 in PL1). Remotes render Buttons through the TopBarActions portal of @northmes/ui; PageFrame places them at the start of the top bar's end group, before Assistant, Help and the bell. It takes Buttons only: one Button default for the main action at most, outline for the rest, no menus or inputs (proposed). When the bar runs out of room the shell folds, in this order: the middle crumbs into Show the full path, then every page action into one Page actions menu in their order, then Assistant drops its label (NA8). At 320 the actions always sit in Page actions. |
| `planning/board/header/v1` | Beside the h1 (pin 2): Pyramid data as of 06:40, from the Pyramid connector. Text only, no controls (proposed). |
| Route content | main (pin 3): the route's screen, under the h1 that PageFrame renders. |
| Aside slot | The shell aside (pin 4), aria-labelledby its h2 Assistant. The chat panel of E14-S03 mounts here and survives route changes: docked at 360 px beside main from 1280 px up, a modal sheet at 320 (NA9, NA10), absent when no provider is configured (ST31). |
| `planning/board/side/v1` | Beside the board grid in PL1: a WidgetFrame section, 280 px wide, aria-labelledby the contribution's label, Large orders (example-widget.large-orders). Its props carry plantId and paused. A failure renders the fallback inside the frame (ST27, ST28). |
| `core/top-bar/items/v1` | At the top bar end after Help (ADR 0067; the id is proposed). Each contribution renders one compact control named by its label, such as the bell with its Popover, without a WidgetFrame and inside its own error boundary. Its props carry plantId, null on `/admin`. A contribution that fails at stage slot keeps its place as an IconButton with CircleAlert and a dashed border, named {label} (unavailable), with a tooltip; Enter or Space mounts it again (PL40, PL41). Release 1 builds neither the slot nor the bell. |

### Route titles

The title pattern is the specific part, the plant, then NorthMES (spec 2.4). A page without a plant leaves the plant out, and a page under `/admin` puts Admin in the plant's place. The three Settings entries have their own titles, so every title stays unique.

| Route title | Frames that show it | Source |
|---|---|---|
| Planning board · Plant A · NorthMES | PL1, PL14, PL20, PL22, ST8, ST10, ST27, ST31 | doc |
| Order 1001 · Plant A · NorthMES | KE3, KE4 | doc |
| Page not found · Planning · Plant A · NorthMES | ST5 | doc |
| Plants · Admin · NorthMES | PL44 | doc |
| Production orders · Plant A · NorthMES | ST11, ST23 | proposed |
| Production orders · Plant B · NorthMES | KE9 | proposed |
| Proposals · Plant A · NorthMES | ST12, ST13, KE13 | proposed |
| Machines · Plant A · NorthMES | | proposed |
| Mill 1 · Plant A · NorthMES | | proposed |
| Users · Plant A · NorthMES | | proposed |
| Settings · Plant A · NorthMES | | proposed |
| Planning settings · Plant A · NorthMES | | proposed |
| Pyramid connector settings · Plant A · NorthMES | | proposed |
| AI usage · Plant A · NorthMES | | proposed |
| Pyramid connector unavailable · Plant A · NorthMES | ST1, ST34 | proposed, pattern from spec 3.1 |
| Production orders could not be shown · Plant A · NorthMES | ST6 | proposed |
| System status · Plant A · NorthMES | ST7 | proposed (Q2, Q10) |
| Planning · Plant A · NorthMES | ST25 | proposed: the route title is not known before the remote loads |
| NorthMES was updated · Plant A · NorthMES | ST3, KE10 | proposed |
| Planning board · Plant D · NorthMES | ST36 | the doc pattern for Plant D |
| Overview · Admin · NorthMES | | proposed |
| Page not found · NorthMES | ST29 | proposed (Q10) |
| Your plants · NorthMES | ST38 | proposed |
| Plant D is not open yet · NorthMES | ST40 | proposed |
| Your company is not open yet · NorthMES | ST42 | proposed |
| Sign in · NorthMES | SI1, SI4, SI7, SI10, SI13, SI19 | proposed (Q10) |
| Set a new password · NorthMES | SI16 | proposed (Q10) |
| Press 4 · Plant A · NorthMES | SF1 to SF8, SF13 to SF19 | proposed |
| Switch operator · Press 4 · Plant A · NorthMES | SF9 to SF12 | proposed |

The titles without frames come from the KE23 copy list. The long-strings frames NA7 and NA8 show German and Finnish titles. Banners leave the route's own title in place (ST10 to ST13).

### States the shell owns

Every state renders inside `Shell.dc.html`, or in the shell's own page without a plant, so module pages never draw them again (spec 0.9).

| State | Frames | Components and tokens | Roles, names and focus | Announcement | Title | WCAG 2.2 |
|---|---|---|---|---|---|---|
| Module unavailable | ST1, ST2, ST34, ST35 | Card with the ErrorState pattern: CircleAlert in `--destructive`, the text, the module, stage and code as a description list, and a way out. Button default Reload page, Button outline Go to Planning board. In the rail the module icon (ArrowLeftRight) has a dashed `--muted-foreground` border and a Tooltip (`--primary`). | Route `/$plant/pyramid-connector/$`. The h1 takes focus one frame after the route renders (7.2). The sidebar keeps the Pyramid connector header with (unavailable) as plain text and no entries, at its usual place (1.1.9, Q7). In the rail (ST2, ST34) the module keeps one icon at its place, a link named Pyramid connector (unavailable) to this route, and the tooltip with that name opens on hover and focus. | None: the focused h1 is read. | Pyramid connector unavailable · Plant A · NorthMES (pattern from 3.1) | 1.3.1, 2.4.2, 2.4.3, 3.2.3, 4.1.2 |
| Reload dialog | ST3, ST4 | Alert Dialog on the D1 Dialog surface (`--background`, `--border`), overlay black at 50 percent (D1 question). Button default Reload page with RotateCw. | alertdialog, aria-modal, aria-labelledby its heading, aria-describedby its text. The app root is inert, so the dialog heading is the only h1 (Q11). Opening moves focus to Reload page; Tab and Shift+Tab stay on it; Escape does nothing (question K8). While it is open the client refuses mutations (3.6). | None: the alertdialog is read when focus moves into it. | NorthMES was updated · Plant A · NorthMES (proposed) | 2.1.2, 2.4.3, 4.1.2 |
| Module page not found | ST5, ST14 | Card in the EmptyState shape: SearchX in `--muted-foreground`, the path in Plex Mono, Button default Go to Planning board (the module's first nav entry, 3.3) and Button outline See all pages. | Planning's notFoundComponent; sidebar, top bar and skip link stay. The h1 takes focus. | None. | Page not found · Planning · Plant A · NorthMES (doc, 2.5) | 2.4.2, 2.4.3, 2.4.5 |
| Error panel | ST6, ST15 | Card with the ErrorState pattern (3.4: text, the correlation id and a way out). IconButton Copy with the label Copy correlation id; Button default Try again; Button outline Go to Planning board. The route's page actions leave the top bar. | defaultErrorComponent with its own h1, focused on render. Copy correlation id keeps focus. Try again renders the route again and focus moves to its h1 (7.2). | Polite region, once: Correlation id copied (proposed). | Production orders could not be shown · Plant A · NorthMES (proposed) | 2.4.3, 3.3.1, 4.1.3 |
| Minimal status route | ST7, ST16 | Two Cards: Server as a key and value list, Modules as a Table. Badge with CircleCheck in `--success` on `--success-subtle`, or CircleAlert in `--destructive` on `--destructive-subtle`. Button default Reload page. | A shell route that renders when the core remote fails (3.5). The sidebar shows Core and Administration with (unavailable), each at its place. h1 System status, an h2 per card, column headers on the table. Reload page loads a fresh page with nothing focused. | None. | System status · Plant A · NorthMES (proposed, Q2, Q10) | 1.3.1, 1.4.1, 2.4.6 |
| Reconnecting | ST8, ST17 | The chip in the top bar: LoaderCircle, `--warning` on `--warning-subtle`, one line. In the board toolbar (D3) Resume live updates is disabled (aria-disabled, opacity 0.5) with the reason beside it; block moves are off. | The chip is not a focus stop and has no live role. The disabled Resume stays focusable with its name. At 320 the same text is a strip under the top bar. | Polite region, once: Live updates paused, reconnecting (doc). When the socket is back: Live updates resumed (proposed, K5). | Planning board · Plant A · NorthMES | 1.4.1, 4.1.3 |
| Live updates paused by the planner | ST9, ST18 | No shell status. Resume live updates and the count of waiting changes belong to the board toolbar (D3). | Resume is a button; the count is plain text. | None from the shell. | Planning board · Plant A · NorthMES | 4.1.2 |
| Restore banner | ST10, ST19 | Alert, info tone: Info icon, `--info` on `--info-subtle`, a strip under the top bar inside the sticky block. | Shown to planners and admins for 24 hours (E18-S04). The strip has no role; its text goes through the polite region. | Polite region, once per page load (proposed). | The route's own title | 1.4.1, 2.4.11, 4.1.3 |
| Readiness banner | ST11, ST20 | Alert, warning tone: TriangleAlert, `--warning` on `--warning-subtle`; the link Open System health with a 24 px target. | Admins only, built from the degraded list of `/health/ready` (ADR 0046). The link opens System health in core. | Polite region, once per change of the degraded list. | The route's own title | 2.4.4, 2.5.8, 4.1.3 |
| AI budget banner | ST12, ST21, ST13, ST22 | Alert, warning tone for warning and destructive tone (CircleAlert, `--destructive` on `--destructive-subtle`) for exhausted; the link Open AI usage. When exhausted the Assistant toggle stays in place with aria-disabled and a Tooltip (`--primary`). | Admins see the banner (E13-S05). The disabled toggle stays focusable, so its tooltip opens at once on focus and after a delay on hover; aria-describedby points at the tooltip (ST22). | Polite region, once per change of `ai.budget_state`. | The route's own title | 1.4.13, 2.5.8, 4.1.2, 4.1.3 |
| Route loading | ST23, ST24 | Skeleton (LoadingState) in the shape of the populated list: the filter row, the table header and five rows in `--accent`. | main has aria-busy="true" until the data renders (1.4.2). PageFrame renders the h1 outside the data Suspense, so it is there and focused from the start. The page actions arrive with the screen. | None. | Production orders · Plant A · NorthMES | 1.3.1, 2.4.3, 4.1.2 |
| Slow remote | ST25, ST26 | Card with LoaderCircle in `--muted-foreground`, the text and Button outline Try again; a Skeleton of the toolbar and the board below. The sidebar keeps the Planning header with (loading) and no list until the remote loads. | Shown after 2 s, inside main, which has aria-busy. Try again starts a new request and keeps focus; when the remote loads, focus moves to its h1. After 10 s in the planner layout, 30 s at a station, ST1's placeholder replaces it (3.2). | Polite region, once: Planning is taking longer than usual to load. (proposed) | Planning · Plant A · NorthMES (proposed: the route title is not known before the remote loads) | 2.4.3, 4.1.3 |
| Slot contribution failed | ST27, ST28 | WidgetFrame, a section with aria-labelledby from the contribution's label (Large orders). Inside it the fallback: CircleAlert, two lines, stage and code, Button outline Try again. | The fallback is a group named by its first line, with tabindex -1. When focus was inside the widget it moves to the fallback (ST28); otherwise focus stays. Selecting another entity, or Try again, mounts the contribution again (3.12). | Polite region, once, only when focus was elsewhere: Large orders could not be shown. (proposed) | Planning board · Plant A · NorthMES | 1.3.1, 2.4.3, 4.1.3 |
| Unknown plant | ST29, ST30 | The page renders without a plant, so there is no sidebar, no switcher and no crumbs. The top bar holds the NorthMES mark, Help and the account menu: the avatar as in the rail, opening the user menu of the sidebar foot. Card with SearchX, the path in Plex Mono, and the user's plants as links grouped by company, each with the switcher's Factory mark. | NOT_FOUND, never a default plant (1.3.5, 3.13). The h1 takes focus. h2 Your plants, an h3 per company, and a list per company named by its h3. Each plant link opens that plant's root (Q3). The list is the switcher's data, the companies and plants the user holds roles in (Q4). No Assistant and no bell, since both act inside a plant (proposed). With no sidebar, the account menu stays at the top bar end (question K15). | None. | Page not found · NorthMES (proposed, Q10) | 2.4.2, 2.4.3, 2.4.4 |
| No AI provider | ST31, ST32 | No Assistant toggle and no aside; Help and the bell keep their places. | With no provider configured the feature is off and nothing in the shell names it (1.5.3). | None. | Planning board · Plant A · NorthMES | 3.2.3, 3.2.6 |
| Plant in onboarding | ST36, ST37 | Alert in the info tone (Info, `--info` on `--info-subtle`) under the top bar, with the link Continue onboarding to the plant wizard at `/$plant/core/onboarding`. The rest of the shell is as usual. | Only a holder of `core.onboarding:manage` reaches a plant whose onboarding is in progress, and uses it as usual (ADR 0066). The strip has no live role, and its link is 24 px high. The banner stays until Open plant completes onboarding. | Polite region, once per page load (proposed). | Planning board · Plant D · NorthMES | 2.4.4, 2.5.8, 4.1.3 |
| Plant list at `/` | ST38, ST39 | The top bar of ST29 with Button outline Admin (Building2) before Help when the user has an admin page. A Card holds one h2 per company and its plants: the switcher's Factory mark, the plant link, the path in Plex Mono, and the Onboarding Badge after a plant in onboarding. | `/` for every user that ADR 0066 does not send on: more than one plant, or a plant and an admin page. No plant, so no sidebar, no switcher and no crumbs; the h1 takes focus. Each list is named by its company h2. A plant in onboarding is listed only for a holder of `core.onboarding:manage`, and its link reads Plant D, Onboarding. Admin opens `/admin`. Companies and plants come in the server's order, by name. | None. | Your plants · NorthMES (proposed) | 1.3.1, 1.4.1, 2.4.2, 2.4.4 |
| Plant not open yet | ST40, ST41 | The layout of ST29 with Construction in `--muted-foreground`, the sentence, and the user's open plants grouped by company. | A link to a plant whose onboarding is in progress, opened by a user with a role there and without `core.onboarding:manage`. The module list returns the plant with no modules (ADR 0066), so the page has no sidebar and no crumbs. The h1 takes focus; each plant link opens that plant's root. | None. | Plant D is not open yet · NorthMES (proposed) | 2.4.2, 2.4.3, 2.4.4 |
| Company not open yet | ST42, ST43 | The layout of ST29 with Construction in `--muted-foreground` and two sentences. No plant links, since the user has no open plant. | `/` for a user with no open plant and no admin page (ADR 0066). It says that the company's onboarding is not complete, or that no plant is assigned yet. The h1 takes focus; the account menu at the top bar end holds Sign out. | None. | Your company is not open yet · NorthMES (proposed) | 2.4.2, 2.4.3 |

Rules for every state:

- Every state keeps the skip link, the sidebar with the switcher at its top and the user menu at its foot, the top bar and Help in their places. The exceptions are the reload dialog, where the page behind is inert, and the pages without a plant: the unknown plant page, the plant list at `/` and the pages for a plant or a company in onboarding. They have no sidebar, so their account menu sits at the top bar end.
- Each state has one h1 and the title pattern of spec 2.4: specific part, plant, NorthMES. A page without a plant leaves the plant out.
- Strips under the top bar carry no live role. Their text goes once through the polite region in index.html, outside #root (1.6.2), so each message is read once.
- The planner top bars here end with the bell, which needs the notifications module. Release 1 ships without it (ADR 0055), so in release 1 they end with Help. The pages without a plant show no bell.
- Stage names come from the docs. The code `web.asset_missing` comes from the failure table of plan 06; `web.entry_failed`, `web.render_error` and `web.slot_error` are invented examples.

### Sign-in page

The sign-in page is a shell route outside the plant routes. Nobody is signed in yet, so it renders without the planner shell: no sidebar, no plant switcher and no menus. SI1 to SI21 draw seven states at 1440 by 900 in light and dark and at 320 by 640. Operators at a station sign in through the station screens of D4, not here.

Route, title and landmarks:

- Path, proposed: `/sign-in`. Its first segment joins the reserved plant slugs (spec question 2, ADR 0064). Setting a new password is a second step of the same route.
- Titles, proposed (spec question 10): "Sign in · NorthMES" and "Set a new password · NorthMES".
- Skip to main content is the first focus stop and moves focus into main (2.4.1). The header holds only the product mark. Main holds the card with one h1 (tabIndex -1).
- The theme is the browser's stored choice from the user menu, applied before the first render. The page has no theme control.
- At 320 the card drops its border and padding, and nothing scrolls sideways (1.4.10). Text containers grow with 200 percent text and with text spacing.
- Page title at 320: 1.5rem / 1.875rem (24 / 30), proposed for D1 Q18; 1440 uses the D1 Page title role, 28 / 34.

Components and tokens:

- Card for the form surface. Field and Label, Input. Button default for Sign in and Save and continue, Button ghost for Sign out.
- Button size icon (IconButton, label "Show password") inside the password input for the toggle, 28 px, above the 24 px minimum (2.5.8).
- Alert, variant destructive, as the error summary (ErrorSummary in `@northmes/ui`, proposed; D1 question 13). Alert in the success tone for "You are signed out", without a live role: the polite region says it once.
- Tokens: `--card`, `--border`, `--input`; `--destructive` on `--destructive-subtle` for the summary (5.68:1 light, 5.92:1 dark); `--success` on `--success-subtle` for the status; `--muted-foreground` for help text; the two-tone focus ring. Pairs to add to the contrast test: `--foreground` on `--destructive-subtle` and on `--success-subtle`.
- Icons: CircleAlert (summary, field error), Eye and EyeOff (toggle), CircleCheck (signed out; proposed, not in the D1 icon list).

Fields and autocomplete (1.3.5):

| Field | Element | Attributes |
|---|---|---|
| Username or email | `input type="text" name="username"` | `autocomplete="username" autocapitalize="none" spellcheck="false"` |
| Password | `input type="password" name="password"` | `autocomplete="current-password"` |
| New password | `input type="password" name="new-password"` | `autocomplete="new-password"` |
| Username, new password step | `input type="text" name="username" readOnly` | `autocomplete="username"` with the account's username, visually hidden and out of the tab order, so a password manager saves the new password for the right account. The visible text shows the same value |

Accessible authentication (3.3.8):

- No step has a cognitive function test: no CAPTCHA, no puzzle, no characters to transcribe and no security question.
- A password manager can fill every field: a real form element with a submit button, the autocomplete values in the table, labels tied to their inputs and never `autocomplete="off"`.
- Paste works in every field: no paste, copy or drop handlers, and no maxlength below 128, Better Auth's maximum password length.
- Show password: aria-pressed with a fixed label. Pressed, the input becomes type text and the icon EyeOff; focus stays on the toggle; the input is masked again after submit.
- A forgotten password goes to a plant admin (E05-S08), never through a test.

Errors, focus and announcements:

- Field errors (SI4 to SI6): text under the field with CircleAlert, aria-invalid, aria-describedby to the error text. The summary lists the same messages as links to the fields (3.3.1, 3.3.3).
- On a submit with errors or a refusal from the server, focus moves to the summary: a group named by its h2 title, tabIndex -1. The focus move makes a screen reader read it, so it carries no alert role.
- Wrong password (SI7 to SI9): the username keeps its value (3.3.7) and the password clears. The password input gets `aria-invalid="true"` and aria-describedby pointing at its error text, "Enter your password again. Passwords are case-sensitive.", until the user types. The summary link moves focus to the password field. An unknown user gets the same message.
- Rate limited (SI10 to SI12): Better Auth's rate limiter (storage in the database; by default 3 sign-in requests in 10 seconds) answers 429 with an X-Retry-After header in seconds, which the message fills in. Sign in stays enabled; pressing it early shows the message again.
- Blocked (SI13 to SI15): an account an admin banned (E05-S08). The message shows only after the right password, so it tells nothing to someone who does not know the password.
- New password (SI16 to SI18): after a sign-in with a temporary password every other request fails until the new password is saved. Sign out leaves without saving.
- Signed out (SI19 to SI21): the route changes, focus goes to the h1 (2.4.3) and the polite region says "You are signed out." once (4.1.3). The box shows the same text and has no live role, so it is not read twice. The fields stay empty.
- Sign-in, failed sign-in and sign-out write security events (E05-S05). Enter in a field submits the form.

Keyboard order: on the sign-in step, Skip to main content, the summary links when shown, Username or email, Password, Show password, Sign in. On the new password step, Skip to main content, New password, Show password, Save and continue, Sign out.

WCAG 2.2: 1.3.1, 1.3.5, 1.4.10, 2.4.1, 2.4.3, 2.4.6, 2.4.7, 2.4.11, 2.5.8 (the summary links are 24 px high), 3.3.1, 3.3.2, 3.3.3, 3.3.7, 3.3.8, 4.1.2, 4.1.3.

### Station frame

`StationFrame.dc.html` is the frame every station route mounts: `/station/$stationId`, full screen, no sidebar (spec 5.1). D2 draws the frame with nobody signed in and with an operator signed in; the screens inside it belong to D4 (E11).

| Component | Used for | Frames |
|---|---|---|
| Button, size lg | Switch operator (outline), Sign out (ghost), the Switch operator form buttons. 48 px high: not a D1 token yet (question K10); the layout's minimum is `--nm-target-min-station`, 44 px. | SF1 to SF19 |
| IconButton | More, with the label More; Sign out in portrait, with the label Sign out; Show password with aria-pressed. 48 by 48 px. | SF3, SF11, SF16 |
| Dropdown Menu | More: Help as a menuitem link, then a DropdownMenuRadioGroup Theme on this station with Light and Dark. | SF16, SF17 |
| Alert Dialog | The idle sign-out warning, on the D1 Dialog surface and overlay. | SF7, SF8 |
| Alert | The Disconnected strip, warning tone, with role="status". | SF5, SF6 |
| Badge | The connection chip: Wifi with `--success` on `--success-subtle`, or LoaderCircle with `--warning` on `--warning-subtle`. One line, never a focus stop. | SF1, SF5 |
| Card, Field, Input | The Switch operator form: Badge, Username, Password; Input at 48 px. | SF9 to SF12 |
| SkipLink | Skip to main content, 48 px high in the station layout. | SF18, KE21 |

Tokens:

- Top bar `--card` with `--border`; screen `--background`; text `--foreground` and `--muted-foreground` for the plant name.
- The station layout sets `--nm-target-min` to `--nm-target-min-station` (44 px), so every @northmes/ui primitive in it, shell chrome and plugin panels included, follows (spec 5.3).
- Chip: `--success` on `--success-subtle` when connected, `--warning` on `--warning-subtle` while reconnecting; the strip uses the warning pair too.
- Station body text is 16/24 and the h1 28/36; the Station number role (32/40, 600 Mono) belongs to the D4 screens.

Landmarks, focus and keys:

- Tab order: Skip to main content, Switch operator, Sign out, More, then the first stop of the D4 screen (KE21). Nobody signed in: Skip to main content, More, then the badge field.
- After sign-in, and after every route change, focus moves to the station h1, for example Press 4, Anna Berg (doc, 5.9).
- Switch operator opens the Switch operator screen with focus in the badge field. That screen leaves Switch operator out of the top bar, the one exception to 5.8; Cancel returns to the previous screen with focus on Switch operator.
- More opens with focus on Help; Escape closes it and focus returns to More. Choosing Light or Dark stores the choice for this device and closes the menu (proposed, K7).
- Idle warning: opening moves focus to Stay signed in; closing returns focus to the element that had it (KE22). Escape: question K6.
- No global key listener anywhere in the station layout (2.1.4).

Station sign-in, proposals for D4:

- These screens are proposals for D4, which owns the station sign-in screens (spec 5.13).
- Badge: the reader types into the focused badge field only. The field takes focus through a ref, never autofocus, on the sign-in screen and on the Switch operator screen. No global key listener (5.8).
- Username: input type="text" autocomplete="username" autocapitalize="none" spellcheck="false".
- Password: input type="password" autocomplete="current-password"; paste allowed; Show password is an IconButton with aria-pressed and a fixed label.
- A PIN, where a station uses badge plus PIN, is one input type="password" inputmode="numeric" autocomplete="current-password" that accepts paste, never one box per digit (5.7).
- A failed scan clears the field, keeps focus in it, shows the message under it with aria-describedby, and says it once through the polite region (5.9).
- After sign-in focus moves to the station h1. The previous operator stays signed in until the next one signs in.

Announcements:

| When | How | Text |
|---|---|---|
| The connection drops | The role="status" strip, once per change. The station sends nothing to the polite region for the drop, and the chip has no live role (Q15). | No connection to NorthMES. Entries stay on this screen and are not sent until the connection is back. |
| The connection is back | The strip goes; the polite region says it once (proposed, K5). | Live updates resumed |
| Badge not recognized | Text under the field and the polite region, once. | Badge not recognized. Scan again or sign in with your user name |
| Idle warning opens | No live message: the alertdialog is read when focus moves into it. | None |

WCAG 2.2 criteria:

| Criterion | Where the station frame applies it |
|---|---|
| 1.3.5 | Username and password autocomplete values |
| 2.1.1 | Every control by keyboard |
| 2.1.4 | No single-key shortcut, no global key listener |
| 2.2.1 | Idle warning 30 s ahead with Stay signed in |
| 2.4.1 | Skip link first (SF18, KE21) |
| 2.4.2 | Unique titles per station route |
| 2.4.3 | Focus to the h1 after sign-in and route changes; layers return focus |
| 2.5.8 | 48 px controls, above the 44 px station minimum |
| 3.3.1 | Badge error text next to the field |
| 3.3.8 | Paste, autofill and the show-password toggle; no cognitive test |
| 4.1.3 | Disconnected strip and the badge error, each read once |

### WCAG 2.2 criteria for the planner shell

| Criterion | Where the planner shell frames apply it |
|---|---|
| 1.3.1 | Landmarks, one labelled list per module group in the sidebar and in the rail, one labelled group per company in the switcher when the plants span two or more companies, the breadcrumb list, menu groups, dialog headings; the rail parent that holds the current page carries aria-current |
| 1.4.1 | A plant in onboarding is marked by the word Onboarding in its link, not by the badge color alone (PL32, PL33, PL46, NA23) |
| 1.4.11 | Each ring half reaches 3:1 on every surface in KE17 and KE18 (D1 contrast) |
| 1.4.13 | The rail tooltips, the disabled Assistant tooltip and the tooltip of a failed top bar item open on focus, close on Escape, stay open while the pointer moves onto them and hold nothing interactive (KE2, KE29, ST22, PL40) |
| 2.1.1 | Every shell control is reachable and operable by keyboard; the flows run without page.mouse |
| 2.1.2 | The sheet and dialogs hold focus by design and close with Escape; the reload dialog leaves through Reload page; the notifications Popover is not modal |
| 2.1.4 | No single-key shortcut in the shell |
| 2.2.1 | Station idle warning 30 s ahead with Stay signed in (SF7, SF8) |
| 2.4.1 | Skip link as the first stop (KE1, KE21, PL14) |
| 2.4.2 | Title pattern, unique per route: the three Settings entries have their own titles (Settings, Planning settings, Pyramid connector settings); titles under `/admin` leave the plant out (Plants · Admin · NorthMES) |
| 2.4.3 | DOM order equals visual order: skip link, sidebar, top bar, main; route change to the h1; layers return focus to their trigger |
| 2.4.4 | Rail links have distinct names: a label that repeats uses the route title (Planning settings, Pyramid connector settings, Settings) |
| 2.4.7 | Two-tone ring on every stop, the notifications panel included when it holds focus (KE26); inset outline on menu items |
| 2.4.11 | scroll-padding-top from the sticky block (KE19, KE20); docked panels beside main; menus, the flyout and tooltips open beside or above their trigger |
| 2.5.3 | The switcher's name starts with its visible company and plant, the user button's with the visible name and username. Icon-only controls (rail icons, the trigger, Help, the bell) show no text, and the rail tooltip shows the name |
| 2.5.8 | Crumb links, the ellipsis and strip links are 24 px high; the switcher and the user button 48 px, rail icons 32 px, the rail mark and avatar 40 px, other controls 36 px; 48 px station buttons |
| 3.1.2 | Module text in another language carries lang: the Finnish plugin's crumbs, h1 and content (NA8) |
| 3.2.1 | Focus only scrolls into view and opens a tooltip; menus, the flyout, the panel and the sheet open on Enter or click |
| 3.2.2 | The switcher is a menu of links; nothing changes until a link is followed |
| 3.2.3 | Sidebar and rail order come from the manifests and never follow usage; a failed or loading module keeps its place, in the rail too; Administration is always last |
| 3.2.4 | An entry has the same icon and label in the sidebar, the rail tooltip and the flyout; where a label repeats in the rail, the rail name and tooltip use the route title, as the page title does |
| 3.2.6 | Help keeps its place and order in the top bar on every planner page; the bell, when installed, always follows it |
| 4.1.2 | Names, roles and states as listed above |
| 4.1.3 | Reconnecting, the banners and the station connection through live regions, each read once |

### Final English copy

Braces mark values the page fills in.

Planner shell (KE23):

| Group | Copy |
|---|---|
| Shell chrome | "Skip to main content" (doc); "Collapse sidebar"; "Expand sidebar"; "Open navigation"; "Close navigation"; "Navigation"; "Main"; "Breadcrumb"; "Switch plant"; "{company}, {plant}, switch plant"; "All plants"; "Show the full path"; "Entries under {label}"; "(unavailable)" (doc); "(loading)"; "Page actions"; "Assistant"; "Close assistant"; "Message the assistant"; "Send"; "Written by an AI assistant. Check before you commit." (doc); "Help"; "All pages" (doc); "Accessibility" (doc); "Notifications"; "Notifications, {n} unread"; "No notifications"; "9+"; "{user}, {username}, account"; "Profile"; "Theme"; "Light"; "Dark"; "Presentation settings"; "Sign out"; "Onboarding"; "Admin"; "Choose a plant"; "Admin, choose a plant"; "Notifications (unavailable)"; "Notifications could not load. Select to try again."; "Notifications could not load."; "Planner" (doc); "Plant admin" (doc); "Company admin" |
| Navigation labels (spec 8.2) | "Core"; "Master data"; "Equipment groups"; "Machines"; "Tools"; "Articles"; "Routings"; "Calendars"; "Warehouses"; "Customers"; "Planning" (doc); "Board"; "Job table"; "Production orders"; "Proposals"; "Settings"; "Pyramid connector"; "Pending changes"; "Import log"; "Import inbox"; "AI"; "Usage"; "Audit"; "Audit log"; "Acme tooling"; "Tool life"; "Tool changes"; "Administration"; "Users"; "Roles"; "Stations"; "Integrations"; "System health" |
| Admin pages at `/admin` | "Overview"; "Plants"; "New plant" |
| Companies, plants and people in the frames | "Acme AB"; "Nordic Tools AB"; "Plant A" (doc); "Plant B" (doc); "Plant C"; "Plant D"; "Alex Lund" (doc); "alex.lund"; "Jonas Holm"; "jonas.holm" |
| Status and banners | "Live updates paused, reconnecting" (doc); "Live updates resumed"; "NorthMES is restarting. Changes are paused until it is back; you do not need to reload."; "The database is not ready. Changes cannot be saved until it is back."; "Data restored to {time}; changes after that were lost." (doc); "Open System health"; "Open AI usage" |
| Reload dialog, as in the states part (ST3) | "NorthMES was updated"; "This tab runs the previous version, so saving is off until you reload."; "Reloading keeps everything that is saved. Changes on this page that are not saved yet are lost."; "Reload page" |
| Route titles | "Planning board · Plant A · NorthMES" (doc); "Order 1001 · Plant A · NorthMES" (doc); "Production orders · Plant A · NorthMES"; "Production orders · Plant B · NorthMES"; "Proposals · Plant A · NorthMES"; "Machines · Plant A · NorthMES"; "Users · Plant A · NorthMES"; "Mill 1 · Plant A · NorthMES"; "Settings · Plant A · NorthMES"; "Planning settings · Plant A · NorthMES"; "Pyramid connector settings · Plant A · NorthMES"; "AI usage · Plant A · NorthMES"; "Pyramid connector unavailable · Plant A · NorthMES"; "Page not found · Planning · Plant A · NorthMES" (doc); "Production orders could not be shown · Plant A · NorthMES"; "System status · Plant A · NorthMES"; "Planning · Plant A · NorthMES"; "Page not found · NorthMES"; "NorthMES was updated · Plant A · NorthMES"; "Sign in · NorthMES"; "Set a new password · NorthMES"; "Press 4 · Plant A · NorthMES"; "Switch operator · Press 4 · Plant A · NorthMES"; "Plants · Admin · NorthMES" (doc); "Overview · Admin · NorthMES" |
| Sample content, not shell copy | "Search orders"; "Status"; "Clear filters"; "Order"; "Article"; "Quantity"; "Deadline"; "Previous"; "Next"; "pcs" |

Lines marked doc are verbatim from the docs; every other line is proposed and needs Krister Johansson's yes. The company names, Plant C, Plant D, Jonas Holm and the usernames are invented. The copy of the states, the sign-in page and the station frame follows.

States the shell owns (ST33):

| Group | Copy |
|---|---|
| Module unavailable | "(unavailable)" (doc); "{label} (unavailable)"; "The {label} module did not load, so its pages cannot open. Planning and the other modules work as usual."; "NorthMES recorded the error for your plant admin. Reload to try again. If {label} stays unavailable, tell your plant admin."; "Module"; "Stage"; "Code"; "Reload page"; "Go to Planning board" |
| Reload dialog | "NorthMES was updated"; "This tab runs the previous version, so saving is off until you reload."; "Reloading keeps everything that is saved. Changes on this page that are not saved yet are lost."; "Reload page" |
| Module page not found | "Page not found" (doc); "{module} has no page at {path}. The link may be out of date."; "Go to {first entry}"; "See all pages" |
| Error panel | "{route title} could not be shown"; "This page stopped with an error while it was drawn. Saved data is not affected."; "Try again. If the error comes back, give your plant admin the correlation id."; "Correlation id"; "Copy correlation id"; "Correlation id copied"; "Try again" |
| Minimal status route | "System status"; "The Core module did not load. Master data and the Administration pages, System health among them, belong to Core, so they cannot open until it loads. This page is part of the shell and shows what the server reports."; "Server"; "Readiness"; "Database"; "Live updates"; "Modules"; "Ready"; "Connected"; "Loaded"; "Unavailable" |
| Reconnecting and paused | "Live updates paused, reconnecting" (doc); "Live updates resumed"; "Moves are off until live updates are back."; "Resume live updates"; "Pause live updates"; "Live updates paused. {n} changes waiting." |
| Banners | "Data restored to {time}; changes after that were lost." (doc); "NorthMES is running with degraded checks: {checks}."; "Open System health"; "The AI budget for {month} has passed its warning threshold. The assistant stops for all users when the monthly limit is reached."; "The AI budget for {month} is used up. The assistant is off for all users until {date} or until the budget is raised."; "Open AI usage"; "The AI budget for {month} is used up" |
| Loading and slow remote | "Planning is taking longer than usual to load."; "If {label} does not load within 10 seconds, this page shows what went wrong."; "Try again"; "(loading)" |
| Slot contribution failed | "{label} could not be shown."; "The rest of the board works as usual."; "Try again" |
| Unknown plant | "Page not found" (doc); "There is no plant at {path} that you can open. The link may be out of date."; "Your plants" |
| Plant in onboarding | "{plant} is in onboarding. Until onboarding is complete, only people who manage its onboarding can open it."; "Continue onboarding" |
| Plant list and pages in onboarding | "Your plants"; "Admin"; "Onboarding"; "{plant} is not open yet"; "Its onboarding is not complete. You can open it once an admin completes onboarding."; "Your company is not open yet"; "Its onboarding is not complete. You can open its plants once an admin completes onboarding."; "No plant is assigned to you yet." |

Sign-in page (SI1 to SI21), all proposed:

| Group | Copy |
|---|---|
| Page | "Skip to main content"; "NorthMES"; "Sign in to NorthMES"; "Set a new password" |
| Form | "Username or email"; "Password"; "Show password"; "Sign in"; "Forgot your password? Ask a plant admin to reset it." |
| Field errors | "Fix 2 fields to sign in"; "Enter your username or email" (summary link); "Enter your username or email." (field); "Enter your password" (summary link); "Enter your password." (field) |
| Wrong password | "The username or password is wrong"; "Passwords are case-sensitive."; "Enter your password again" (summary link); "Enter your password again. Passwords are case-sensitive." (field) |
| Rate limited | "Too many sign-in attempts"; "Wait 10 seconds, then sign in again." (the number comes from X-Retry-After) |
| Blocked | "This account is blocked"; "Ask a plant admin if you still need access." |
| New password | "You signed in with a temporary password. Choose a new password to continue."; "Username"; "New password"; "Use at least 8 characters."; "Save and continue"; "Sign out" |
| Signed out | "You are signed out" (box); "You are signed out." (polite region) |

Station frame (SF20):

| Group | Copy |
|---|---|
| Top bar and menu | "Skip to main content"; "Press 4" (doc); "Plant A" (doc); "Connected"; "Live updates paused, reconnecting" (doc); "Switch operator" (doc); "Sign out"; "More"; "Help"; "Theme on this station"; "Light"; "Dark" |
| Headings and titles | "Press 4, Anna Berg" (doc); "Sign in at Press 4"; "Switch operator"; "Press 4 · Plant A · NorthMES"; "Switch operator · Press 4 · Plant A · NorthMES" |
| Status and dialog | "No connection to NorthMES. Entries stay on this screen and are not sent until the connection is back." (doc); "You will be signed out in 30 seconds" (doc); "Your entries on this screen are kept."; "Stay signed in" (doc) |
| Switch operator (proposal for D4) | "Anna Berg stays signed in until the next operator signs in."; "Badge"; "Hold your badge to the reader."; "or"; "Sign in with username"; "Username"; "Password"; "Show password"; "Sign in"; "Scan a badge instead"; "Cancel"; "Badge not recognized. Scan again or sign in with your user name" (doc) |

The failed-scan message keeps the doc wording "user name"; the field and button say Username, as the sign-in page and spec 4.2 do. Q26 lists the drift.

### Shell props

`Shell.dc.html` takes these props. Attribute names on `<dc-import>` are written in kebab case (`show-title`, `bell-count`, `nav-scroll`) and arrive in camel case.

| Prop | Values | Default | What it draws |
|---|---|---|---|
| `theme` | `light`, `dark` | `light` | Adds the D1 `.dark` class on the frame root |
| `width` | `1280`, `1440`, `1920`, `320` | `1440` | Screen 1280 by 800, 1440 by 900, 1920 by 1080 or 320 by 640 |
| `height` | px | 0 | Overrides the screen height |
| `sidebar` | `expanded`, `rail`, `sheet` | `expanded` | Labelled sidebar (256 px), rail (64 px), or at 320 the open navigation sheet (288 px) with its overlay |
| `role` | `planner`, `admin`, `company-admin` | `planner` | `admin` (plant admin) adds Administration and the module admin entries. `company-admin` draws the same, plus Admin after All plants in the switcher menu, or in the user menu when there is no switcher |
| `mount` | `plant`, `admin` | `plant` | `admin` draws the admin frame at `/admin`: Overview and Plants in a Core group, no plant or company crumb, no Assistant, a title without the plant, and the switcher head Admin, Choose a plant with no plant current |
| `access` | `one-company`, `companies`, `one-plant` | `one-company` | Preset of companies and plants: Acme AB with Plant A and Plant B; also Nordic Tools AB with Plant C; or Acme AB with Plant A only, which draws the static head |
| `companies` | `"Acme AB: Plant A, Plant B; Nordic Tools AB: Plant C"` or an array | from `access` | Replaces the preset. Two or more companies add the company crumb; one plant in total draws the static head |
| `company` | text | the company that holds `plant` | Company name in the head, the full path menu label and the first crumb |
| `plant` | text | the first plant | Current plant: head, plant crumb, title and the checked switcher item |
| `onboarding` | `"Plant D"`, `"Plant D\|Plant C"` or an array | none | Plants in onboarding: the Onboarding badge after the name in the switcher menu and Onboarding in the link text. Company admin frames only |
| `plants` | `"Plant A\|Plant B"` or an array | none | Older form: the plants of one company. Ignored when `companies` is set |
| `user`, `username` | text | Alex Lund, alex.lund (planner); Jonas Holm (admin roles) | Avatar initials, footer button and user menu header |
| `nav` | nav entry id | `planning.board` | Current entry, rail highlight, crumbs, h1 and route actions |
| `open` | comma list of parent ids | `planning.board` | Parents shown expanded in the labelled sidebar |
| `title` | text | route title of `nav` | The h1 and the specific part of the document title |
| `entity` | text | empty | Entity label: replaces the h1, adds the last crumb, specific part of the title |
| `crumbs` | `"A\|B\|C"` or an array | from `nav` and `entity` | Route crumbs after the company and plant crumbs |
| `actions` | `"Run autoplan\|*Save"` (`*` marks the primary button), an array, or `none` | route default | Page actions |
| `status` | `none`, `reconnecting`, `banner`, `both` | `none` | The reconnecting chip in the top bar (a strip at 320), the banner strip, or both |
| `banner-kind` | `info`, `warning`, `error` | `info` | Strip tone and icon (Info, TriangleAlert, CircleAlert) |
| `banner`, `banner-action` | text | per kind | Strip copy and a link at its end |
| `assistant` | `closed`, `docked`, `sheet`, `off`, `disabled` | `closed` | Top bar toggle; docked adds the 360 px aside (a modal sheet at 320); `off` hides the toggle; `disabled` keeps it with aria-disabled |
| `assistant-tip` | text | "The AI budget for this month is used up" | Tooltip of the disabled toggle |
| `bell` | `none`, `unread`, `open`, `off`, `failed` | `none` | The bell after Help; `unread` with a count badge; `open` with its panel; `off` is the release 1 top bar; `failed` is the fallback of the top bar slot |
| `bell-count` | integer | 3 | Unread count; the accessible name carries it |
| `menu` | `none`, `plant`, `help`, `user`, `actions`, `path` | `none` | Opens one menu with keyboard focus on an item |
| `flyout` | `core.master-data` or `planning.board` | empty | Rail only: that parent's flyout |
| `tip` | rail item id | empty | Rail only: the tooltip beside that icon |
| `focus` | `none`, `skip`, `toggle`, `nav`, `plant`, `crumb`, `path`, `actions`, `assistant`, `help`, `bell`, `panel`, `user`, `h1`, `main`, `message` | `none` | The D1 two-tone ring on that stop |
| `pageLang` | language tag | the module's | `lang` of the route's own text |
| `unavailable`, `loading` | comma list of module ids | empty | Group header "(unavailable)" or "(loading)" with no entries; in the rail a dashed or dotted module icon |
| `nav-scroll` | `current`, `top`, `end` | `current` | Scroll position of the sidebar body and the rail list |
| `strings` | `default`, `long` | `default` | German labels and chrome with a Finnish plugin group (`lang="fi"`) |
| `marks` | `off`, `slots`, `landmarks` | `off` | Annotations: slot outlines with pins, or landmark outlines with tags |
| `show-title` | `off`, `on` | `off` | Annotation above the screen with the document title |
| `doc-title` | text | computed | Overrides the document title |
| `collapse` | `auto`, `none`, `crumbs`, `actions`, `all` | `auto` | Top bar folding: middle crumbs, then page actions, then the Assistant label |
| `heading` | `show`, `none` | `show` | `none` leaves the h1 row to the content |
| `busy` | `true`, `false` | `false` | aria-busy on main |

Slots of `Shell.dc.html`: children without `data-slot` render in main under the h1; a top-level child with `data-slot="header"` renders beside the h1, `data-slot="actions"` in the page actions slot, and `data-slot="aside"` in the docked chat panel.

`StationFrame.dc.html` takes these props:

| Prop | Values | Default | What it draws |
|---|---|---|---|
| `size` | `1280x800`, `1920x1080`, `800x1280` | `1280x800` | Screen size; portrait hides the wordmark text and lets the chip wrap |
| `theme` | `light`, `dark` | `light` | `.dark` on the frame root |
| `connection` | `connected`, `reconnecting`, `offline` | `connected` | The chip, and with `offline` the Disconnected strip with role status |
| `station`, `plant` | text | Press 4, Plant A | Top bar, title and the default h1 |
| `operator` | text, empty or `none` | Anna Berg | Signed in: h1 "Press 4, Anna Berg" with Switch operator and Sign out. Empty or `none`: h1 "Sign in at Press 4" without them |
| `title`, `heading` | text; `show`, `none` | from station and operator; `show` | The h1 and its row |
| `screen` | `default`, `switch` | `default` | `switch` is the Switch operator screen, whose top bar leaves out Switch operator |
| `menu` | `none`, `more` | `none` | The More menu: Help, then Theme on this station |
| `dialog` | `none`, `idle` | `none` | The idle sign-out warning with Stay signed in focused |
| `focus` | `none`, `skip`, `switch`, `signout`, `more`, `h1`, `main` | `none` | Two-tone ring on that stop |
| `marks` | `off`, `landmarks` | `off` | Header and main outlines |
| `show-title`, `doc-title` | `off`, `on`; text | `off`; computed | Title annotation and its override |

## What the implementer takes

The implementers of E04-S02 to E04-S05, E05-S05 and E05-S15 take from the design page the layout, region order, states and their transitions (one test per state), copy text verbatim, the keyboard model and slot placements. They take no markup, class names, inline styles, canvas icons, demo numbers or token values beyond D1's `ui/tokens.css`. A value on the page that is not a token, such as the overlay at 50 percent black or the 48 px station buttons, is a question, not a new value. Release 1 builds the top bar without the bell and without the slot `core/top-bar/items/v1` (PL26, KE15, KE16). The full rule is in [plan 06, Approval and what the implementer takes](../../plan/06-web-and-ux.md#approval-and-what-the-implementer-takes).

## Assumptions

The header frame lists these assumptions:

1. Most frames show the Planner permission set. PL30, PL31, NA11, NA12, NA15, NA18, ST7, ST11 to ST13, ST16, ST20 to ST22, KE17, KE18 and KE32 show a Plant admin, whose sidebar adds the admin entries of each module and the Administration section: Users, Roles, Stations, Integrations, Settings and System health. PL32, PL33, PL42 to PL47, NA23 and ST36 to ST39 show a company admin, who holds core's company admin role with `core.plant:create` and `core.onboarding:manage`: the switcher also lists Plant D, a plant in onboarding, and Admin opens the admin pages.
2. A permission narrower than admin, such as one that only manages users, would show only its own Administration entries. No frame draws that case.
3. The people who install and run NorthMES create companies and each company's first company admin with the command line tool on the host (ADR 0066). No role sits above a company, and no page creates one. A company admin creates the company's plants on the admin pages under `/admin`. D2 draws the admin frame around them, with core's release 1 entries Overview and Plants; the pages themselves come from the canonical list and form page (E05-S15). Plant slugs are unique per installation, so planner URLs stay `/$plant`.
4. The admin pages live outside `/$plant`, at the proposed `/admin`, which joins the reserved plant slugs (ADR 0064, ADR 0066).
5. A new plant stays closed until its onboarding wizard is complete. Until then only a holder of `core.onboarding:manage` can open it, under a banner that links to the wizard (ST36, ST37), and the switcher lists it only for such a holder, with Onboarding in its link text (ADR 0066, ADR 0067). Anyone else with a role there reads that the plant is not open yet (ST40, ST41). The onboarding wizard is its own design task, E06-S14, and not part of D2.
6. On `/admin` no plant is current, so the switcher shows whenever the user can open a plant and reads Admin, Choose a plant. The assistant acts inside a plant, so `/admin` has none (proposed). The top bar slot renders there with plantId null (ADR 0067), so the bell stays.
7. The switcher and the company crumb need the companies and plants the user holds roles in. That list comes from the server; ADR 0066 proposes the fields companies and admin in `/api/v1/web/modules` (Q4).
8. Rail monograms are gone (C4). The rail shows the entry icons, and a module that failed keeps its module icon in its place. Every icon is a lucide 1.45.0 proposal, listed per entry in KE23.
9. The bell is hidden in release 1, which ships without the notifications module (ADR 0055). PL26, PL29, KE15 and KE16 draw the release 1 top bar; every other planner frame shows the bell, except the pages without a plant (ST29, ST30, ST38 to ST43), which have no sidebar, so their top bar ends with Help and the account avatar (K15). At 320 the bell sits in the navigation sheet footer (NA3, NA4).
10. A module with no planner nav entry, as Production start in release 1, never gets a sidebar group, loaded or failed (Q6).
11. Acme tooling is an invented plugin with routes, so the Plugins section has entries to show.
12. The board grid (D3), the chat panel (E14-S03, #136), the station screens (D4) and the content of the admin pages (E05-S15) are placeholders that name their owner. The board toolbar comes from option A and is context, not a D3 decision.
13. The company mark is a square with the company initial. The product mark on the sign-in page, the station frame and the pages without a plant is a placeholder square with an N.
14. The overlay (black at 50 percent) and the menu shadow are not D1 tokens and stay questions, as on the D1 page.
15. The failure stages come from the docs. The code `web.asset_missing` comes from the failure table of plan 06; `web.entry_failed`, `web.render_error` and `web.slot_error` are invented examples.
16. German and Finnish strings, the companies Acme AB and Nordic Tools AB, Plant C and Plant D, the article, machine and tool names, the user names alex.lund, jonas.holm and erik.lind, the plant slugs plant-a to plant-d and the times are invented for the drawing.
17. Lucide icons beyond the D1 list are proposals for the build notes.

## Open questions

The page lists the open questions of `shell/shell-190-spec.md` that remain, by their number there, then those raised in the build notes: K1 to K17 in KE23 and S1 to S4 in SI22. Where a frame draws a proposed answer, the last column names it.

| Id | Question | What the page draws |
|---|---|---|
| Q2 | What are the paths of the sign-in route, the minimal status route and the All pages index? A path at the root joins the reserved plant slugs (ADR 0064). | Drawn: `/sign-in` (row 4), `/` (ST38, ST42) and `/admin` (PL44 to PL47), the admin mount that ADR 0066 proposes. The status route and All pages have no path yet. |
| Q3 | What does / show for a user with plants in one or more companies: a redirect to the only plant, a chooser grouped by company, or a dashboard (P16 M-32)? | ADR 0066 proposes the answer: an admin of a company in onboarding goes to its wizard, a user with one open plant and no admin page goes to that plant, a user with no open plant reads that the company is not open yet, and every other user gets a page at `/` that lists their plants grouped by company. Drawn: the plant list (ST38, ST39) and the company that is not open yet (ST42, ST43); All plants in the switcher menu opens `/` (PL7, PL11, PL36, PL37, PL46, PL48, NA5, NA6). |
| Q4 | Where does the switcher get the companies and plants the user holds roles in? `/api/v1/web/modules` returns only the current plant, so the shell needs that list from the server. ADR 0066 proposes two new fields in that response: companies, with each plant's `onboardingState`, and admin. | PL7, PL11, PL20 to PL23, PL32, PL33, PL36 to PL39, PL42 to PL49, NA5, NA6, NA19 to NA23, ST29, ST36 to ST43 and KE7 need the answer. |
| Q5 | What is core's `web.label`, and does core group its registers under one parent entry, Master data? | Drawn: Core, with eight registers under Master data (PL5). Core's admin routes in a plant sit in the Administration section (PL30, PL31), so the nav contract needs a way to place them there; its pages under `/admin` come from adminRoutes (PL44, ADR 0066). |
| Q6 | Does Production start, which has no planner nav entry in release 1, show a sidebar group, and does its failure show an "(unavailable)" header in the planner layout? | Drawn: no group, loaded or failed, so a failure never adds a group (1.1.9, 3.2.3). The shell then has to learn from `/api/v1/web/modules` which modules have planner entries for the user, a contract change. ST1, ST2, ST34 and ST35 draw the placeholder for Pyramid connector, whose group keeps its place. |
| Q7 | Is the "(unavailable)" header a link to the placeholder route, or plain text? | Drawn: plain text in the sidebar (ST1, ST35, ST7). In the rail the module icon keeps its place with a dashed border and links to the placeholder (ST2, ST34). |
| Q8 | Release 1 may have no plugin with nav entries. Does the Plugins section hide when it is empty? | Drawn: the invented plugin Acme tooling fills it. |
| Q9 | Which remotes own the Pyramid connector, AI and audit screens (P16 M-31)? This decides their sidebar groups. | Not drawn |
| Q10 | What is the title pattern for routes outside `/$plant`: sign-in, the status route, the All pages index, an unknown plant and the station routes? | Drawn: Sign in · NorthMES, System status · Plant A · NorthMES, Page not found · NorthMES, Your plants · NorthMES, Plant D is not open yet · NorthMES, Your company is not open yet · NorthMES, Press 4 · Plant A · NorthMES, Switch operator · Press 4 · Plant A · NorthMES. Under `/admin` ADR 0066 leaves the plant out: Plants · Admin · NorthMES (PL44). |
| Q11 | The reload dialog has a title and an h1, and the route suite allows one h1 per route. Does the dialog use an h2, or does the page become inert while it is open? | Drawn: the page behind is inert, so the dialog h1 is the only one (ST3, ST4, KE10, KE14). |
| Q13 | Page actions sit in the top bar, so New order comes after the crumbs and before main in the tab order. D1 F8 placed it after the filters. Which order holds? | Drawn: the top bar order (KE1). |
| Q14 | Station: does the station frame have a help menu, where does the per-device theme switch sit, and does it show the plant name? | Drawn: a More menu with Help and Theme on this station (SF16, SF17); the plant shows in the top bar (SF1). |
| Q15 | Station: the top bar chip and the Disconnected strip change together on a drop. Which one speaks, so the operator hears one message? | Drawn: only the strip is a live region (role=status); the chip is not, and the station sends nothing to the polite region for the drop (SF5, SF6). |
| Q16 | Station portrait size: pilot IT question IT-22 is due before the station design. | Drawn: 800 by 1280 (SF3, SF6, SF12). |
| Q17 | Sign-in: the copy for a wrong password, the rate limit and a blocked account; the new password step after a temporary password; and where the user lands after sign-in, a new password or a 4401. | Drawn: SI4 to SI18. The landing is not drawn. |
| Q18 | What does the user menu, now at the foot of the sidebar, hold besides the name, the theme switch and Sign out? | Drawn in the footer user menu (PL9, PL13, PL34, PL35, NA16, NA17, KE24, KE31): Profile and Presentation settings, the entries the top bar menu held (C2). GLOSSARY.md makes presentation settings company and plant settings, so that entry needs a route and a permission. |
| Q19 | Does the collapsed or expanded sidebar state persist per browser like the theme, or reset on reload? | Not drawn |
| Q20 | Banners for readiness, the AI budget and a restore: where do they sit, can a user dismiss them, and in which order do they stack? | Drawn: one strip per frame (ST10 to ST13, ST19 to ST22). When the AI budget is used up, the Assistant toggle stays in place, disabled, with a tooltip (ST13, ST22). |
| Q21 | Server restarting: D2 owes the final English copy. | Proposed in KE19 and KE20: NorthMES is restarting. Changes are paused until it is back; you do not need to reload. |
| Q22 | Close code 4403: is the access message a page, a dialog or a banner? | Not drawn |
| Q23 | Does D2 draw the boot state (Loading NorthMES, 2.7), the unsupported browser page (3.10), the HTTPS required page (3.11), the 4401 and 4403 states (3.9), Caddy's maintenance page (3.15) and the All pages index (1.6.3)? None of them is drawn here. | Drawn from spec 0.7 and section 3: route loading (ST23, ST24), a slow remote (ST25, ST26), a failed slot contribution (ST27, ST28), an unknown plant (ST29, ST30), no AI provider (ST31, ST32) and the assistant sheet at 320 (NA9, NA10). |
| Q24 | shadcn Sidebar and Breadcrumb are not in D1's component table. Their current, focus and collapsed states and the rail tooltip on hover (PL16, PL17) are drawn here; is hover on the entries needed too? | Not drawn |
| Q25 | Where do toasts sit, so they stay away from the board and form areas? No frame draws a toast. | Not drawn |
| Q26 | Doc drift: ADR 0019 still shows nav in defineWebModule and the path `/api/web/modules`; the design page follows ADR 0062 and ADR 0064. Plan 09's failed-scan message says user name, while the sign-in page and spec 4.2 say username. | Drawn: Username on the station form; the failed-scan message keeps the doc wording (SF10, SF20). |
| K1 | Switcher menu: focus on the first plant other than the current one, or on the first item, the current plant (the library default)? | Drawn: the first other plant (KE7, KE30). |
| K2 | Does the navigation sheet open with focus on Close navigation, as in the D1 Sheet state, or on the current entry? | Drawn: Close navigation (NA3, KE11). |
| K3 | scroll-padding-top as the sticky block's height plus 8 px, so the 4 px ring clears the strip? | Drawn: KE19, KE20. |
| K4 | Do the banner strips stay sticky at 320 px? Two strips take about a third of the screen. | Drawn: sticky (KE20). |
| K5 | Announce Live updates resumed after a reconnect? | Proposed in the KE23 announcements. |
| K6 | Station idle warning: does Escape count as activity and close it like Stay signed in? | Not drawn: SF7 and SF8 show the open warning. |
| K7 | User menu: does choosing Light or Dark close the menu? | Not drawn. |
| K8 | Reload dialog: spec 3.6 makes it blocking, while spec 7.5 and the D1 Dialog row say Escape closes a dialog. | Drawn: Escape does nothing (KE10). If Escape closes it, the dialog goes, mutations stay refused, and a strip under the top bar offers Reload page. |
| K9 | Core's settings now sit in Administration with the title Settings, beside Planning settings and Pyramid connector settings, so the three titles stay unique. Is Settings the right title for core's page? | Not drawn |
| K10 | Station buttons draw 48 px, above the 44 px of `--nm-target-min-station`, and no D1 token holds 48. Add a station control-height token, or draw them at 44 px? | Drawn: 48 px (SF1, KE21). |
| K11 | Notifications panel: with nothing focusable inside, focus goes to the panel itself, and Tab closes it and moves on to main. Or should the bell keep focus while the panel is open? | Drawn: focus on the panel (KE26). |
| K12 | shadcn Sidebar toggles on Ctrl+B and Cmd+B, which Firefox uses for its bookmarks sidebar. Keep the shortcut off? | Drawn: no shortcut. |
| K13 | When the rail flyout closes, focus returns to the parent icon and its tooltip opens, as on any focus. Or should the tooltip stay closed after a flyout? | Drawn: the tooltip opens (KE29). |
| K14 | At 320, does Open navigation carry an unread marker when the bell has unread notifications? The bell sits in the sheet footer, so nothing shows the count while the sheet is closed. | Not drawn. Proposed in KE23: Enter on the bell in the sheet closes the sheet and opens the panel as a sheet; Escape returns focus to Open navigation. |
| K15 | The pages without a plant have no sidebar. Does their account menu stay at the top bar end, or do they get a sidebar footer with the user button? | Drawn: the account avatar at the top bar end (ST29, ST30, ST38 to ST43). |
| K17 | The admin pages and the link to them read Admin, after the title Plants · Admin · NorthMES in ADR 0066, while the plant's own section stays Administration. Is that pair clear, or should the link read Company admin? | Drawn: Admin (PL32, PL42, PL44, ST38). |
| S1 | New password step: Better Auth's changePassword takes the current password, so E05-S08 needs a server step that keeps the temporary one. | Drawn: no current-password field (SI16 to SI18). |
| S2 | "Use at least 8 characters" is Better Auth's default minimum. The password policy of the regulated profile (plan 15) can change it. | Drawn: SI16 to SI18. |
| S3 | Word for a banned account: blocked, proposed, and the same word on the user list (E05-S08). | Drawn: SI13 to SI15. |
| S4 | Copy for a 4401 close: "Your session ended. Sign in again to continue." in the status box, info tone. | Not drawn; proposed in SI22. |

The page closes these:

| Id | Answer on the page |
|---|---|
| Q1 | Answered by C4: every nav entry has an icon, so the nav contract and the module manifests gain an icon field, recorded in the proposed ADR 0067. KE23 lists the proposed icon of every entry and the fallback icon. |
| Q12 | Answered by the chosen direction: the breadcrumb sits in the top bar, and the h1 stays in main. |
| K16 | Answered by ADR 0066 and ADR 0067: a holder of `core.plant:create`, which core's company admin role holds, creates plants on the admin pages under `/admin`. Plants left the plant's Administration section, and a company admin reaches `/admin` through Admin in the switcher menu, or in the user menu when the switcher is hidden (PL32, PL42). |

M-61 in the proposed ADR 0066, whether core's company admin role holds every installed permission, is open with yes as the working default. The company admin frames (PL32, PL33, PL42 to PL47, NA23, ST36 to ST39) draw the company admin with the plant admin's Administration section.

## What D2 does not draw

- The onboarding wizard at `/$plant/core/onboarding`: it is its own design task, E06-S14. D2 draws only the link Continue onboarding (ST36) and the pages for a plant or a company in onboarding (ST40 to ST43).
- The content of the admin pages under `/admin`: they come from the canonical list and form page (E05-S15). D2 draws the admin frame around them (PL44 to PL47).
- The board grid (D3), the chat panel (E14-S03, [northMES/northmes#136](https://github.com/northMES/northmes/issues/136)) and the station screens (D4) are placeholders that name their owner. The board toolbar comes from option A and is context, not a D3 decision.
- The boot state (Loading NorthMES, spec 2.7), the unsupported browser page (3.10), the HTTPS required page (3.11), the 4401 and 4403 states (3.9), Caddy's maintenance page (3.15) and the All pages index (1.6.3) (Q23, Q22, S4).
- Toasts (Q25), hover on the sidebar entries (Q24) and the landing after sign-in (Q17).
- A permission narrower than admin, such as one that only manages users, which would show only its own Administration entries.
- The notifications panel as a sheet at 320 and an unread marker on Open navigation (K14); the idle warning closed by Escape (K6); the user menu after choosing a theme (K7).
- The Administration pages themselves (Users and the others), which are later design tasks.
