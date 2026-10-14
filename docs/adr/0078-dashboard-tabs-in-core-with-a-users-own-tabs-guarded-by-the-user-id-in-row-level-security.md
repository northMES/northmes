---
status: "proposed"
date: 2026-10-14
decision-makers: proposed by the dashboard build session, to be confirmed by Krister Johansson
consulted: Krister Johansson (option A of the dashboard round, and building on these defaults, 2026-10-14)
informed: contributors, coding agents
release: "1"
needs-confirmation: "maintainer (northmes.user_id as a third transaction setting; a user's own tabs at the company node, so they follow the user across the plants of one company; reading the dashboard with no permission beyond opening the plant; core.dashboardTab:manage for shared tabs outside companyPermissions; the layout as one jsonb column per tab; the command bus skipping the permission for a row its target names as the principal's own; the layout sent as a JSON string until inputFromZod)"
---

# Dashboard tabs in core, with a user's own tabs guarded by the user id in row-level security

## Context and problem statement

The dashboard is the page a signed-in user lands on at a plant ([#454](https://github.com/northMES/northmes/issues/454)). Krister Johansson chose option A of the variations round on 2026-10-10: tabs of widgets on a grid, with shared tabs at the company and at the plant and each user's own tabs (`docs/design/shell/shell-454-dashboard-variations.md`). On 2026-10-14 he asked to build it on the defaults the round proposed, before the spec page is approved.

Every table so far belongs to a scope node, and row-level security limits a transaction to the read and write scopes of its principal ([ADR 0008](0008-row-level-security-with-transaction-local-scopes.md)). A user's own tab is different: it belongs to one person. Scopes alone would let every user at the company read every other user's own tabs, and only the application's filter would stop it.

This ADR decides which module owns the dashboard's tabs, where a tab is stored, and how the database keeps one user's own tabs from every other user. It covers core's table `core.dashboard_tab`, the backend's ScopedDatabase and the fixture writer of `@northmes/testing`.

## Decision drivers

* Fail closed, as ADR 0008 asks: a transaction without a user reads no own tab.
* In-process plugins share `nm_app`, so the database, not a filter in core, decides who reads an own tab.
* A viewer, whose write scopes are empty, still keeps tabs of their own.
* The maintainer's answers of 2026-10-10: shared tabs at the company and at the plant, own tabs that follow the user, four demo widget types, and an edit session saved as one command.
* The record's layout: `{ columns: 12, widgets: [{ id, type, size, x, y, settings }] }` per tab, with the sizes each widget type allows.

## Considered options

* A third transaction setting, `northmes.user_id`, and policies on `core.dashboard_tab` that read it
* Own tabs in a table without row-level security, filtered by the user id in core's service
* Own tabs at a scope node of their own per user

## Decision outcome

Chosen option: "A third transaction setting, `northmes.user_id`, and policies on `core.dashboard_tab` that read it", because it keeps the database as the guard for rows that belong to a person, with the same fail-closed shape as the scope settings.

* Core owns the dashboard. Its web module draws the page at the plant root, `/$plant`, which is the plant's landing page ([ADR 0074](0074-core-pages-at-the-plant-root-and-the-company-settings-root.md)), and its sidebar group gets a Dashboard entry.
* `core.dashboard_tab` holds every tab: its scope node, its company, an optional owner, a name, a position and the layout as one `jsonb` array of widgets. A shared tab has no owner and sits at the company or at a plant. An own tab has an owner and sits at the owner's company, so it shows at every plant of that company.
* The ScopedDatabase sets `northmes.user_id` beside the scope sets in the same statement, from the principal's user id, or to the empty string without a principal. The setting is transaction-local, as the scope sets are.
* The policies of `core.dashboard_tab`:
  * select: the row's scope is in the read scopes, and the row has no owner or its owner is `northmes.user_id`;
  * insert, update and delete: a row without an owner whose scope is in the write scopes, or a row whose owner is `northmes.user_id` and whose scope is in the read scopes.
* Reading the dashboard needs no permission beyond opening the plant, as `coreViewer` needs none. Changing a shared tab needs `core.dashboardTab:manage` at the tab's scope; it stays out of `companyPermissions`, so Company admin and Plant admin both hold it. Changing an own tab needs no permission beyond being its owner. Each tab the API answers says whether the user may change it (`canEdit`), so the web shows Edit layout only there.
* One edit session, from Edit layout to Done, is one command, `core.saveDashboardTab`, with the tab's id, the version the session started from and the whole layout. The command bus checks `core.dashboardTab:manage` as for any command, except on a row that is the principal's own: a command target may name the owner of a row (`ownerOf` in the SDK's `CommandTarget`), and when that owner is the principal's user id the bus loads the row and skips the permission check. The waiver rests on the policies above, since a row that is another user's own never loads, and the version check still runs on the own row.
* A widget's layout is validated by a Zod schema in core when it is read and written. The widget types are List, Table, Value and Chart, the sizes are Small, Medium, Large, Tall and Wide, and each type allows the sizes of the record. A saved layout holds at most 40 widgets, each id once and no two widgets over one cell.
* A generated mutation input carries no list of objects yet, so the command's `layout` field is the layout as a JSON string of at most 32,000 characters, which the contract parses and then validates with the layout schema. It becomes a list of objects when inputFromZod arrives (ADR 0017, E05-S01).

### Consequences

* Good, because a forgotten filter, in core or in a plugin, still never shows one user's own tab to another.
* Good, because a viewer keeps own tabs: an own tab is checked against the read scopes, not the write scopes.
* Good, because the setting is ready for other rows that belong to one person, such as saved views.
* Neutral, because the widget layout is a `jsonb` column, so a widget is not a row and two people editing one tab replace each other's whole layout; the version check on Done handles that (question 16 of the round).
* Bad, because the policies of this table differ from the template's four, so the table needs its own policy tests.
* Bad, because a support task that runs without a principal sees no own tab, the same as it sees no scoped row.

### Confirmation

* `apps/backend/test/modules/core/dashboard-tab-policies.int.test.ts`: as `nm_app`, a transaction reads its user's own tabs and the shared tabs of its scopes, and reads no other user's own tab and no own tab without a user; it may not write an own tab of another user or a shared tab outside its write scopes.
* `apps/backend/test/modules/core/dashboard.int.test.ts`: `coreDashboardTabs` answers the company's tabs, the plant's tabs and the user's own tabs in that order, and no tab of a sibling plant or of another user.
* `apps/backend/test/modules/core/dashboard-save.int.test.ts`: `coreSaveDashboardTab` saves a user's own tab without a permission, refuses a shared tab without `core.dashboardTab:manage` at its scope, refuses a stale version and an overlapping layout, and finds no other user's own tab.
* `apps/backend/test/command-bus.test.ts`: the bus skips the permission only for a row the target names as the principal's own, and still checks the version there.

## Pros and cons of the options

### A third transaction setting and policies that read it

* Good, because the database guards own tabs as it guards scoped rows.
* Good, because the setting follows ADR 0008's transaction-local shape and needs no session state.
* Bad, because one more setting has to be set by every transaction helper, the fixture writer included.

### Own tabs filtered by the user id in core's service

* Good, because nothing changes in the transaction helper.
* Bad, because a plugin that reads the table as `nm_app` reads every user's own tabs.

### Own tabs at a scope node per user

* Good, because the existing policies apply unchanged.
* Bad, because a scope node per user changes the scope tree of ADR 0007, its spans and every walk over it, for one table.

## More information

* The design record `docs/design/shell/shell-454-dashboard-variations.md` and its open questions; this ADR answers questions 2, 3, 4 and 6 provisionally.
* [ADR 0007](0007-tenancy-company-plants-and-the-scope-tree.md), [ADR 0008](0008-row-level-security-with-transaction-local-scopes.md), [ADR 0010](0010-identity-with-better-auth-roles-and-permissions-in-core-tables.md), [ADR 0068](0068-extension-points-declared-by-their-owners-contributions-as-manifest-data-with-code-by-id-and-a-plugin-inventory.md) for widgets as contributions later.
* Revisit when widgets from modules and plugins arrive as contributions, or when another table needs rows that belong to one person.
