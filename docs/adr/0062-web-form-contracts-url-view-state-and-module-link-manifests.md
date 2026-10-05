---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: Krister Johansson
informed: contributors, plugin authors and coding agents
release: "1"
needs-confirmation: ""
---

# Web form contracts, URL view state and module link manifests

## Context and problem statement

The plan covers the server half of forms, URL state and links. Each command has one Zod schema that the pipeline parses and that GraphQL inputs are built from ([ADR 0017][adr-0017]). List state lives in the URL through `useListState` ([ADR 0016][adr-0016]). Inside a remote, links are typed through the module's `register.ts` ([ADR 0020][adr-0020]). The web side has gaps that each remote would otherwise fill on its own:

* Forms. No document said which schema a command form validates. In Zod 4.5.4, `.pick()`, `.omit()` and `.partial()` throw on an object schema that contains refinements, so an update form cannot strip `id` and `expectedVersion` from a refined input, and the likely result is a second hand-written form schema. A rule that needs stored data had no path to a field, because a `DomainError` carried no field path. The forbidden-bundle list of [ADR 0019][adr-0019] derives from `@northmes/ui`'s dependencies, which include `@northmes/contracts`, so as written it forbids the contracts packages and the Zod copy that every remote bundles to validate its forms.
* URL state. Nothing covered tabs, detail panels or the planning board, and `screenRoute` could not declare search. No router serializer was chosen. TanStack Router's default search format is JSON: against `@tanstack/router-core` 1.171.27, `defaultParseSearch("?q=1001&size=50")` returns `q` as the number 1001, so a `z.string()` key fails on a shared link that searches for an order number, and arrays are written as escaped JSON.
* Links. Each path was written at the route and again at every call site in the module. The nav entry had two sources, the `nav` option of `screenRoute` and the `nav` array of `defineWebModule`. `@northmes/ui` may not import the router, yet several of its patterns navigate. A moved page had no redirect, an unknown path inside a module had no page, and no CI check noticed a removed path.

