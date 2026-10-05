---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: internal research notes 05, 17, 19, 21, 29, 32, 33
informed: NorthMES contributors
release: "1"
needs-confirmation: "product owner (is pause live updates wanted)"
---

# Accessibility target WCAG 2.2 AA

## Context and problem statement

Krister Johansson decided that the NorthMES web app targets WCAG 2.2 level AA. The app is a shell that loads remotes from several modules and plugins at run time ([ADR 0019][adr-0019]), so no single screen author can guarantee the result: titles, focus, live regions and navigation must belong to the shell, and every remote must pass the same automated gates. WCAG conformance covers full pages and cannot exclude parts, so a plugin's slot content is part of the page it appears on.

The planning board is the hard case. It moves blocks by dragging (2.5.7), shows dense blocks narrower than a usable target (2.5.8), updates in real time (2.2.2, 4.1.3) and uses color for orders and states (1.4.1, 1.4.3, 1.4.11). Automation catches little of WCAG 2.2: of the six criteria new at A and AA, axe-core 4.13.0 covers only 2.5.8 (its `target-size` rule, tagged `wcag22aa`). This ADR fixes the target, the shell services, the board accessibility model and the gates. It covers the shell, every remote, the board, the operator station, `@northmes/ui` and `@northmes/web-sdk`.

## Decision drivers

* The decided target: WCAG 2.2 AA.
* Customers are employers that may need the MES to work with an employee's assistive technology, and public-sector buyers reference EN 301 549, whose V4.1.1 points at WCAG 2.2.
* Full-page conformance: plugin content in a slot counts.
* Route titles must be enforced at run time, because remotes return code-based routes and no route generator exists.
* Live regions and focus services must be DOM singletons that work across remotes and while a modal is open.
* The board must offer moves without dragging in the same increment as dragging.

## Considered options

* WCAG 2.1 AA, the level EN 301 549 V3.2.1 references.
* WCAG 2.2 AA checked through a review checklist and a manual audit before release.
* WCAG 2.2 AA plus EN 301 549 V4.1.1 clauses 9.7 and 12.3, with shell-owned services, a board accessibility model and CI gates per route and state.

## Decision outcome

Chosen option: "WCAG 2.2 AA plus EN 301 549 V4.1.1 clauses 9.7 and 12.3, with shell-owned services, a board model and CI gates", because it meets the decided target, covers the web clauses public tenders ask for, and makes every remote and plugin fail a pull request instead of an audit.

Scope: the shell, every remote, the board and the station. Plugins must pass the same suite; the conformance statement covers core modules only. The docs site gets an "Accessibility" page (target, tested browser and screen reader pairs, board keyboard commands, how to pause live updates, known issues, how to report a problem), which clause 12.3 asks for.

Shell services:

* `<html lang="en">`, landmarks, a "Skip to main content" link as the first focusable element, one help menu at a fixed place, a stable sidebar order from manifest `order`, and an "All pages" index built from route titles.
* Page titles in the form "Planning board · Plant A · NorthMES". `screenRoute` requires a title and stores it in `staticData`. `PageFrame` renders the `h1` (`tabindex="-1"`) from that title outside every data Suspense. On a path change `focusPageHeading` waits one frame, focuses the `h1` and falls back to `main`; search parameter changes do not move focus. Placeholder routes, the error component and the reload prompt have a title and an `h1`.
* Two live regions, polite and assertive, sit in `index.html` outside `#root` with explicit `aria-live` and `aria-atomic`. `announce()` writes through a short queue that clears and then sets the text, so a repeated message is read again. `notify()` goes to sonner only, never also to `announce()`. Toasts only echo what is visible elsewhere.
* Translatable master data text carries `lang` from the company's data-language setting ([ADR 0053][adr-0053]).

Board model (details in [07-production-planning.md](../plan/07-production-planning.md)):

