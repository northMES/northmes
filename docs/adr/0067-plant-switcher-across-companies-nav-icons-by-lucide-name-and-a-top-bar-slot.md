---
status: "proposed"
date: 2026-10-07
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: Krister Johansson
informed: contributors, coding agents, module and plugin authors
release: "1"
needs-confirmation: "maintainer (the top bar slot id; top bar items drawn from data)"
---

# Plant switcher across companies, nav icons by lucide name and a top bar slot

## Context and problem statement

Design task D2 (issue northMES/northmes#190) draws the shell: the sidebar with its collapsed rail and 320 px sheet, the top bar with the breadcrumb, and the plant switcher. The variations round of 2026-10-05 put the plant switcher in the first breadcrumb crumb, so that the plant stays visible in every sidebar state. While reviewing D2 the same day, Krister Johansson decided:

1. The plant switcher moves to the top of the sidebar and lists the user's plants grouped by company. It is hidden when the user holds roles in exactly one plant. The first breadcrumb is the plant, as a link, prefixed by the company when the user has plants in more than one company. The user menu moves to the foot of the sidebar, and the control that collapses the sidebar moves to the start of the top bar.
2. Nav entries get icons, so the collapsed rail can show them. The route nav declaration (the `nav` option of `screenRoute`, [ADR 0062][adr-0062]) gains an icon, and the module manifest's `web` block gains a module icon that the shell can show when the module's remote failed to load, because the shell then has no routes to read. The icons are lucide icons.
3. The top bar gets a bell for notifications. The notifications module stays deferred ([ADR 0055][adr-0055]), and the shell shows the bell only when that module is installed, so release 1 ships without it.

No document said whether an icon is a component or a name. Remotes are Module Federation remotes that share React, the router and `@northmes/ui` with the shell, and a remote may not bundle a package that `@northmes/ui` depends on, `lucide-react` among them ([ADR 0019][adr-0019]). The manifest is server data: the host reads it before any browser code runs, and `/api/v1/web/modules` sends its `web` values as JSON ([ADR 0003][adr-0003]).

This ADR decides the shell's navigation contract: the switcher, the plant crumb, the icon on nav entries and manifests, the rail, and where the bell comes from. It covers `apps/web`, `@northmes/web-sdk`, `@northmes/ui`, `@northmes/contracts`, the manifest types in `@northmes/sdk`, the catalog check and the module list entries. The companies and plants the switcher lists come from `GET /api/v1/web/modules` as [ADR 0066][adr-0066] decides. It changes parts of the accepted ADRs 0019, 0037 and 0062, listed under [Parts of accepted ADRs this decision changes](#parts-of-accepted-adrs-this-decision-changes). Those files keep their text, as the [ADR rules](README.md) require.

## Decision drivers

* Krister Johansson's decisions of 2026-10-05, listed above.
* The plant stays visible in every sidebar state, the rail and the 320 px sheet included.
* Labels are plain strings, never React nodes, so a later command palette and translation can read nav data ([06 web and UX](../plan/06-web-and-ux.md#rules-the-shell-and-ci-enforce)).
* The manifest is read before any browser code runs and travels as JSON.
* A remote reaches `lucide-react` only through `@northmes/ui`, because the forbidden-bundle list derives from the dependencies of `@northmes/ui` ([ADR 0019][adr-0019]).
* The shell bundle stays small. Lucide's guide warns that a generic component importing every icon grows the bundle, and that loading icons by name at run time adds build time and network requests.
* The rail meets WCAG 2.2 AA: every icon-only link has an accessible name (1.1.1, 4.1.2), its tooltip can be hovered and dismissed (1.4.13), and targets meet 2.5.8 ([ADR 0021][adr-0021]).
* The scope rule: a platform piece is built when a release needs it ([ADR 0055][adr-0055]).

## Considered options

For the icon value:

* A lucide-react component name from a list in `@northmes/contracts`, rendered by `@northmes/ui`
* A React component on the route's `nav` option, and a name only in the manifest
* A kebab-case lucide name rendered through Lucide's `DynamicIcon`
* Any lucide-react component name, rendered from Lucide's full `icons` map

The placement of the switcher, the crumb and the source of the bell follow Krister Johansson's decisions; the details left out are under [Smaller choices](#smaller-choices).

## Decision outcome

Chosen option: "A lucide-react component name from a list in `@northmes/contracts`, rendered by `@northmes/ui`", because one plain string serves the route declaration, the manifest and the JSON module list, a remote imports no icon for its nav, and the shell bundles only the listed icons.

### The plant switcher and the plant crumb

* The plant switcher is the first item of the sidebar, above the module groups, in the expanded sidebar, the rail and the 320 px sheet. It stays a menu of links (WCAG 3.2.2) that the shell owns.
* It lists the plants of `companies` from `/api/v1/web/modules` in the server's order ([ADR 0066][adr-0066]). When the plants span more than one company, each company is a labelled group of its plants; with one company the menu has no group labels. The link to the current plant carries `aria-current="page"`. A plant in onboarding, which the list holds only for a holder of `core.onboarding:manage`, carries "Onboarding" in its link text, so its accessible name reads, for example, "Plant D, Onboarding".
* The shell hides the switcher when `companies` lists fewer than two plants. This is how this ADR applies decision 1: it counts the plants the user can open, so a plant in onboarding that [ADR 0066][adr-0066] leaves out of `companies` does not count, and a role at a company counts each plant of that company. A user whose `admin` is true reaches company settings at `/settings/$companyId` through the Settings button in the top bar and the link at the foot of the plant settings navigation, and company settings pages link back to the plant the user came from ([ADR 0066][adr-0066]). The settings spec page of design task #313 places these links in place of the Admin entries that D2 drew in the switcher and user menus.
* A plant link follows the rules [ADR 0062][adr-0062] set: it keeps the current route and its search when `$plant` is the route's only path param, it goes to the nearest ancestor route without entity params otherwise, and a different module set means one full navigation. A plant of another company follows the same rules. From company settings, a plant link is a full navigation to the plant route.
* The breadcrumb starts with the plant crumb: the plant name as a link to `/$plant`. When the user's plants span more than one company, a company crumb, the company name without a link, comes before it. `useBreadcrumbs()` returns these crumbs ahead of the route crumbs, and `PageFrame` renders them, so the plant stays visible in every sidebar state. On company settings pages neither crumb is shown, and the trail starts with Settings and the company ("Settings > Acme AB > Users"); on plant settings pages a Settings crumb follows the plant crumb.
* The document title keeps its pattern, "Planning board · Plant A · NorthMES" ([ADR 0021][adr-0021]).

### Icons on nav entries and manifests

* `@northmes/contracts` exports `navIconNames`, a read-only list of lucide-react component names such as `"CalendarRange"`, and the type `NavIconName`. It is pure data and imports no React. The D1 build notes already name icons by their lucide-react component names ([ui-189-tokens.md](../design/ui/ui-189-tokens.md#fonts-and-icons)).
* `@northmes/ui` exports `NavIcon({ name })`. It maps each listed name to its `lucide-react` component, renders it at the default 16 px size with `aria-hidden="true"`, and renders a fallback icon for a name it does not know.
* The `nav` option of `screenRoute` becomes `{ label, icon, order?, parent?, search? }`. `icon` is a `NavIconName`, required on an entry without `parent` and optional on a nested entry. The shell copies it into the module's nav entries together with the label.
* The manifest's `web` block gains `icon`, a `NavIconName`, required like `order`. The catalog check (boot step 4) refuses a `web` block without one, because the host does not type-check a plugin's manifest. `/api/v1/web/modules` adds `modules[].icon` next to `label` and `order`.
* At run time the shell renders an unknown name with the fallback icon and still loads the module, so a plugin built against a newer list keeps working. The type catches a misspelt name at build time.
* Adding a name changes `navIconNames` and the `NavIcon` map in one pull request. Both packages ship in every lockstep release, so a module can use any name of the release it targets. D2 picks the release 1 names and the fallback icon.

### The collapsed rail

* The rail keeps the sidebar's order (WCAG 3.2.3): the switcher first, then one icon per top-level nav entry, grouped by module in manifest order.
* Each rail item is a link whose accessible name is the entry's label. A tooltip shows the label on hover and on focus, stays while the pointer is over it and closes on Escape. The icon is decorative. Every target meets `--nm-target-min`.
* A module that failed to load shows its manifest icon at its usual position, with "(unavailable)" after the label in its accessible name.
* D2 decides how the rail reaches nested entries.

### A top bar slot for the bell

* The bell is a contribution of the notifications module to a top bar slot. With no contribution the slot renders nothing and takes no space, so an installation without the notifications module shows no bell. This ADR does not design the notifications module.
* The slot id is `core/top-bar/items/v1` (proposed), and its slot kind is `item` ([ADR 0068][adr-0068]). The shell renders it. The id carries `core` because the shell is not a module and every module depends on core, so the catalog rule that a contributor depends on the slot's owner holds without a special case ([ADR 0037][adr-0037]). Its props are `{ plantId: string | null }`, with `null` on company settings pages.
* The shell renders the slot at the end of the top bar, after the help menu, where the user menu sat before it moved to the foot of the sidebar. Contributions sort by `order` and filter on their permission, as in every slot. The help menu keeps its place with or without items (WCAG 3.2.6). Where the sidebar is the navigation sheet, as at 320 px, the shell draws each item in the sheet's footer after the help menu, as D2 draws the bell (NA3, NA4), and the item opens its content in a sheet.
* A contribution supplies an icon name, a badge hook and a content component, and the shell draws one compact control from that data: an icon button named "{label}, {badge text}", or by its required `label` alone when the badge hook returns nothing, which opens a popover with the content. The shell does not wrap it in `WidgetFrame`, because a top bar item is not a page section. Each contribution still renders in its own error boundary and reports stage `slot` when it fails; D2 draws the fallback.
* Release 1 builds neither the slot nor the bell: the slot is built with its first contributor, the notifications module. D2 draws the top bar with and without the bell, so the layout holds the bell's place from the start. D2 does not draw the item's content opened from the sheet's footer; the task that builds the slot draws it ([ADR 0068][adr-0068]).

### Parts of accepted ADRs this decision changes

The files below keep their text. Once this ADR is accepted, it holds over the parts listed here, and the rest of each ADR stands.

#### Changes to ADR 0062

[ADR 0062][adr-0062], web form contracts, URL view state and module link manifests:

| Section | Before | After |
|---|---|---|
| Module link manifests (nav) | "`nav` on `screenRoute` takes `{ label, order?, parent?, search? }` or a list of them" | `nav` takes `{ label, icon, order?, parent?, search? }` or a list of them; `icon` is a `NavIconName`, required on an entry without `parent` |
| Module link manifests (sidebar) | "Each module is one sidebar group, headed by its manifest `web.label`, at its manifest order." and "`/api/web/modules` adds `modules[].kind`" | The module list also adds `modules[].icon` from the manifest's `web.icon`. The collapsed rail shows each top-level entry's icon, and a module that failed to load shows its manifest icon with "(unavailable)" in its accessible name |
| Module link manifests (breadcrumbs) | "`useBreadcrumbs()` in `@northmes/web-sdk` returns `{ label, href }` for each route match whose route has a title." | `useBreadcrumbs()` returns the company crumb, when the user's plants span more than one company, and the plant crumb first, then one crumb for each route match whose route has a title |
| Confirmation | `use-breadcrumbs.test.tsx`: "a detail route yields module, list and entity crumbs" | "a detail route yields plant, module, list and entity crumbs" |

#### Changes to ADR 0019

[ADR 0019][adr-0019], web shell:

| Section | Before | After |
|---|---|---|
| Shell and boot | "A module that fails gets a placeholder route and an "(unavailable)" menu entry at its usual position" | Unchanged, and in the collapsed rail the entry shows the module's manifest icon |

#### Changes to ADR 0037

[ADR 0037][adr-0037], plugins, UI slots:

| Section | Before | After |
|---|---|---|
| UI slots | "Cross-module UI goes only through slots that the rendering module owns." and "Slot ids are typed and versioned: owner id first" | Unchanged for module slots. A slot that the shell renders carries the owner id `core`, which the dependency rule then checks; the first is `core/top-bar/items/v1` |
| UI slots | "`<Slot>` renders each contribution in `WidgetFrame` as a section with `aria-labelledby`, inside its own error boundary." | Unchanged, except in `core/top-bar/items/v1`, a slot of the kind `item` ([ADR 0068][adr-0068]), whose contributions the shell draws from data as compact controls without `WidgetFrame`, each inside its own error boundary |

### Consequences

* Good, because one string type names an icon in routes, manifests and the JSON module list, and nav data stays plain.
* Good, because the shell bundles only the listed icons, and a remote imports no icon for its nav.
* Good, because a module that failed to load keeps its icon and its position in the rail.
* Good, because the plant stays visible in the first crumb in every sidebar state.
* Good, because the bell needs no shell change when the notifications module arrives, and an installation without the module shows nothing.
* Bad, because a module or plugin can pick only icons from the list, and a new icon waits for a NorthMES release.
* Bad, because every top-level nav entry and every manifest with a `web` block needs an icon.
* Bad, because the switcher and the plant crumb both show the plant name on a wide screen.
* Bad, because the top bar slot renders its contributions differently from every other slot.
* Neutral, because the slot id carries `core` although the shell renders it.

### Confirmation

* `packages/contracts/test/nav-icon-names.test.ts`: "every name is PascalCase and appears once".
* `packages/ui/test/nav-icon.test.tsx`: "every name in navIconNames renders an svg with aria-hidden"; "an unknown name renders the fallback icon"; "the map's keys equal navIconNames".
* `packages/web-sdk/test/screen-route-nav.test-d.ts` in the `types` project: `@ts-expect-error` on a top-level nav entry without `icon` and on `icon: "NotAnIcon"`; a nested entry without `icon` passes.
* `packages/sdk/test/define-module.test-d.ts` in the `types` project: `@ts-expect-error` on a `web` block without `icon`.
* `apps/server/test/catalog.test.ts` gains: "a web block without icon exits 1 naming the module".
* `apps/server/test/rest/web-modules.int.test.ts` gains: "each module entry carries the icon from its manifest".
* `apps/web/test/sidebar.test.tsx` gains: "the switcher is the first item of the sidebar"; "the collapsed rail shows one icon per top-level entry in sidebar order, each named by its label"; "a module whose remote failed shows its manifest icon in the rail, named with (unavailable)".
* `apps/web/test/plant-switcher.test.tsx`: "plants of two companies render under two group labels"; "plants of one company render without group labels"; "with one plant the switcher is not rendered"; "the link to the current plant carries aria-current"; "a plant in onboarding carries Onboarding in its link text".
* `packages/web-sdk/test/use-breadcrumbs.test.tsx`: "a detail route yields plant, module, list and entity crumbs, and the plant crumb links to /plant-a"; "with plants in two companies a company crumb without a link comes first".
* `e2e/a11y/shell.spec.ts` gains: "in the collapsed rail every link has an accessible name and its tooltip shows on focus".
* With the top bar slot, which arrives with the notifications module, `apps/web/test/top-bar-slot.test.tsx`: "with no contribution the top bar holds no slot item"; "a contribution renders after the help menu, named by its label"; "a throwing contribution leaves the top bar working and reports stage slot"; "the button's name carries the label and the badge text"; "in the navigation sheet the item is a button in the footer after the help menu, named by its label and badge text".

## Pros and cons of the options

### A name from a list in @northmes/contracts, rendered by @northmes/ui

* Good, because routes, manifests and the module list carry the same plain string.
* Good, because the shell bundles only the listed icons.
* Good, because it uses the names the D1 build notes already use.
* Bad, because the list and the `NavIcon` map are one more pair to keep in step, which a unit test does.

### A component on the nav option, a name in the manifest

* Good, because a module can use any icon `@northmes/ui` exports, without a list.
* Bad, because a module states its icon in two forms, and nav data stops being plain.
* Bad, because the rail would render some entries from components and some from names.

### Kebab-case names through DynamicIcon

* Good, because every lucide icon is available without a list.
* Bad, because each icon loads on first render, so the rail fills in after the page, and Lucide's guide warns about build time and network requests.
* Bad, because the kebab-case names differ from the component names the D1 build notes use.

### Any component name through Lucide's full icons map

* Good, because every icon is available and renders at once.
* Bad, because the whole icon set enters the shell bundle, which Lucide's guide advises against.

### Smaller choices

| Question | Chosen | Left out | Reason |
|---|---|---|---|
| The switcher for a user with fewer than two plants in `companies` | hidden | shown with one entry; the plant name as plain text | Krister Johansson's decision covers one plant; a plant the user cannot open is not in `companies`, and with no plant the menu has nothing to list |
| Company group labels in the switcher | only when the plants span more than one company | always | with one company a label adds nothing |
| The company in the breadcrumb | its own crumb without a link | part of the plant crumb's label | no company page exists under a plant route, and the plant crumb's name stays the plant's name |
| Where an icon is required | on nav entries without `parent`, and on every manifest `web` block | on every nav entry; nowhere | the rail shows top-level entries, and a failed module needs its own icon |
| An unknown icon name at run time | the fallback icon | boot refuses the module | an icon is cosmetic, and [ADR 0037][adr-0037] already lets a web-only plugin degrade instead of stopping boot |
| The source of the bell | a contribution to a top bar slot | the shell renders a bell when the module list holds the notifications module; a top bar member in `defineWebModule` | the shell would hold the module's code and queries against the dependency direction, and slots already carry the label, order, permission and failure isolation |
| When the top bar slot is built | with its first contributor | in release 1, empty | the scope rule of [ADR 0055][adr-0055] |

## More information

* Related ADRs: [0068][adr-0068] the `item` slot kind that the top bar slot uses (M-64), [0003][adr-0003] the manifest's `web` block, [0019][adr-0019] shell, remotes and the forbidden-bundle list, [0020][adr-0020] icons from `lucide-react` through `@northmes/ui`, [0021][adr-0021] accessibility, [0037][adr-0037] slots, [0055][adr-0055] notifications deferred and the scope rule, [0062][adr-0062] nav entries from routes and breadcrumbs, [0066][adr-0066] the `companies` and `admin` fields and the settings area.
* Proposed ADRs to update before they are accepted: [0003][adr-0003] (`web.icon`, required next to `order`).
* Design: D2 (issue northMES/northmes#190) draws the switcher at the top of the sidebar grouped by company, the company and plant crumbs, the rail with icons, the admin frame, the plant list at `/`, and the top bar with and without the bell. The settings area of design task #313 replaces the admin frame ([record](../design/shell/shell-313-settings-variations.md)). The icon set is in [ui-189-tokens.md](../design/ui/ui-189-tokens.md#fonts-and-icons).
* Plan: [06 web and UX](../plan/06-web-and-ux.md#shell-layout) (shell layout, plant switch, routes and typed links, the module list, design tokens), [14 roadmap](../plan/14-roadmap.md) (E04-S02 and E04-S04).
* Lucide's notes on loading icons by name: https://lucide.dev/guide/react/advanced/dynamic-icon-component.
* Revisit when modules often need icons outside the list, when the notifications module is shaped, or when the command palette arrives.

[adr-0003]: 0003-module-package-shape-and-the-definemodule-manifest.md
[adr-0019]: 0019-web-shell-with-react-module-federation-remotes.md
[adr-0020]: 0020-frontend-libraries-tanstack-router-apollo-client-4-shadcn-ui-and-forms.md
[adr-0021]: 0021-accessibility-target-wcag-2-2-aa.md
[adr-0037]: 0037-plugins-drop-in-packages-command-validators-and-ui-slots.md
[adr-0055]: 0055-release-1-scope-under-option-b-and-the-scope-rule.md
[adr-0062]: 0062-web-form-contracts-url-view-state-and-module-link-manifests.md
[adr-0066]: 0066-companies-created-by-the-cli-plant-slugs-unique-per-installation-company-settings-at-settings-and-an-onboarding-wizard-before-a-plant-opens.md
[adr-0068]: 0068-extension-points-declared-by-their-owners-contributions-as-manifest-data-with-code-by-id-and-a-plugin-inventory.md