This ADR covers `@northmes/contracts`, the `@northmes/<id>-contracts` packages, `@northmes/web-sdk`, `@northmes/ui`, `@northmes/web-build`, the shell in `apps/web`, module and plugin remotes, the end-to-end specs and the CI checks that guard them. It keeps runtime remotes, code-based routes and Zod 4 contracts. It changes parts of the accepted ADRs 0015, 0019, 0022, 0023 and 0041, listed under [Parts of accepted ADRs this decision changes](#parts-of-accepted-adrs-this-decision-changes). Those files keep their text, as the [ADR rules](README.md) require.

## Decision drivers

* One schema per command for the pipeline, the GraphQL input and the form, so a cross-field rule gives the same message and path in the browser and on the server ([ADR 0017][adr-0017]).
* A field error from Zod, from a refinement or from a handler lands on its field through one path format, also inside repeated rows.
* A shared link opens the same view for a coworker, and one bad or outdated key never resets the other keys or shows an error page.
* Moving a page is a change in one place, and old links, bookmarks and N-1 plugin remotes keep working for at least one minor release ([ADR 0038][adr-0038]).
* No TypeScript program sees every module's routes, because remotes load at run time ([ADR 0019][adr-0019]), so typing across modules comes from the MIT contracts packages.
* `@northmes/ui` stays free of router, Apollo and GraphQL imports ([ADR 0022][adr-0022]).
* Each rule has a test, a type test or a CI check, because coding agents build most screens.

## Considered options

* Forms: one `fields` schema per command with the input derived from it by `target`; a form schema derived from `contract.input` with `.omit()` and `.partial()`; a hand-written form schema per form with a `toInput` step.
* URL view state: `defineSearch` with per-key fallback on `screenRoute` and one flat serializer set by the shell; TanStack Router's default JSON search format with `validateSearch` per route; a params hook per screen behind a router adapter.
* Links: one link manifest per module in its MIT contracts package (`defineModuleLinks`), read by routes, nav, other modules, server code and end-to-end specs; path strings at each route and call site with hand-written link helpers in the contracts package; a module-local links file plus a shared contracts manifest with a promotion rule.

## Decision outcome

Chosen options: one `fields` schema per command, `defineSearch` with one flat serializer, and one link manifest per module, because each form rule, search key and path is then written once, checks can compare it with what the pipeline and the router do, and none of the three needs the whole route tree in one TypeScript program.

### Forms

* Each command declares its user-editable fields once: `defineCommandContract({ name, target, fields, permission, validatable, reason, signature })`. `fields` is a `z.object` with any synchronous refinements, and `target` is `new`, `existing` or `none`. The SDK derives `contract.input` as `fields.extend({ id: z.uuid() })` for `new`, `fields.extend({ id: z.uuid(), expectedVersion: version })` for `existing`, and `fields` for `none`. `.extend()` with new keys keeps the refinements. The pipeline parses `contract.input`, and forms validate `contract.fields` ([ADR 0017][adr-0017]).
* `useCommandForm({ contract, mutation, entity?, optimistic? })` in `@northmes/web-sdk` adds `id` (a new uuidv7 for target `new`, `entity.id` for `existing`), `expectedVersion` from `entity.version` and the shared reason argument. Form field names equal the schema paths. An input edited in another shape is one field component bound to one path (a plant date-time field for a `LocalDateTime`, `QuantityInput` for `{ value, unit }`), never a second schema or a `toInput` step.
* Contract inputs may use `.refine` and `.superRefine` with synchronous checks, and the pipeline parse and the browser resolver both run them with the same messages and paths. `useZodForm` sets the resolver mode to sync. `.meta({ id })` is the last call on a named schema, and a transform appears only as `z.codec` or as a pipe whose input side `inputFromZod` supports ([ADR 0017][adr-0017]).
* A rule that needs stored data is a handler check that throws a `DomainError` with `fieldErrors: [{ path, message, code }]`, with paths relative to the command input. A `defineErrors` entry may declare `field: <dot path>`, and a thrown error of that code fills `fieldErrors` from it. The exception filter writes `extensions.fieldErrors` in the same shape as a Zod failure, and `toDomainError` maps a code-key violation to `core.code_taken` with `fieldErrors` on the definition's `code` field ([ADR 0012][adr-0012]).
* One function in `@northmes/web-sdk` maps every `fieldErrors` entry, from Zod or from a `DomainError`. The react-hook-form name is the path joined with a dot. An entry with no registered field goes to `root.server` and the error summary. No form keeps a map from issue paths to field names.
* A measured input is validated in the unit the person typed. `measured(dimension, { min?, max? })` in `@northmes/contracts` accepts `{ value, unit }` with a finite value and a unit of the field's dimension, and carries `min` and `max` as canonical values in metadata. In the parse step ([ADR 0012][adr-0012]) the pipeline parses the contract, converts the value to canonical, then checks the limits. A failure returns `fieldErrors` at the field's path with the limit stated in the unit the person typed. The browser shows that message after submit and never converts. A cross-field rule between measured fields is a handler check that throws a `DomainError` with `fieldErrors`, never a refinement.
* Every remote bundles its own copy of `zod`, `@northmes/contracts` and the `@northmes/<id>-contracts` packages it imports. A schema reaches `@northmes/ui` only as a value: the form engine uses the Standard Schema interface, and `SettingsForm` and `EntityForm` read labels through schema metadata, which Zod 4 keeps in a registry on `globalThis` (`z.globalRegistry` in Zod 4.5.4), so labels set through one copy are visible to another. Shared code never uses `instanceof` on Zod classes.
* `@northmes/ui` exports by name the react-hook-form pieces module forms need: `useFieldArray`, `useWatch`, `useController`, `useFormContext`, `FormProvider` and the types `FieldPath`, `FieldValues`, `UseFormReturn` and `SubmitHandler`. Module web code still imports no `react-hook-form` ([ADR 0022][adr-0022]).
* Codegen maps `Instant`, `LocalDate`, `LocalTime` and `LocalDateTime` to the branded types exported by `@northmes/contracts`, and the contracts' time value schemas output the same brands ([ADR 0024][adr-0024]). `z.output` of a contract input is then assignable to the generated mutation input type without a cast, and a type test per command asserts it.

### URL view state

* State a coworker needs to see the same view lives in the URL: the open tab, filters, sort, grouping, search, page, board zoom and visible range, and the selected entity whose panel is open. State that only this person needs stays in component state: an open dialog or menu, hover, focus, collapsed groups and paused live updates.
* `defineSearch({ <key>: searchKey.<kind>(...) })` in `@northmes/contracts` declares a route's keys as Zod 4 schemas with defaults. Each key falls back to its default on its own, so one bad key never resets the others or renders the error component.
* `screenRoute` sets `validateSearch` from the route's search definition: the `search` of its link manifest entry, or the `search` option on a route without a `link`. Passing both is a type error. It adds `stripSearchParams(defaults)`, so defaults never appear in the URL, and sets `loaderDeps` to the keys marked as data keys, so a tab or panel change does not rerun the loader. These options sit on the route object that `routes(plantRoute)` returns, never in a lazy file, because a lazy route carries only components.
* `useViewState(Route)` in `@northmes/web-sdk` returns the typed values and `setView(patch, { push? })`. `setView` merges into the current search, removes a key set to `undefined` and keeps the scroll position. It replaces the history entry unless `push` is true. Opening a detail panel or switching a tab passes `push: true`, so Back undoes it.
* The shell creates the router with `parseSearch: urlSearch.parse` and `stringifySearch: urlSearch.stringify` from `@northmes/contracts`. Only the shell sets them, because the router is one shared instance. `parse` returns every value as the string in the URL and never parses JSON. `stringify` writes strings as they are, arrays as comma lists (it refuses an item that contains a comma), `true` as `1` and numbers in plain decimal, and drops `undefined`, `null`, empty strings and empty arrays. The `searchKey` helpers decode from that string form and also accept the typed form that `navigate` passes. Link builders use the same `stringify`.
* When a key in the URL fails its schema, the route drops it with a replace navigation, and `PageFrame` shows a polite status: "This link had 1 setting that no longer applies, so it was ignored." Changing a default, removing a search key or removing an enum value a key accepts is a URL contract change, and the link snapshot records it.
* `EntityDetailPage` keeps the open tab in the `tab` key: `general` is the default, `history` is the History tab, and a slot tab uses its contribution id. An unknown id falls back to `general`.
* `listSearch(listDefinition)` in `@northmes/contracts` is `defineSearch` plus the list keys, and `useListState` reads the state of a route that uses it. A filter's URL key is its GraphQL filter field name (`status=planned,active`, `deadlineAtDate=2026-10-01..2026-10-31`, `customerId=<id>`). The reserved keys are `q`, `sort`, `group`, `size`, `page`, `after`, `before`, `archived`, `view` and `tab`, and `defineList` throws at definition time when a filterable field's key equals one of them. `page` is the 1-based page counter behind "Rows 51 to 100 of 500"; it travels with the cursor and is dropped with it. `defineList` comes from `@northmes/contracts`, so a remote that reads a list declaration loads no Nest code.
* The planning board keeps the view a planner shares: `view=table` for the job order table view, `zoom=<preset id>`, `from=<plant-local date>` for the start of the visible range, and `order=<production order id>` for the selected order, which opens its detail panel. Collapsed machine groups, move mode and paused live updates stay local. The defaults (board view, the default preset, the current production day) are stripped, and Earlier and Later replace the history entry. Design task D3 names the preset ids ([07 production planning](../plan/07-production-planning.md)).

### Module link manifests

* Each module with screens declares its link manifest once, in its MIT contracts package, from its first screen. `defineModuleLinks(id, entries, { station?, moved? })` lives in `@northmes/contracts` and imports no router:

  ```ts
  // modules/planning/contracts/src/links.ts (MIT), sketch
  export const planningLinks = defineModuleLinks("planning", {
    board: { path: "board", search: boardSearch },
    orders: {
      path: "orders",
      search: listSearch(productionOrderList),
      children: { order: { path: "$orderId" } },
    },
  });
  ```

* Paths use the router's `$param` syntax, each segment is either literal or exactly one `$param`, and the manifest nests like the route tree. Each entry is a builder: `planningLinks.orders.order({ plant, orderId }, search?)` returns `{ to, params, search, href }`. Parameter names come from the pattern through template-literal types, `plant` is required on every plant route entry, values are `encodeURIComponent`-ed, an empty value throws, and `search` is typed from the entry's definition.
* The `station` section of the options argument declares station routes. Its builders take `stationId` instead of `plant` and build `/station/$stationId/...`, and the `fullPath` and snapshot checks cover them ([ADR 0033][adr-0033]).
* `screenRoute({ parent, link, title, nav, permission, search, component })` takes its path segment and search definition from `link`, the route's manifest entry, so each path is written once. A route without `link` is a pathless layout route: it takes an `id`, never a `path`, and may declare `search` for its children. `masterDataRoutes(definition, link, overrides)` returns a register's list, detail, create and edit routes under the register's manifest entry (for example `coreLinks.tools`).
* Inside the module, `to`, `params` and `search` spread into `Link`, and `register.ts` checks them. Other modules, server code such as MCP tools, and end-to-end specs use `href`. A link against the dependency direction is a slot contribution: the dependent module contributes the link or a panel to a slot that the target screen owns, as production-start does in `planning/order/panels/v1` ([ADR 0037][adr-0037]).
* Components in `@northmes/ui` that navigate (the `DataTable` row link, `IdentifierLink`, `EmptyState` actions and the `PageFrame` breadcrumb) take an `href` and render it through the link component from `LinkProvider` in `@northmes/ui`. Without a provider they render a plain `<a>`, so `@northmes/ui` tests and later MCP Apps views need no router. `ModuleLink` in `@northmes/web-sdk` renders `<a href>`, preloads on intent and, on an unmodified primary click, calls `router.navigate({ href })`, which TanStack Router commits as an in-app navigation for an href without a scheme. The shell mounts `<LinkProvider component={ModuleLink}>` once, inside `RouterProvider`. Module code renders a cross-module link as `<ModuleLink href={planningLinks.orders.order({ plant, orderId }).href}>`.
* `nav` on `screenRoute` takes `{ label, order?, parent?, search? }` or a list of them, stored in `staticData.nav`. `parent` is the link manifest entry of the route whose nav entry is the parent (for example `parent: planningLinks.orders`). After `routes(plantRoute)`, the shell walks the returned tree, as it does for titles, and builds the module's nav entries from the routes that carry `nav`. Each entry's `to` is the route's `fullPath`, its search is the entry's preset search and its permission is the route's permission. `defineWebModule` has no nav list, and a nav entry exists only on a route with a title.
* Each module is one sidebar group, headed by its manifest `web.label`, at its manifest order. Its items are its nav entries, ordered by `nav.order` and then by declaration order, and `nav.parent` nests an entry one level under another entry of the same module. `/api/web/modules` adds `modules[].kind` (`core`, `module` or `plugin`), which puts core first and plugins in their own section. A module that failed to load shows its header with "(unavailable)" and no items. `WebModule` gains `help?: readonly HelpEntry[]` with `{ id, label, href }`, shown in the one help menu grouped by module.
* `moved: { <old full pattern>: <new full pattern> }` in the options argument records moved pages, so no entry name is reserved. The remote adds `movedRoutes(parent, planningLinks)` from `@northmes/web-sdk`: routes whose `beforeLoad` throws `redirect({ href, replace: true })`, with params mapped by name and the search kept. The target can be in another module, because it is a full pattern string. A moved entry stays for at least one minor release, so the links of an N-1 plugin keep working.
* Each loaded module's subtree gets a `notFoundComponent` with the title `Page not found · <module label> · Plant A · NorthMES`, one `h1` and a link to the module's first nav entry. The router's `defaultNotFoundComponent` covers all other paths ([ADR 0021][adr-0021]).
* `pnpm gen` writes `modules/<id>/web/links.snapshot.json` from each module's manifest: patterns, params, search keys, their defaults and the enum values each key accepts. A CI check compares it with the previous release's snapshot and fails when a link pattern, param or search key disappears without a `moved` entry, as the slot id check does for slots ([ADR 0037][adr-0037]).
* No app path is written as a string literal in `to=`, `href=`, `navigate({ to })`, `redirect({ to })` or `page.goto()` in `modules/*/web`, `examples/*/web`, `apps/web` and `e2e`; paths come from link builders. A pattern check script next to the styling check enforces this, and an allowlist entry needs a reason. End-to-end specs build URLs with the builders, for example `page.goto(planningLinks.orders.order({ plant, orderId }).href)`.
* `useBreadcrumbs()` in `@northmes/web-sdk` returns `{ label, href }` for each route match whose route has a title. `PageFrame` takes `crumbs` and an optional `entityLabel`, which replaces the last crumb and the specific part of the document title ("Order 1001 · Plant A · NorthMES").
* Each link in the plant switcher keeps the current route and its search when the route's only path param is `$plant`. On a route with entity params, the link goes to the nearest ancestor route without them and drops the search, because entity ids belong to one plant. The full navigation that a different module set causes uses the same target.

### Parts of accepted ADRs this decision changes

The files below keep their text. Once this ADR is accepted, it holds over the parts listed here, and the rest of each ADR stands.

[ADR 0019][adr-0019], web shell with React Module Federation remotes:

* Remote contract: the default export is `defineWebModule({ id, version, northmesRange, permissions, routes(plantRoute), stationRoutes?, widgets, help?, typePolicies? })`. `nav` leaves the list, and a module's nav entries come only from the `nav` option of its routes.
* "Links into another module's screens use small link helpers from that module's MIT contracts package" becomes: links into another module's screens use the `href` of a builder from that module's link manifest (`defineModuleLinks`) in its MIT contracts package, rendered through `ModuleLink`.
* CSS, the forbidden-bundle bullet: the list derived from `@northmes/ui`'s dependencies leaves out the packages every remote bundles on purpose, `zod`, `@northmes/contracts` and the `@northmes/<id>-contracts` packages, under the Zod rules in [Forms](#forms).
* Shell and boot gain the `urlSearch` serializer, the per-module `notFoundComponent` and the router's `defaultNotFoundComponent`; `/api/web/modules` entries gain `kind`.
* Confirmation: the per-remote harness check that every `nav[].to` matches a route in the module's tree goes away, because the `nav` list no longer exists. The nav, link and bundle tests in this ADR's Confirmation replace it.

[ADR 0022][adr-0022], shared building blocks, package map and Confirmation:

* `@northmes/contracts` also holds the `version` value type, `defineList`, `listSearch`, `defineSearch` and the `searchKey` helpers, `urlSearch`, `defineModuleLinks` and `measured`.
* `@northmes/<id>-contracts` holds the module's link manifest (`defineModuleLinks`) and the search definitions its entries name, in place of "link helpers".
* `@northmes/web-sdk` also holds `useViewState`, `useBreadcrumbs`, `ModuleLink` and `movedRoutes`.
* `@northmes/ui` also holds `LinkProvider` and the named react-hook-form exports listed under [Forms](#forms).
* Confirmation gains `packages/contracts/test/pure-imports.test.ts`.

[ADR 0023][adr-0023], SI units, API and Confirmation:

* "Mutations take `{ value, unit }` inputs and convert to canonical before validation, so limits and cross-field rules compare canonical values" becomes: mutations take `{ value, unit }` inputs, the contract validates them in the typed unit through `measured`, and the pipeline converts them to canonical after the contract parse and before the limit checks, so limits compare canonical values. A cross-field rule between measured fields is a handler check that throws a `DomainError` with `fieldErrors`, never a refinement, because a refinement also runs in the browser, which never converts.
* Confirmation gains `packages/sdk/test/units/measured-limits.test.ts` and the server limit case in `packages/web-sdk/test/use-command-form.test.tsx`.

[ADR 0041][adr-0041], test strategy, Vitest projects:

* The project table gains `types`: `**/*.test-d.ts` in Vitest typecheck mode, with no runtime, run in `pnpm check`. `pnpm check` runs `vitest run` over `unit`, `integration`, `web` and `types`, and `test/meta/collection.test.ts` counts the new project.

[ADR 0015][adr-0015], schema snapshot and checks:

* The fixed order of `pnpm gen` gains the link snapshots after the CSS sources and before the database types, and `pnpm gen --check` covers them.

### Consequences

* Good, because an update form validates the same refined `fields` schema that the pipeline parses inside `contract.input`, so cross-field messages match and no second schema exists.
* Good, because every field error, from the browser, a refinement or a handler, reaches its field through one mapper, including rows such as `operations.1.cycleTime`.
* Good, because a shared URL reproduces tabs, filters, sort, the board range and the open panel, and an outdated key is dropped with a notice instead of an error page.
* Good, because a page move is one manifest edit plus a `moved` entry: routes, nav, cross-module links, server links and specs follow, and old links redirect.
* Good, because a link into another module is typed through that module's contracts package, which narrows ADR 0019's "typed links stop at the module boundary": the builder is typed, and the router receives an href.
* Bad, because a new screen in an existing module takes four hand-edited files plus its test: its entry in the module's link manifest, the route with its title and nav entry, the screen component and its `.graphql` operations.
* Bad, because every remote carries its own Zod and contracts code, and shared code must avoid `instanceof` on Zod classes.
* Bad, because a limit on a measured field shows only after submit, since the browser never converts.
* Bad, because NorthMES owns the serializer, `defineSearch`, `defineModuleLinks`, the redirects and the snapshot check, and must follow TanStack Router's search, redirect and not-found APIs.
* Bad, because manifests carry old patterns in `moved` for at least one minor release.
* Neutral, because a list item in the URL cannot contain a comma; `urlSearch.stringify` refuses it.

### Confirmation

Forms:

* `packages/contracts/test/define-command-contract.test.ts`: "target existing adds id and expectedVersion and keeps the superRefine from fields".
* `packages/web-sdk/test/use-command-form.test.tsx`: "a cross-field refinement shows the same message and path in the browser as the server returns"; "an update form sends expectedVersion from the entity"; "a server limit error lands on the quantity field".
* `packages/web-sdk/test/field-errors.test.ts`: "operations.1.cycleTime lands on that field"; "an unknown path lands in the summary".
* `apps/server/test/gateway/errors.int.test.ts`: "a DomainError with a declared field returns fieldErrors in the Zod shape"; "a failed superRefine returns fieldErrors with the refinement path".
* Master-data kit contract suite: "a duplicate code returns fieldErrors on code".
* `packages/sdk/src/graphql/input-from-zod.test.ts`: "a nested object refined after .meta({ id }) fails at boot and the message says to call .meta last"; "a superRefine on the input leaves the printed SDL unchanged".
* `packages/sdk/test/units/measured-limits.test.ts`: "a fixture cycle time field with a 1 s minimum refuses 4000 pieces per hour and states the limit as 3600 pieces per hour".
* `packages/web-build/test/guards.test.ts`: "a fixture remote that bundles zod and @northmes/planning-contracts passes".
* `packages/ui/test/settings-form.test.tsx`: "labels render from a schema built with a second Zod copy", using an aliased `zod` dependency.
* `packages/ui/test/form-exports.test.ts`: "every name on the form export list is exported and appears in the API report".
* `modules/planning/web/test/commands.test-d.ts` in the `types` project: `z.output<typeof releaseProductionOrder.input>` is assignable to `PlanningReleaseProductionOrderInput`.
* `packages/contracts/test/pure-imports.test.ts`: "importing every @northmes/*-contracts package in a fresh process loads no @nestjs/* or react module".

URL view state:

* `packages/web-sdk/test/use-view-state.test.tsx`: "a tab change and a filter change in one tick both reach the URL"; "a value equal to its default removes the key"; "a tab change does not rerun the loader"; "?status=bogus&q=x keeps q and falls back on status"; "a removed enum value in the URL is dropped and announced once".
* `packages/ui/test/entity-detail-page.test.tsx`: "?tab=history opens the History tab".
* `e2e/view-link.spec.ts`: "a copied URL opens the same tab, filters and sort in a second browser context".
* `packages/contracts/test/url-search.test.ts`: "q=1001 round-trips as the string 1001"; "status=planned decodes as a one-item list and status=planned,active as two items"; "deadlineAtDate=2026-10-01..2026-10-31 round-trips"; "an item containing a comma is refused".
* `apps/web/test/router-search.test.tsx`: "navigate with typed search writes the documented URL, and useSearch reads back equal values".
* `modules/planning/web/test/board-search.test.tsx`: `?zoom=week&from=2026-11-02&order=<id>` opens that range with the panel open; "Earlier and Later replace the history entry"; "an order id outside the range opens the panel's not-found state".
* `packages/contracts/test/define-list.test.ts`: "a filter field named sort throws".
* `packages/web-sdk/test/use-list-state.test.tsx`: "a filter change drops after, before and page".
* A type test in `packages/web-sdk`, in the `types` project: a `screenRoute` call that passes both `link` and `search` fails typecheck.

Links and nav:

* `packages/contracts/test/define-module-links.test.ts`: "order({ plant: plant-a, orderId: a/b }).href is /plant-a/planning/orders/a%2Fb"; "an empty orderId throws"; a station section builder takes `stationId` and builds a path under `/station/`.
* `packages/contracts/test/define-module-links.test-d.ts` in the `types` project: `@ts-expect-error` on a missing `orderId`, an extra argument, an unknown entry, a search key the entry does not declare, and a status value outside the enum.
* `modules/planning/web/test/routes.links.test.tsx`: "every planningLinks entry matches a route fullPath". The same per-remote harness checks params and search definitions, and covers the station section of production-start's manifest.
* A Vitest test per remote: a nav entry exists only on a route with a title.
* `apps/web/test/nav-from-routes.test.ts`: "a screenRoute with nav appears under its module, ordered by nav.order"; "a route that the plant's permissions deny has no entry"; "a nav entry with a preset search links to that search".
* `apps/web/test/sidebar.test.tsx`: "entries without order keep declaration order"; "a nested entry renders under its parent"; "a plugin module renders in the plugins section"; "help entries appear in the help menu under their module label".
* `packages/web-sdk/test/module-link.test.tsx`: "a plain click navigates without a document load"; "a ctrl click and a middle click are left to the browser".
* `packages/ui/test/identifier-link.test.tsx`: "renders through the provided link component and falls back to an anchor".
* `modules/planning/web/test/routes.moved.test.tsx`: "/plant-a/planning/orders/1?tab=history redirects to /plant-a/planning/production-orders/1?tab=history with replace".
* The link snapshot check's own test: "a removed pattern without a moved entry fails and names the pattern". The check runs on every pull request as the "Link patterns" row of the CI checks ([11 quality and testing](../plan/11-quality-and-testing.md)), and `pnpm gen --check` fails when a committed `links.snapshot.json` is stale.
* `e2e/not-found.spec.ts`: "an unknown path under a loaded module shows its not-found page with a title and one h1".
* `test/meta/path-literals.test.ts`: a fixture `<Link to="/x">` in a module web file fails, and a builder call passes.
* `packages/web-sdk/test/use-breadcrumbs.test.tsx`: "a detail route yields module, list and entity crumbs".
* `packages/ui/test/page-frame.test.tsx`: "entityLabel sets the last crumb and the title".
* `apps/web/test/plant-switch.test.tsx`: "on /plant-a/planning/orders/1 the plant-b link is /plant-b/planning/orders".
* A link against the dependency direction needs no new test: the existing slot catalog check covers it ([ADR 0037][adr-0037]).

Tooling:

* `test/meta/collection.test.ts` ([ADR 0041][adr-0041]) counts the `types` project, so each `*.test-d.ts` file belongs to exactly one project.

## Pros and cons of the options

### One `fields` schema per command with the input derived by `target`

* Good, because the form and the pipeline run the same refinements with the same paths.
* Good, because `.extend()` with new keys keeps refinements in Zod 4, so the derivation works on refined objects.
* Bad, because every contract declares a `target`.

### A form schema derived from `contract.input` with `.omit()` and `.partial()`

* Good, because the contract needs no new option.
* Bad, because Zod 4.5.4 throws on `.pick()`, `.omit()` and `.partial()` for an object with refinements, and the Zod 4 test suite pins that behaviour, so it fails on the first refined update input.

### A hand-written form schema per form with a `toInput` step

* Good, because each form can shape its values freely.
* Bad, because the second schema drifts from the contract, which [ADR 0017][adr-0017] exists to prevent, and cross-field rules then differ between browser and server.
* Bad, because the earlier attempt paid for it with per-form draft transforms, maps from issue paths to field names and 21 copies of an issue-to-error mapper in two variants, some of which keyed on the first path segment and dropped nested server errors.

### `defineSearch` with per-key fallback and one flat serializer

* Good, because one bad key falls back alone, and the URL has the documented flat format.
* Good, because link builders, server code and the router write the same URL.
* Bad, because NorthMES owns the serializer and the `searchKey` helpers.
* Bad, because a list item cannot contain a comma.

### TanStack Router's default JSON search format

* Good, because it needs no code and round-trips any JSON value.
* Bad, because `?q=1001` parses as the number 1001, so a string key fails on a shared link, and `defaultStringifySearch` writes `status=%5B%22planned%22%2C%22active%22%5D` for two statuses.
* Bad, because the earlier attempt hit the same quoting, needed a comma-list workaround, and saw untyped search literals on links arrive quoted.

### A params hook per screen behind a router adapter

* Good, because screens do not depend on the router's search API.
* Bad, because search stays untyped in the router, and each screen keeps its shape outside `validateSearch`.
* Bad, because in the earlier attempt one such hook served tabs, filters and selections on about 80 screens, and its shape failed as a whole, so one bad param reset every filter.

### One link manifest per module in its contracts package

* Good, because each path is written once, and routes, nav, cross-module links, server links and specs read it.
* Good, because the builders are plain functions in MIT packages that MCP tools and Playwright specs can call without a router.
* Good, because a generated snapshot gives CI a registry to compare with the previous release, as for slot ids.
* Bad, because the manifest is one more file to edit per new screen, and a per-remote harness must keep it equal to the route tree.

### Path strings at routes and call sites with hand-written link helpers

* Good, because it needs no new function: `register.ts` already types links inside a module.
* Bad, because a move touches the route, every in-module link and the helper, and nothing ties a helper to the route, so after a move the code compiles while the helper returns the old path.

### A module-local links file plus a shared contracts manifest with a promotion rule

* Good, because a module's internal screens stay out of its public package.
* Bad, because the earlier attempt needed the split only because all modules shared one contracts package; each NorthMES module has its own, so its whole manifest can live there from the first screen.
* Bad, because promotion adds a second place to edit when a link becomes public.

## More information

* Library behaviour this ADR relies on: in Zod 4.5.4, `.pick()`, `.omit()` and `.partial()` throw on refined objects, `.extend()` with new keys keeps refinements, a schema returned by `.refine()` does not keep `.meta({ id })`, and `z.globalRegistry` lives on `globalThis`. In `@tanstack/router-core` 1.171.27 the default search format is JSON, and `navigate({ href })` commits an in-app navigation for an href without a scheme. The TanStack Router documentation says a lazy route carries only components, a throwing `validateSearch` renders the route's error component, `loaderDeps` should not return the whole search object, and routes support `notFoundComponent`, `defaultNotFoundComponent` and `throw redirect(...)` in `beforeLoad`.
* Related ADRs: [0003][adr-0003] (one contracts package per module), [0012][adr-0012] (parse step, `DomainError` and `fieldErrors`), [0015][adr-0015] (`pnpm gen`), [0016][adr-0016] (lists), [0017][adr-0017] (contract shape and refinement rules), [0019][adr-0019] (shell and remote contract), [0020][adr-0020] (router and forms), [0021][adr-0021] (titles and headings), [0022][adr-0022] (package map), [0023][adr-0023] (units), [0024][adr-0024] (time scalars), [0033][adr-0033] (station routes), [0037][adr-0037] (slots and the slot id check), [0038][adr-0038] (N-1 plugins), [0041][adr-0041] (Vitest projects).
* Plan: [06 web and UX](../plan/06-web-and-ux.md) (remote contract, rules the shell and CI enforce, routes and typed links, view state in the URL, lists, forms, time and units, master-data kit UI), [07 production planning](../plan/07-production-planning.md) (board URL), [05 GraphQL and APIs](../plan/05-graphql-and-apis.md) (error model, codegen order), [11 quality and testing](../plan/11-quality-and-testing.md) (the `types` project, CI checks, Playwright), [14 roadmap](../plan/14-roadmap.md) (E02-S05 routes from `planningLinks`, E04-S04 plant switch, E04-S07 forms, E06-S03 view state).
* Revisit when TanStack Router types links across separately built route trees, when Zod allows `.omit()` on refined objects, or when a value with a comma must travel in a list key.

[adr-0003]: 0003-module-package-shape-and-the-definemodule-manifest.md
[adr-0012]: 0012-commands-as-the-single-write-path.md
[adr-0015]: 0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md
[adr-0016]: 0016-graphql-list-conventions-connections-relations-filter-sort-search-and-group-by.md
[adr-0017]: 0017-zod-contracts-as-the-single-source-for-inputs.md
[adr-0019]: 0019-web-shell-with-react-module-federation-remotes.md
[adr-0020]: 0020-frontend-libraries-tanstack-router-apollo-client-4-shadcn-ui-and-forms.md
[adr-0021]: 0021-accessibility-target-wcag-2-2-aa.md
[adr-0022]: 0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md
[adr-0023]: 0023-si-units-with-a-northmes-unit-catalog.md
[adr-0024]: 0024-time-utc-instants-plant-wall-clock-temporal-and-the-clamp-resolver.md
[adr-0033]: 0033-online-operator-station-in-the-production-start-module.md
[adr-0037]: 0037-plugins-drop-in-packages-command-validators-and-ui-slots.md
[adr-0038]: 0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md
[adr-0041]: 0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md