* Moving without dragging ships with dragging: the detail panel with machine and start fields, and the block menu's Move dialog, which lists every allowed machine. Click-to-place is a cut candidate, because these two already meet 2.5.7.
* The board is an ARIA grid with roving `tabindex`; the range extractor keeps the focused row and the move preview's row mounted. Keyboard move mode (`M`) keeps focus on the moving block with polite step messages; Up and Down skip collapsed groups; range extension follows the preview; after a commit, focus returns to the block by id; the commit message uses the times the server returns.
* One Escape stack: hover card, popover, move mode, docked panel; each Escape closes one layer, and modal dialogs sit on top. The hover card opens on focus too, and every hover field is also in the detail panel.
* Blocks are at least 24 px tall. Blocks narrower than 24 px merge into cluster targets whose names include state counts ("4 jobs, 07:00 to 09:10, 2 late, 1 being edited by Alex Lund").
* Each block's accessible name is built through `aria-labelledby` from visible spans that carry `lang` plus visually hidden spans for times and states. No state maps to a hue; the fill is always the order color, and states use icons and line styles in the text color.
* "Pause live updates" stays inside planning. While paused, the board and the job order table view render from a frozen block model taken at pause time; the planner's own draft operations and autoplan results apply by id; a counter reads "12 changes waiting"; Resume rebuilds the model and refetches. The `planning/board/side/v1` slot props carry `paused`. A broken lock (assertive) or a draft conflict still announces while paused. Autoplan status arrives as polite messages backed by a visible status line. Whether the product owner wants pause at all is open; until the answer arrives it is built as described.

Manual checks: one NVDA pass on the planner-class Windows PC on the board core, and one before the pilot install.

### Consequences

* Good, because the target covers the web clauses of both EN 301 549 V3.2.1 and V4.1.1 for public tenders, and employers can offer the app to staff who use assistive technology.
* Good, because shell services and route-level gates hold every remote and plugin to one bar without per-screen review.
* Good, because the board's move paths and cluster targets meet 2.5.7 and 2.5.8 without relying on the Essential exception.
* Bad, because internal research note 21 estimated about 25 developer days of accessibility work in release 1, 3 to 5 of which overlap board and station work, plus about 2 days per minor release for manual passes.
* Bad, because the board's feel under a screen reader needs a person with NVDA on Windows; agents cannot judge it.
* Bad, because the pause model adds a frozen block model to the board, which the product owner may not want.
* Neutral, because the European Accessibility Act does not cover an MES sold to manufacturers for their staff (internal research note 21, not legal advice), so the target rests on the decision, employer duties and tenders.

### Confirmation

| Gate | Fails on |
|---|---|
| Biome a11y rules, recommended set at error, in every web package | static JSX violations; `noAutofocus` stays on, and the station badge field uses a ref |
| Component a11y tests in a Vitest browser-mode project (happy-dom cannot run axe's contrast rule) | axe violations in `packages/ui`, kit routes and board fixtures |
| Token contrast test in `packages/ui` ([ADR 0020][adr-0020]) | a token pair below 4.5:1 (text) or 3:1 (non-text) in light or dark |
| Per-remote route harness | a leaf route from `module.routes(plantRoute)` without a title |
| Playwright route suite, enumerating `router.routesById` at run time with the example plugins enabled | axe violations, a missing or duplicate title, not exactly one `h1`, a first Tab that does not reach the skip link |
| axe per route and state with tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa` | violations; `incomplete` results are reported, not failed |
| `ci / a11y`, a separate required job from the first board pull request | `e2e/a11y/board.axe.spec.ts` over the populated, locked block, move mode and paused states |
| Keyboard-only flows without `page.mouse` | planner move and Save, single-pointer move with no `mouse.down` followed by `mouse.move`, table view Move, break lock, station sign-in and errors, focus not obscured |
| Media runs and reflow | forced colors, reduced motion and dark scheme; at 320 by 640, horizontal scroll outside the board and table containers |
| CI grep | `forced-color-adjust: none` outside the swatch components |

Named tests from the stress test:

* Route titles: from the board, following the sidebar link to Integrations while its GraphQL response is held for 2 s focuses the `h1` "Integrations" and sets the title "Integrations · Plant A · NorthMES"; with the inventory remote missing, the title reads "Inventory unavailable · Plant A · NorthMES" and the page has exactly one focused `h1`.
* Live regions: with a modal open, `announce('X')` reaches the polite region; two calls in one tick arrive in order; `notify('Saved')` reaches exactly one live region.
* Pause: with two contexts on one plant, A pauses and B moves block X; opening another block of the same order in A does not move X and the counter reads "1 change waiting"; after Resume, X moves; B breaks A's lock while A is paused, and A's assertive region announces it.
* Move mode: focus a block, press M, move down past a collapsed group and right 8 times past the loaded range, press Enter; the moved block is focused, its box lies inside the scroller's box, and the spoken text matches the server's start. With a hover card open in move mode, the first Escape closes the card and the second cancels the move.
* Block names: the article span inside a block has its `lang` and is part of the computed name; a cluster of 4 narrow blocks, one late and one held by another planner, has a name containing "1 late, 1 being edited by"; the block fill equals the order color for every status.

An axe exclusion needs a linked issue and an expiry date.

## Pros and cons of the options

### WCAG 2.1 AA

* Good, because EN 301 549 V3.2.1 references it, and AccessibleEU wrote on 2026-09-07 that V3.2.1 stays the cited version until the Commission cites V4.1.1 in the Official Journal.
* Bad, because it lacks 2.5.7, 2.5.8 and 3.3.8, which matter most for the board and the station, and it is behind the decided target.

### WCAG 2.2 AA through review and a manual audit

* Good, because it costs less up front.
* Bad, because remotes and plugins from many authors would regress between audits, and the board's keyboard and pointer paths need tests, not a checklist.

### WCAG 2.2 AA with shell services, a board model and CI gates

* Good, because each failure surfaces in the pull request that causes it.
* Bad, because it needs a Vitest browser-mode project, a required CI job and manual NVDA passes.

## More information

* Related ADRs: [0018][adr-0018] (reconnect status in the live region), [0019][adr-0019] (shell and remotes), [0020][adr-0020] (tokens, Base UI, sonner), [0029][adr-0029] (soft lock expiry warning), [0030][adr-0030] (the board and the job order table view), [0033][adr-0033] (station targets and idle warning), [0035][adr-0035] (AI chat panel), [0041][adr-0041] (test projects), [0053][adr-0053] (language).
* Plan: [06-web-and-ux.md](../plan/06-web-and-ux.md) (criteria by area and the gate table), [07-production-planning.md](../plan/07-production-planning.md) (board accessibility), [09-operator-station.md](../plan/09-operator-station.md), [11-quality-and-testing.md](../plan/11-quality-and-testing.md).
* WCAG 2.2: https://www.w3.org/TR/WCAG22/
* Waits: Guidepup screen reader automation, a VPAT-based conformance report until a customer or tender asks for one, AAA criteria.
* Revisit when the product owner answers whether pause is wanted, when the Commission cites EN 301 549 V4.1.1 in the Official Journal, and when the first tender asks for a conformance report.

[adr-0018]: 0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md
[adr-0019]: 0019-web-shell-with-react-module-federation-remotes.md
[adr-0020]: 0020-frontend-libraries-tanstack-router-apollo-client-4-shadcn-ui-and-forms.md
[adr-0029]: 0029-per-planner-drafts-soft-locks-and-the-plan-revision.md
[adr-0030]: 0030-a-planning-board-built-in-house.md
[adr-0033]: 0033-online-operator-station-in-the-production-start-module.md
[adr-0035]: 0035-ai-provider-port-with-customer-configured-providers.md
[adr-0041]: 0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md
[adr-0053]: 0053-translation-english-first-general-translation-later.md
