---
status: "proposed"
date: 2026-10-07
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: Krister Johansson; internal research note 32
informed: module and plugin authors, contributors and coding agents
release: "1"
needs-confirmation: "maintainer (the ledger rows of the nine release 1 pieces; the AI budget banner as the first banner contribution; top bar items drawn from data; roles only for plugin permissions; plant-free fields for the notifications module; the command.rejected security event and the validator record at the first regulated sale; acceptance before the skeleton's validator story)"
---

# Extension points declared by their owners, contributions as manifest data with code by id, and a plugin inventory

## Context and problem statement

[ADR 0037][adr-0037] decided drop-in plugins with veto-only command validators and versioned UI slots, and [ADR 0003][adr-0003] the manifest that every module and plugin declares. Read together with [ADR 0066][adr-0066] and [ADR 0067][adr-0067], they leave four gaps in the decided design:

* The shell aside, where the AI chat panel mounts, has no slot id, while every other slot follows `<owner>/<area>/<name>/v<N>`.
* Boot step 4 checks validator targets before any Nest code loads, but no manifest field names a module's validators.
* [ADR 0014][adr-0014] enqueues jobs for consumers "subscribed to the event type in its manifest", but no manifest field declares consumed events.
* Owners' screens cannot import another module's contracts, so only the server can supply the message of a plugin's veto.

They also leave open what a module or plugin may extend beyond the release 1 slots, whether a slot draws its contributions or the contributions draw themselves (the board's block fields are the one slot where the owner draws), how the shell names a contribution whose remote failed, and how a banner from a module reaches the strip under the top bar. Two questions from the maintainer frame the decision: whether plugins extend the frontend, the backend or both, and whether a role model of roles built from permissions, assigned at the company or at a plant and inherited from the company down, fits NorthMES.

A planning session compared three designs (declarative points, an owner-marked chain, and hybrid lists with adornments) against seven extension platforms and Claude Code's mods. Krister Johansson decided on 2026-10-06: no `next` chain for now. That answers the session's question 1 only; its questions 2 to 8 stay open as M-62 to M-68, and the model this ADR proposes waits for his confirmation. His decision is recorded under [The next chain](#the-next-chain).

This ADR decides the extension points a module or plugin can use, the shape of a contribution, the slot kinds and the release 1 slot ids, the host objects on the server and the web, how points are versioned, the plugin inventory, the nine pieces release 1 builds and the triggers for everything else. It covers the manifest types and `defineValidator` in `@northmes/sdk`, the slot kind helpers and `useHost` in `@northmes/web-sdk`, the boot catalog, the command bus, the event sequencer, the remote build check in `@northmes/web-build`, `validateWebModule`, the shell's slot renderer and banner strip, `pnpm plugin:check` and the project skill `northmes-plugin`. It changes parts of the accepted ADRs 0019, 0037, 0055 and 0062, listed under [Parts of accepted ADRs this decision changes](#parts-of-accepted-adrs-this-decision-changes). Those files keep their text, as the [ADR rules](README.md) require.

## Decision drivers

* Krister Johansson's decision of 2026-10-06: no `next` chain for now.
* An owner can redraw its screens and change its internals without breaking plugins unnoticed, and an on-prem plugin survives an upgrade with a rebuild ([ADR 0038][adr-0038]).
* A skipped validator removes a business rule, so the server fails closed ([ADR 0037][adr-0037]).
* Accessible names, target sizes, live regions and overflow stay in one place, so every extension point meets WCAG 2.2 AA ([ADR 0021][adr-0021]).
* The host knows a contribution's label, permission and place before any plugin code runs, so it can name a contribution whose remote failed.
* Every write is a command with one audit row under a known principal ([ADR 0012][adr-0012], [ADR 0013][adr-0013]).
* The scope rule: a manifest key or platform piece ships in the same task as the code that reads it ([ADR 0055][adr-0055], [ADR 0022][adr-0022]).
* MIT packages declare and the AGPL host implements, so a plugin imports no AGPL code ([ADR 0056][adr-0056]).

## Considered options

* Declarative points: extension points that their owners declare and version, each slot with a kind, contributions as manifest data plus code by id, and no `next` chain
* An owner-marked chain: validators, consumers and render sites as chains that an owner marks, where each step calls `next`, as Claude Code's mods do
* Hybrid lists with adornments: one typed host object per side, lists that a plugin can insert into after another module's item and whose items it can adorn, and top bar items that draw their own control

## Decision outcome

Chosen option: "Declarative points", because in the dense kinds the plugin returns data and the host draws it, so accessibility and overflow stay in one place and an owner can redraw its screen without breaking plugins; because its catalog of points with explicit kinds and versions gives the best upgrade story; and because it needs no chain runner before a release 1 feature needs one. Its mistakes in the compared draft were small: permission keys prefixed with the kebab-case id instead of the GraphQL name ([ADR 0003][adr-0003]), icon names in lowercase instead of lucide component names ([ADR 0067][adr-0067]), and one package per plugin instead of up to three per module folder. This ADR fixes all three.

From the hybrid design it takes the package shape of [ADR 0003][adr-0003], one typed host object per side (`ctx` on the server, `useHost(slot)` on the web), the manifest field `consumes`, the placement rules for banners and overflow, and the agent skill that maps a need to a point. From the chain design it takes the list of places that are never extension points, the audit record of validator runs and vetoes (built at the first regulated sale), and the vocabulary of mods: observe maps to consumers, the deny form of answer to validators, and a narrower answer to later answer points. Rewrite has no counterpart.

Plugins therefore extend both the frontend and the backend, through the same manifest and the same boot catalog. The maintainer's role model already matches [ADR 0010][adr-0010], with one difference: an assignment holds a role, never a single permission ([Permissions and roles](#permissions-and-roles)).

### The next chain

Krister Johansson decided on 2026-10-06: no `next` chain for now. In this model no plugin rewrites another module's command input or wraps another module's drawing, and contributions to one point run side by side, never nested. The owner-marked chain stays a considered option that a later ADR can add as an owner-declared point kind. The planning session proposes the trigger: a need that validators, consumers, contributed fields and answer points cannot meet.

### Rules

1. A plugin is a module built outside the image. It uses the same `defineModule` manifest, the same package shape (up to three packages per folder; a module without screens has no web package) and the same boot catalog as an in-repo module ([ADR 0003][adr-0003], [ADR 0037][adr-0037]). Release 1 has two plugins: `example-validator` and `example-widget`.
2. Owners declare extension points, and code extends NorthMES only there.
   * On the web, a point is a slot with an id `<owner>/<area>/<name>/v<N>` and a kind.
   * On the server, a point is a command its owner declares `validatable`, with a payload version; an event with its version; or a keyed entity type. Every keyed entity type accepts contributed fields ([05 GraphQL and APIs](../plan/05-graphql-and-apis.md)), so its name, its key and the fields a contributor names with `@external` belong to the owner's contract.
   * Anything else is internal and may change in any release.
   * A module contributes only to points of modules in its `dependsOn` ([ADR 0037][adr-0037]).
3. A contribution is manifest data plus code by id.
   * The manifest lists each validator under `validates` and each consumed event under `consumes`. It lists each web contribution under `web.contributes`, with its id, slot, label, order and permission.
   * The server part or the remote supplies the code under the same id.
   * The host reads the data before any plugin code runs.
   * On the server, a registration without a declaration, or a declaration without a registration, stops boot. For web contributions, the remote build check in `@northmes/web-build`, which already compares id, version and range with the manifest, reports the same mismatch at build time, and `validateWebModule` reports it in the shell.
4. Each kind has one result shape.
   * The first veto rejects the command, and later validators do not run.
   * Regions stack by `order`.
   * Fields append.
   * Banners sort by severity.
   * In the dense kinds (field, item, banner, action), the contribution returns data and the host draws it.
5. Commands are the only writes, and the server decides access.
   * A contribution writes by running its own module's commands, so every write leaves one audit row under a known principal.
   * The web uses a contribution's permission only to decide what to show. The field guard and `can()` decide every read and every command.
6. No contribution changes another module's input. The moves are:
   * observe: an event consumer, after commit
   * veto: a validator
   * answer: a later answer point, where the owner asks a named question and records the answer it used
   * rewrite, or an answer that replaces the owner's behaviour: no counterpart
7. Context goes in as frozen data. Slot props hold ids and the scalar values that the slot's owner declares, such as the board's `paused` ([ADR 0021][adr-0021]), and never an entity record. A validator payload holds the fields its owner declares. Capabilities come from one typed host object per side. MIT packages declare the host objects, and the AGPL host implements them.
8. The server fails closed and the page fails soft.
   * A validator that throws or times out rejects the command.
   * A server plugin that fails to load stops boot ([ADR 0037][adr-0037]).
   * A web contribution that fails shows its fallback inside its own boundary, and the rest of the page keeps working.
9. These places are never extension points:
   * sign-in and sessions
   * role and assignment administration
   * the plant switcher and the plant check
   * the signature stage
   * fact commands at the station as veto points: they are not validatable in release 1, and later extension points on them are advisory only ([ADR 0033][adr-0033])
   * audit and History views
   * the permission check itself
10. In-repo modules use the points first where one exists. A point is built in the task of its first contributor ([ADR 0055][adr-0055]). Production-start, the Pyramid connector, core's remote and, later, the notifications module therefore exercise the release 1 web points on every pull request. The validator point has no in-repo contributor in release 1, so `example-validator` exercises it through the `plugin-outside` job.

### Package shape

```text
modules/maintenance/             plugins/maintenance/ when it is built outside the repository
├── package.json                 @northmes/module-maintenance (AGPL): manifest, server, migrations
├── northmes.module.ts           the manifest
├── server/                      MaintenanceModule; api/ holds MaintenanceApiModule
│   └── validators/tool-due.ts
├── migrations/                  own schema only, run as nm_mod_maintenance (ADR 0037)
├── schema.graphql
├── contracts/                   @northmes/maintenance-contracts (MIT): commands, events, errors, settings, links
├── web/                         @northmes/maintenance-web (AGPL): the remote, defineWebModule with contributions by id
│   └── src/module.tsx
├── docs/
└── test/
```

A plugin built outside the repository uses its own npm scope. `pnpm plugin:build` turns the folder into the one installable package that [ADR 0037][adr-0037] describes: `dist/manifest.js`, `dist/server.js`, `migrations/` and `web/dist/`. The `maintenance` module is an example; its GraphQL name, SQL name and id are the same word.

```ts
// northmes.module.ts
export default defineModule({
  id: "maintenance",
  version,
  northmes: ">=0.6.0-0 <0.7.0-0",
  dependsOn: ["core", "planning", "production-start"],
  permissions: { tool: ["read", "service"] },            // maintenance.tool:read, maintenance.tool:service
  roles: [{ key: "maintenance.technician", name: "Maintenance technician",
            permissions: ["maintenance.tool:read", "maintenance.tool:service"] }],
  settings: maintenanceSettings,
  commands: { "maintenance.setToolDue": { validatable: false }, "maintenance.recordCycles": { validatable: false } },
  events: { "maintenance.tool.due_changed": 1 },
  validates: [{ id: "maintenance.tool-due", command: "planning.releaseProductionOrder", payload: 1 }],   // new
  consumes: [{ event: "production_start.report.created", version: 1 }],                                    // new
  web: {
    label: "Maintenance", icon: "Wrench", order: 60, permission: "maintenance.tool:read",
    contributes: [                                                                                          // objects, new
      { id: "maintenance.tool-due-field", slot: "planning/board/block-fields/v1", label: "Tool due",
        order: 30, permission: "maintenance.tool:read" },
      { id: "maintenance.tools-panel", slot: "planning/order/panels/v1", label: "Tools",
        order: 40, permission: "maintenance.tool:read" },
    ],
  },
  server: () => import("./server/maintenance.module.js"),
});

// planning's manifest, the owner: each slot it owns declares a kind
web: { /* label, icon, order, permission */ slots: {
  "planning/board/block-fields/v1": { kind: "field" },
  "planning/order/panels/v1": { kind: "region" },
} },
```

Names follow the derived names of [ADR 0003][adr-0003]: permission and command ids start with the GraphQL name, event names start with the SQL name, and contribution ids start with the module id.

### Server extension points and the host API

| Point | The owner declares | The contributor declares and writes | When it runs | On failure | Release 1 |
|---|---|---|---|---|---|
| Validator | `validatable: true` on the command, a versioned payload schema in its contracts package, and the longest time limit it accepts | a `validates` entry and `defineValidator({ id, payload, timeoutMs, check })` returning `pass()` or `veto(error)`; `timeoutMs` stays within the owner's limit | inside the transaction at pipeline step 6 ([ADR 0012][adr-0012]), after permission, audit context and version, in dependency order and then by name, which is the validator's id | a throw, a timeout or a malformed verdict rejects the command | yes: `example-validator` on `planning.releaseProductionOrder` |
| Consumer | the event and its version in `events`, the payload schema in contracts | a `consumes` entry and `defineConsumer({ id, event, handle })`; a consumer that runs commands runs as a system principal that the module registers and a migration seeds ([ADR 0013][adr-0013]) | after commit, at least once, one pg-boss job per consumer and event, deduplicated through `core.inbox` ([ADR 0014][adr-0014]) | retried, then dead-lettered; the command that raised the event stands | in-repo modules (Pyramid write-back); plugins later |
| Contributed field | nothing beyond a keyed entity type in its subgraph | `@ResolveField` on `entityRef("ProductionOrder")`, or `@requires` with `@external` fields; nullable and prefixed | per request, batched through `loaderFor` and the request's `SubgraphContext` ([05 GraphQL and APIs](../plan/05-graphql-and-apis.md)) | the field is null and the response carries an error | yes: `example-validator`, through `@requires` |
| Own commands, lists, subscriptions, settings | nothing | `defineCommand`, `defineList`, prefixed subscription fields, `defineSettings` | the full pipeline, one audit row per command | owned by the module | in-repo modules; plugin table writes wait for the plugin database API |
| Job | nothing | `defineJob` and `schedule`; a manifest-registered system job runs as its own system principal, seeded by migration ([ADR 0013][adr-0013]) | pg-boss queue policy | retries, then dead letter | in-repo modules; plugins later |
| Onboarding step | core's onboarding wizard | an `onboarding` manifest entry and an `isComplete(scopeId)` check through the module's API module ([ADR 0066][adr-0066]) | when the wizard and the plant check ask | as [ADR 0066][adr-0066] decides | in-repo modules only; the catalog refuses the key in a plugin's manifest |
| `ask` verdict | allows `ask` on a validatable command | `ask(code, details, { permission? })` from a validator | the client shows the condition, the person confirms with a reason, and the client resends with the confirmed codes; the command row records both | as a veto | later |
| Answer point | `defineAnswerPoint({ id, input, answer })` in contracts | an answer in the owner's schema | the owner asks, decides and records the answer it used | the owner declares skip or reject; a fail-open choice is an audited command ([ADR 0051][adr-0051] rule 7) | later |

No observer runs inside the transaction. An observer there would be a validator that always passes: it would add time to every command and one more way for every command to fail. Modules observe through events, and auditors read `audit.command`.

```ts
// @northmes/sdk (MIT) declares these; the AGPL host implements them
export interface HostContext {
  readonly principal: { readonly id: string; readonly kind: PrincipalKind };
  readonly surface: Surface;                         // as recorded in the audit context
  readonly plant: { readonly id: string; readonly timeZone: string } | null;
  readonly clock: { now(): Temporal.Instant };       // the transaction's database time (ADR 0051 rule 10)
  readonly signal: AbortSignal;                      // aborts at the time limit
  can(permission: PermissionId): boolean;            // at the command target's scope
  settings<S extends SettingsDefinition>(def: S): Promise<SettingsOf<S>>;   // own settings at the plant
  readonly data: OwnData;                            // own schema only, under the command's row-level security scopes
  readonly log: Logger;                              // carries the correlation id, redacts declared fields
}

// later, with the first validator that reads anything beyond its payload
export interface ValidatorContext extends HostContext {
  readonly command: { readonly name: string; readonly id: string; readonly reason: string | null };
}

export interface ConsumerContext extends HostContext {
  readonly event: { readonly id: string; readonly position: bigint; readonly causationDepth: number };
  // runs as the consumer's registered system principal, which can() checks like any principal (ADR 0010);
  // only the module's own commands and those of modules in its dependsOn
  run<C extends CommandContract>(command: C, input: InputOf<C>): Promise<ResultOf<C>>;
}

export function defineValidator<P extends ValidatorPayload>(v: {
  id: string;                                        // equals the manifest's validates entry
  payload: P;                                        // the owner's schema and version, from its contracts package
  timeoutMs: number;                                 // at most the owner's limit for the command
  check(payload: DeepReadonly<PayloadOf<P>>): Promise<Verdict>;   // release 1
  // later, with ValidatorContext:
  // check(payload: DeepReadonly<PayloadOf<P>>, ctx: ValidatorContext): Promise<Verdict>;
}): Validator<P>;

export function defineConsumer<E extends EventContract>(c: {
  id: string;                                        // equals the manifest's consumes entry
  event: E;
  handle(event: DeepReadonly<PayloadOf<E>>, ctx: ConsumerContext): Promise<void>;
}): Consumer<E>;
```

* `ctx.data` reaches only the module's own schema. Data from other modules arrives through the owner: the validator payload, GraphQL references and events.
* `ctx.data` reads under the command's read scopes, which hold the company node and the request's plant ([ADR 0008][adr-0008]). A validator whose rule depends on rows of another plant sees none of them and passes, so it keeps its rule's data at the target's plant or the company.
* A veto's `details` and message reach the person who ran the command, whatever that person may read. The bus does not filter them, so a validator puts in only values the person may read at the target's scope, and checks with `ctx.can()` when it is unsure.
* Validators run inside the transaction that holds the target's row lock. The owner therefore sets the longest time limit it accepts per validatable command, and the catalog refuses a validator that asks for more.
* A veto returns `core.command_rejected` whose `details` carry `rejectedBy` (the validating module's id), the validator's error code, its details and the message the server renders from the validating module's `defineErrors`. A screen that runs the command shows that message without importing the validating module's contracts.
* Contributed fields keep `SubgraphContext` and `loaderFor` as [05 GraphQL and APIs](../plan/05-graphql-and-apis.md) describes them. They get no host object of their own.
* For plugins, `ctx.data` and `ctx.run` wait for the plugin database API and the jobs API with a system principal ([ADR 0037][adr-0037]).
* `clock.now()` is fixed for one transaction. A validator's verdict therefore follows from its payload, its data and that time, so a rejection can be reproduced.
* A command that a consumer runs carries the event as its causation. Once a consumer can trigger itself, the bus refuses a causation depth above a limit.
* Release 1 ships no `ValidatorContext`, so its `check` receives the payload only. `example-validator` computes its verdict from `quantity` in the payload ([03 modules and extensibility](../plan/03-modules-and-extensibility.md#the-two-example-plugins)), so it reads no context. `ctx` arrives with the first validator that reads anything beyond its payload, and each later member arrives with its first reader ([ADR 0022][adr-0022], [ADR 0055][adr-0055]).
* The later MIT service interfaces for in-process reads of core become `ctx.<noun>` members, declared in the owner's contracts package.

### Web slots

| Kind | The contribution provides | The host draws | Fixed rules |
|---|---|---|---|
| route | `routes`, `stationRoutes` or `settingsRoutes` subtrees | the layout, the nav entry from `screenRoute`, the breadcrumb, the not-found page | the path equals the module id ([ADR 0019][adr-0019]); every leaf route has a title ([ADR 0021][adr-0021]) |
| region | a component | a `WidgetFrame` section named by the manifest label, inside an error boundary keyed by contribution and entity | rendered for the selected item only, never per row or block ([ADR 0037][adr-0037]) |
| tab | a lazy component | a tab in `EntityDetailPage` after the owner's tabs; the URL `tab` value is the contribution id | an unknown id falls back to `general` ([ADR 0062][adr-0062]) |
| field | `useValues(props, ids)`, called once per slot instance; a synchronous `render(value)` that returns `{ text, icon?, accessibleText }`; and an optional `Hover` component that may fetch | the value inside the owner's layout: a block field, a header line, or a list column headed by the label; on the board, `Hover` inside the block's hover card | one query per slot instance, never per item; the owner calls each contribution's `useValues` in its own loader component inside its own error boundary, so a throw, or a plant switch that changes the permitted contributions, touches only that contribution; where the value joins an interactive element's name, as on a board block, `accessibleText` contains the visible text (WCAG 2.5.3); a contributed column is not sortable or filterable ([ADR 0016][adr-0016]) |
| item | an icon name, `useBadge(props)` and a `Content` component | an icon button named by the label and the badge, a popover, and on narrow screens a menu row and a sheet | one compact control per contribution |
| banner | `useBanners(props)` returning `BannerSpec[]` | the banner strip, sorted by severity, each banner announced once through the polite region | plain text and at most one link whose `href` comes from a link builder, never a component |
| action | a command contract with an input builder, or a link | the menu entry, the confirm dialog and the command's errors | runs one command or navigates |

Block fields and list columns share one kind. Both are a value per item, loaded in one batch and drawn by the owner. This turns the block-fields exception of [ADR 0037][adr-0037] into the general rule for dense places, and keeps its hover renderers that may fetch ([ADR 0030][adr-0030]).

| Slot id | Kind | Owner | Props (frozen) | Wide | Narrow (below about 640 px) | When |
|---|---|---|---|---|---|---|
| `/$plant/<id>/*`, `/station/$stationId`, `/settings/$companyId/<id>/*` | route | each module | route params | the module's own pages | the same | decided; `settingsRoutes` only for core in release 1 ([ADR 0066][adr-0066]) |
| `core/shell/aside/v1` | region, one docked | core | `{ plantId }` | docked beside `main` | modal sheet | release 1, the AI chat panel; M-39 decides whether the shell or core's remote supplies it |
| `planning/board/side/v1` | region | planning | `{ plantId, paused }` | docked beside the board | D3 decides | release 1, `example-widget` |
| `planning/board/header/v1` | field | planning | `{ plantId }`; one item, the plant | one line in the header | wraps; the full text stays in the accessible name | release 1, the Pyramid connector, if M-31 gives it a remote |
| `planning/board/block-fields/v1` | field | planning | `{ plantId }`; items are the blocks of the board's loaded range, so scrolling inside the range does not refetch | on every block | fewer fields by priority, all of them in the block detail (D3) | release 1, core and the Pyramid connector (M-31) |
| `planning/order/panels/v1` | region | planning | `{ plantId, productionOrderId }` | a column beside the details | stacked below | release 1, production-start |
| `core/top-bar/items/v1` | item | core | `{ plantId: string \| null }` | a button after the help menu | a button in the navigation sheet's footer, after the help menu, as D2 draws the bell at 320 px; content in a sheet | later, with the notifications module ([ADR 0067][adr-0067]) |
| `core/shell/banners/v1` | banner | core | `{ plantId: string \| null, layout }` | the strip under the top bar; two shown, then "Show n more" | the same, text wraps | later, the first module banner |
| `planning/order/tabs/v1` | tab | planning | `{ plantId, productionOrderId }` | a tab after General and History | the tab list scrolls | later |
| `planning/orders/columns/v1` | field | planning | `{ plantId }`; items are the rows of the page | a column | the table container scrolls horizontally ([ADR 0021][adr-0021]) | later |
| `planning/order/actions/v1` | action | planning | `{ plantId, productionOrderId, version }` | a page action | the page's overflow menu | later |
| `production-start/station/panels/v1` | region | production-start | `{ plantId, stationId, jobOrderId: string \| null }` | the station layout, 44 px targets | stacked | later |
| `core/dashboard/widgets/v1` | region | core | open (M-32) | open | open | undecided |

The aside and the banner slot carry the owner id `core` for the same reason as the top bar slot: the shell is not a module, and every module depends on core ([ADR 0067][adr-0067]).

### Contribution shape on the web

```ts
// @northmes/web-sdk (MIT)
export function region<S extends SlotOfKind<"region">>(slot: S, component: ComponentType): RegionImpl<S>;
export function tab<S extends SlotOfKind<"tab">>(slot: S, component: LazyExoticComponent<ComponentType>): TabImpl<S>;
export function field<S extends SlotOfKind<"field">, V>(slot: S, impl: {
  useValues(props: SlotProps[S], ids: readonly string[]): ReadonlyMap<string, V> | undefined;
  render(value: V): { text: string; icon?: IconName; accessibleText: string };
  // with its first reader of plant time (piece 1): render(value: V, host: { time: PlantTime })
  Hover?: ComponentType<{ id: string }>;             // hover card content; may fetch (ADR 0030)
}): FieldImpl<S>;
export function item<S extends SlotOfKind<"item">>(slot: S, impl: {
  icon: IconName;
  useBadge(props: SlotProps[S]): { count: number; accessibleText: string } | null;
  Content: ComponentType;
}): ItemImpl<S>;
export function banner<S extends SlotOfKind<"banner">>(slot: S, impl: {
  layouts: readonly ("plant" | "settings" | "station")[];   // settings: company settings at /settings/$companyId
  useBanners(props: SlotProps[S]): readonly BannerSpec[];
}): BannerImpl<S>;
// later, with the action kind and planning/order/actions/v1
export function action<S extends SlotOfKind<"action">, C extends CommandContract>(slot: S, impl:
  | { command: C; input(props: SlotProps[S]): InputOf<C> }   // the host confirms, runs and shows the command's errors
  | { href(props: SlotProps[S]): string }                    // from a link builder
): ActionImpl<S>;

export interface BannerSpec {
  readonly id: string;
  readonly severity: "info" | "warning" | "error";
  readonly text: string;
  readonly link?: { readonly label: string; readonly href: string };   // href from a link builder
  readonly dismiss: "never" | "session";
}

export function useHost<S extends SlotId>(slot: S): {
  readonly props: Readonly<SlotProps[S]>;            // ids and declared scalars
  readonly plant: { readonly id: string; readonly slug: string } | null;
  readonly layout: "plant" | "settings" | "station";
  readonly size: "compact" | "regular";              // measured from the contribution's container
  readonly time: PlantTime;                          // usePlantTime()
  can(permission: PermissionId): boolean;            // usePermission(); display only, the server checks again
  live<Q>(query: TypedDocumentNode<Q>, changed: TypedDocumentNode<unknown>, vars: object): Q | undefined;
  announce(text: string): void;                      // announce()
};

// maintenance/web/src/module.tsx
export default defineWebModule({
  id: "maintenance", version, northmesRange, permissions,
  contributions: {                                   // keys equal the manifest's web.contributes ids
    "maintenance.tool-due-field": field("planning/board/block-fields/v1", toolDueField),
    "maintenance.tools-panel": region("planning/order/panels/v1", ToolsPanel),
  },
});
```

* `useHost` adds the slot's props, layout, size and `live`. Its `time`, `can` and `announce` delegate to the existing `usePlantTime()`, `usePermission()` and `announce()` ([06 web and UX](../plan/06-web-and-ux.md#shared-web-packages)), so a module page and a contribution share one implementation. Release 1 builds `useHost` with `props` only; each other member arrives with its first reader.
* A field's `render` is synchronous and the owner calls it once per item, so it cannot call a hook, `useHost` included. The owner calls `usePlantTime()` once in the contribution's loader component and passes the result as `render(value, { time })`. That argument follows the same rule as the members of `useHost`: piece 1 builds it for its first reader, the Pyramid connector's header line "Pyramid data as of {time}", if M-31 gives the connector a remote. Until then, `render` takes the value only.
* Data comes from the per-plant Apollo client that the shell provides. Documents are typed against the module's `dependsOn` closure ([06 web and UX](../plan/06-web-and-ux.md#rules-the-shell-and-ci-enforce)). A contribution queries its own prefixed root fields, so the owner's queries and codegen do not change when a plugin is added.
* `live` runs a query, subscribes to a change field that carries ids ([ADR 0018][adr-0018]) and refetches on each event. The host closes the subscription on a plant switch, while the board is paused, and while the contribution is hidden in an overflow menu. Each live contribution costs one subscription per open page.
* Writes go through `useCommand(contract)` or `useCommandForm`, with the module's own commands.
* Links come from the target module's link builders, through `ModuleLink` ([ADR 0062][adr-0062]). The shell renders a banner's link the same way and drops a link whose `href` is not an app path.
* Components come from `@northmes/ui`, or from a stylesheet with the plugin's prefix ([ADR 0019][adr-0019]).
* `IconName` is `NavIconName` from the list in `@northmes/contracts` ([ADR 0067][adr-0067]). The host draws every icon, and a remote imports none. Every icon a contribution names must be on that list, so `TriangleAlert` and `Bell` join it in the task that first uses them.
* In release 1, one `SlotProps` map with each slot's kind lives in `@northmes/web-sdk`, where [ADR 0037][adr-0037] puts slot prop types. `field("planning/board/block-fields/v1", ...)` is therefore typed from end to end, a wrong id or kind fails to compile, and the `field` render type requires `accessibleText`.

### Placement and degradation

* The slot decides placement. A contribution never chooses a position and never uses `fixed` or `sticky` positioning in its own layout, so it cannot hide the focused element (WCAG 2.4.11). Dialogs, popovers and sheets from `@northmes/ui` keep their own positioning. A contribution reads `size` from `useHost` and draws for that size.
* Every contribution reflows at 320 CSS px (1.4.10), except inside table containers, which scroll ([ADR 0021][adr-0021]). It meets the target size of its layout: 24 px, and 44 px in the station layout through `--nm-target-min`.
* Contributions sort by the manifest `order`, then by id. A slot may cap its contributions: the aside docks one panel, and the top bar takes one item per module. Later, admins can order and hide contributions per slot through audited settings keyed by contribution id ([ADR 0051][adr-0051] rule 6).
* A hidden contribution stays reachable: a block field in the block detail, a top bar item in the navigation sheet's footer.
* Labels are plain strings in the manifest, so the shell can name a contribution even when its remote failed to load.
* The banner strip sits in the page flow under the top bar, so it scrolls with the page and never covers the focused element. It shows at most two banners in severity order (error, warning, info), then "Show n more". A banner holds plain text and at most one link, and only a `session` banner has a dismiss button. The strip has no live role: the shell announces each banner's text once through the polite region when it appears or changes, whatever its severity, as the station's Disconnected banner is announced ([ADR 0033][adr-0033]). The shell never repeats an unchanged banner. The shell's own banners use the same `BannerSpec` data: the restore notice, the AI budget states, a plant in onboarding and degraded health for admins.

| Situation | Result |
|---|---|
| A region or tab throws | its fallback inside its `WidgetFrame`, named by its label; focus moves to the fallback when it was inside ([06 web and UX](../plan/06-web-and-ux.md#failure-handling)); reported with stage `slot` |
| A field's `useValues` or `render` throws | the owner draws its items without that field and reports the contribution once, not once per item |
| An item throws | the shell draws a fallback control named by its label with "(unavailable)" at its place; the help menu keeps its place |
| A banner hook throws | no banner from that contribution; reported with stage `slot` |
| A remote fails to load | each of its contributions shows the fallback named by its manifest label; the module keeps its sidebar place with "(unavailable)" ([ADR 0019][adr-0019]) |
| A web-only plugin names a slot that no longer exists | status `incompatible`, and boot continues ([ADR 0037][adr-0037], M-13) |
| A server plugin names a command, payload version or event that no longer exists | boot stops and names the plugin and the point, as [ADR 0037][adr-0037] decides for validators |
| A validator throws or times out | the command is rejected, and a throw is masked as "Unexpected error." ([ADR 0037][adr-0037]) |
| A consumer fails | retried, then dead-lettered ([ADR 0014][adr-0014]) |
| A contributed field resolver throws | the field is null and the response carries an error |

### Versioning

* Every point carries its version in its name: slots end in `/vN`, a validator names its payload version, an event carries `schema_version`, and a contributed field depends on the entity's type name, its key and the exact types of its external fields.
* Within a version, an owner adds only optional fields to slot props. A contribution built against older props ignores the new ones.
* Validator payloads follow a stricter rule. An optional field that a validator reads would be absent on an older host, and the validator would pass everything, the failure internal research note 32 found. Within a payload version, an owner adds a field only in a minor release and only as a required field. An older validator ignores it, because the bundled Zod copy of a plain `z.object` strips unknown keys. Any other change adds a payload version.
* Events keep the stricter rule of [03 modules and extensibility](../plan/03-modules-and-extensibility.md#versions-and-compatibility-checks), where an added field counts as breaking.
* Any other change adds `vN+1`, and the owner serves both versions for one deprecation window, as [ADR 0037][adr-0037] decides for slots. This ADR extends the rule to payloads.
* `pnpm gen` keeps the slot id snapshot. In release 1 the snapshot also records each slot's kind.
* Later, `points.snapshot.json` adds validator payload schemas and consumed events, and CI fails when a point from the previous release disappears without a deprecation entry.
* In 0.x a plugin's range covers one minor version, so every minor upgrade excludes plugins built for the previous minor until they are rebuilt, and a server plugin then stops boot ([ADR 0038][adr-0038]). Later, `upgrade.sh` runs `northmes plugin check --image <tag>` against the new image's snapshot and names every plugin that needs a new build before it switches the tag. A rollback still returns to the previous site image ([ADR 0037][adr-0037]). Because point versions are explicit, that rebuild is usually a version bump.
* At 1.0, `@public` marks the supported points, a point version is removed only in a major release, and the image accepts a plugin when it serves every point version that the plugin uses.

### Isolation, trust and the plugin inventory

* Plugins run with full trust in the server process and in the page, as [ADR 0037][adr-0037] decides, and the docs and `SECURITY.md` say so. No third-party plugin runs on the pilot. The host object is a contract, not a sandbox.
* The limits that hold today stay: Postgres owner roles and row-level security, the composition rules, a permission on every field and `can()` on every command, the boot catalog, closure-schema codegen, the forbidden-bundle list, prefixed CSS and the CSP. This ADR adds one rule: the shell renders only the contributions that the manifest lists, and only at the slots they name.
* Each plugin gets an inventory, built from its manifest and its composed SDL. The manifest already lists its tables with their lifecycle classes ([ADR 0013][adr-0013]), so no migration needs parsing, and the remote build check has already compared the remote's contribution keys with `web.contributes`. The inventory lists the slots it fills, the commands it vetoes, the events it consumes, the fields it adds, and its permissions, roles, settings and tables. `pnpm plugin:check` prints it.
* The inventory is the plugin's declaration, checked against its registrations. A plugin's server code runs with full trust, so the inventory cannot show what that code does beyond its registrations.
* Later, at the first regulated sale, System health and `northmes config export` show the inventory, and its hash joins the configuration revision ([ADR 0051][adr-0051] rule 15).
* Later, with per-organization enablement, enabling a plugin shows its inventory, for example "vetoes planning.releaseProductionOrder", and the admin accepts it through an audited command ([ADR 0051][adr-0051] rule 7). Builds are then signed for the installations they run on.
* Later, with the public SDK, `plugin:check` refuses `createPortal` and global `document` queries in a plugin remote, without sandboxing anything.

### Permissions and roles

* NorthMES says permissions where the maintainer's role model says scopes. A scope in NorthMES is a company or plant node in the scope tree ([ADR 0007][adr-0007]).
* Each module and plugin declares its permissions in its manifest. Permission ids read `<module>.<entity>:<action>`, with the module's GraphQL name first: scopes such as `plan.edit` and `plan.create` in the maintainer's model become keys of the same form as `planning.productionOrder:read` and `planning.productionOrder:release`, and a plugin's keys start with its own name, such as `maintenance.tool:service`. `northmes migrate` syncs the keys into `core.permission`, and the catalog refuses a key with another module's prefix.
* Modules ship default roles. Company admins build custom roles, such as Operator, Planner, Admin or IT, from module permissions. Editing roles needs `core.role:manage` at company scope, and adding a permission to a role needs the editor to hold it where the role is assigned ([ADR 0010][adr-0010]).
* An assignment is `(user, scope node, role)`. An assignment at the company node applies to every plant below it, because `can()` walks from the plant up to the root. An assignment at a plant node applies to that plant only, so Planner at plant A and Operator at plant B are two assignments, and a user who is Planner company-wide and IT at one plant holds both roles at that plant.
* A user gets permissions only through roles, which [ADR 0066][adr-0066] records among Krister Johansson's decisions of 2026-10-05; nothing is prepared for direct grants of one permission to a user. A one-off grant becomes a custom role with one permission, so every grant appears in the role list and its audit, and the rule that an assigner holds every permission of the role keeps working (M-65).
* [ADR 0066][adr-0066] proposes that core's company admin role receives every installed permission, plugins' included, at each `northmes migrate`. That waits for Krister Johansson's answer to M-61, whose working default is yes. Under that default, installing a plugin gives its permissions to every company admin at once.
* At a station, the operator's permissions at that plant are intersected with the station's ceiling ([ADR 0033][adr-0033]).
* Each contribution carries a permission, and the shell filters on the current plant's permissions. A validator may call `ctx.can()` for an extra key, for example to decide what its veto may show, or the permission that a later `ask` requires for confirming. Later, a plugin may name the default roles that receive its permissions, and a company admin accepts or changes that through an audited command.
* Who may edit and assign roles at which scope stays open for the product owner ([ADR 0010][adr-0010]).

### Developer loop, plugin check and the agent skill

* In the workspace, `pnpm dev` ([ADR 0058][adr-0058]) runs one Vite dev server per remote, so web contributions hot-reload. A server change restarts the process after `tsc -b --watch` finishes, because Nest builds the schema once. An installation always restarts to enable or remove a plugin ([ADR 0037][adr-0037]).
* `pnpm plugin:check <id>` already prints the plugin's SDL, composes it against the snapshot and checks imports ([ADR 0037][adr-0037]). It also prints the inventory:

  ```text
  $ pnpm plugin:check maintenance
  maintenance 0.6.0 (northmes >=0.6.0-0 <0.7.0-0)
    validates    planning.releaseProductionOrder (payload 1)   maintenance.tool-due
    consumes     production_start.report.created v1
    fields       ProductionOrder.maintenanceToolDue
    contributes  planning/board/block-fields/v1                maintenance.tool-due-field
                 planning/order/panels/v1                      maintenance.tools-panel
    commands     maintenance.setToolDue, maintenance.recordCycles
    permissions  maintenance.tool:read, maintenance.tool:service
    tables       maintenance.tool_due
  0 errors, 0 warnings
  ```

* It fails on an unknown slot or point, or a version that the snapshot does not hold; a contribution id without the module's prefix, or a missing label or permission; a permission that the module does not declare; and an owner missing from `dependsOn`. A deprecated slot produces a warning that names the release that removes it.
* The remote build check that `plugin:build` runs fails on an implementation whose kind differs from the slot's kind, and on a manifest entry without an implementation or an implementation without a manifest entry.
* Release 1 tests the examples through the decided paths: the command bus unit tests, the built server booted in a child process on Testcontainers Postgres, the `plugin-outside` end-to-end spec, and the accessibility route suite with the example plugins enabled ([ADR 0037][adr-0037]). Web unit tests run in happy-dom ([ADR 0041][adr-0041]), so the 320 px reflow check stays in the Playwright media runs ([ADR 0021][adr-0021]).
* A project skill, `.claude/skills/northmes-plugin/`, written with writing-for-agents, sits beside the project skills that [ADR 0049][adr-0049] plans. It maps a need to a point: showing data on another module's page goes to a region or a field, stopping a command to a validator, reacting to a change to a consumer, and adding data to another module's type to a contributed field. For each point it holds or links the recipe that [ADR 0022][adr-0022] requires the point's task to write (the files, the commands, and each boot or composition error with its meaning). It ends with the loop: a failing test, the implementation, `pnpm plugin:check`, then `pnpm check`. It links the slot snapshot instead of copying the point list. The skills test of [ADR 0063][adr-0063] must allow it, and handoff's library group `northmes` must import it before a graph names it.

### Release 1 pieces

Release 1 builds nine pieces. A release 1 feature reads each piece in the task that adds it.

| # | Piece | Read by |
|---|---|---|
| 1 | Slot kinds `region` and `field` in the owner's `web.slots`; `<Slot>` renders by kind; the block-fields rule becomes the `field` kind, with its hover renderers, which the board header uses too; `render`'s `{ time }` argument with its first reader | planning's board and order page tasks; the Pyramid connector's header line and block fields, if M-31 gives the connector a remote |
| 2 | The id `core/shell/aside/v1` for the shell aside, kind `region`, one docked | the AI chat panel; if M-39 leaves the panel in the shell, the shell mounts it there directly; it waits with the panel if item 7 of the cut order is cut ([ADR 0055][adr-0055]) |
| 3 | Contribution data in `web.contributes`, implementations keyed by id in `defineWebModule`'s `contributions` in place of `widgets`, `useHost(slot)` with `props` only, and the checks that both sides match (the remote build check and `validateWebModule`) | production-start's order panel, `example-widget`, the Pyramid connector's fields (M-31) |
| 4 | `validates` in the manifest, read by boot step 4, with the owner's time limit per validatable command | `example-validator` |
| 5 | `consumes` in the manifest, read by the sequencer | Pyramid write-back |
| 6 | A veto carries the validator's code, details and the server-rendered message in the `details` of `core.command_rejected` | the planning screen that releases an order, and the example end-to-end spec of the `plugin-outside` job |
| 7 | `pnpm plugin:check` prints the inventory | the example plugins in CI (milestone M2, [ADR 0037][adr-0037]) |
| 8 | The slot id snapshot records each slot's kind | the slot snapshot check in CI |
| 9 | One recipe per point, held in the `northmes-plugin` skill, grown recipe by recipe | each task that builds a point ([ADR 0022][adr-0022]) |

Pieces 2, 4, 5 and 6 close the four gaps listed in the context. Pieces 4 and 6 land with the validator plugin, which is part of the walking skeleton's exit (target 2026-11-13, [03 modules and extensibility](../plan/03-modules-and-extensibility.md#the-two-example-plugins)). The tasks that build pieces 1 to 6 link this ADR, and a task moves to Ready only when every ADR it links is accepted ([ADR 0055][adr-0055]), so this ADR sits on the skeleton's path. M-68 asks Krister Johansson to confirm that. Under its working default, yes, the plan lists this ADR in the E02 list of the M0 checklist in [the plan README](../plan/README.md#adrs-needed-by-m0) and of the M0 row in [14 roadmap](../plan/14-roadmap.md#milestones-under-option-b), and in the ADR lines of E02, E02-S04 and E21-S01. If the answer is no, pieces 4 and 6 move after the skeleton, E02-S04 keeps the veto shape of [ADR 0037][adr-0037], and this ADR leaves those lists. Each piece needs a row in the ledger of [ADR 0055][adr-0055], listed under [Changes to ADR 0055](#changes-to-adr-0055) and open as M-62.

D2 needs no built slot beyond these pieces; [D2 coverage](#d2-coverage) lists what it draws.

### Later items and their triggers

| Later item | Trigger |
|---|---|
| `ValidatorContext` (`ctx`) for validators | the first validator that reads anything beyond its payload |
| `validatorHarness`, `mountContribution`, `consumerHarness` and `renderSlot` in `@northmes/testing` | the first validator or contribution outside the examples, or the public SDK |
| `plugin:check --json` | its first machine reader (`upgrade.sh` or `config export`) |
| `item` kind and `core/top-bar/items/v1` | the notifications module ([ADR 0067][adr-0067]); on company settings pages its props carry no plant, so the bell's count there needs plant-free fields (M-66) |
| `banner` kind and `core/shell/banners/v1` | the first module banner; the candidate is the AI budget banner if M-31 gives the `ai` module a remote (M-63) |
| `tab` kind and `planning/order/tabs/v1` | the first contributor that needs more room than a panel |
| `planning/orders/columns/v1` | the first contributor with data in the orders list |
| `action` kind and `planning/order/actions/v1` | the first contributed command on another module's entity |
| `production-start/station/panels/v1` | a second module at the station |
| Opt-in tabs and columns on master-data kit pages | the first contributor to a core register page |
| `settingsRoutes` for modules other than core | the first company settings page of a module other than core ([ADR 0066][adr-0066]) |
| Onboarding steps from plugins | a plugin that needs values before a plant opens ([ADR 0066][adr-0066] refuses the key in a plugin) |
| A settings page rendered from a server-only plugin's schema | the first server-only plugin with settings |
| `ctx.data`, plugin consumers that run commands, jobs as a system principal | the first plugin that keeps state ([ADR 0037][adr-0037]) |
| A causation depth limit on consumer commands | the first consumer whose commands raise events it consumes |
| The `ask` verdict with confirmed codes, a reason and an optional override permission | the first rule a planner may override, or the first station advisory ([09 operator station](../plan/09-operator-station.md)) |
| Answer points | the first replaceable port: the autoplan strategy or number series |
| An `extensions` input on owner commands and a form field slot | the first field on another module's form |
| The `command.rejected` security event, validator ids and versions on the audit row, the inventory in `config export` | the first regulated sale ([ADR 0051][adr-0051] rule 15, M-67) |
| Admin-managed order and hiding as audited settings | two contributions in one slot and a request to reorder |
| `points.snapshot.json` with payload and event schemas, and `northmes plugin check --image` in `upgrade.sh` | the first upgrade of an installation that runs a plugin built outside the repository |
| Slot types through declaration merging in owners' contracts; the DOM rule in `plugin:check` | the public SDK |
| Enablement that shows the inventory; signing per installation | a third-party plugin on a customer installation, or two companies on one installation |
| `northmes plugin dev`, `create-northmes-plugin` (which copies the skill), `northmes plugin add`, a catalog | after the pilot ([ADR 0037][adr-0037]); the catalog after 1.0 |
| `grants` of plugin permissions to module default roles | the first plugin whose permissions belong in a module's default role |
| MCP tools from plugins, in a toolset named after the plugin, off by default, outside planning's limit of eight tools ([ADR 0034][adr-0034]) | the first plugin tool |
| `@public` points and compatibility by point catalog | 1.0 |
| Dashboard widgets | M-32 |
| A point kind with an owner-marked `next` chain | a need that validators, consumers, contributed fields and answer points cannot meet |

### D2 coverage

Krister Johansson approved the D2 spec page `shell/shell-190-navigation.dc.html` (issue northMES/northmes#190). The variations round had already chosen a strip under the top bar for banners ([shell-190-variations.md](../design/shell/shell-190-variations.md#decision)). The page draws part of what this ADR needs; the task named in the last column draws the rest when it builds its piece, so no task waits on D2.

| Item | Frames on the approved D2 page | Not drawn there, or drawn differently | Drawn by |
|---|---|---|---|
| Banner strip | One banner per frame in a strip under the top bar, in the info, warning and error tones, with at most one link: the restore notice (ST10, ST19), degraded health for admins (ST11, ST20), the AI budget warning (ST12, ST21) and exhausted (ST13, ST22), and a plant in onboarding (ST36, ST37). ST33 and KE23 record that the strip has no live role and that its text goes once through the polite region | Two or more banners in severity order with "Show n more"; the dismiss button of a `session` banner; a 320 px frame where the banner text wraps. D2 puts the strip inside the sticky block under the top bar (ST33, KE19, KE20), where this ADR puts it in the page flow (see below) | the first task that shows a shell banner and builds the strip from `BannerSpec` data: the plant gate banner of E06-S14, the AI budget banner of E13-S05, the readiness banner of E16-S02 or the restore banner of E18-S04, whichever runs first |
| Top bar items | The bell named "Notifications, 3 unread" with its badge (PL24, PL27), its popover (PL25, PL28, KE26, KE27), the fallback control named "Notifications (unavailable)" (PL40, PL41), the release 1 top bar without the bell (PL26, PL29), and at 320 px the bell in the navigation sheet's footer after the help menu (NA3, NA4) | The item's content opened from the navigation sheet's footer | the task that builds the `item` kind and `core/top-bar/items/v1` with the notifications module |
| Region fallback | `planning/board/side/v1` with its contribution "Large orders" failed: the fallback inside its `WidgetFrame`, headed by the label, with "Large orders could not be shown.", the stage, the code and Try again (ST27, ST28); ST33 holds the focus rules | The aside's fallback, docked and as a sheet | the chat panel's design task under E14-S03, whose panel mounts in `core/shell/aside/v1`; D3 reuses ST27 for the board side panel and the order panels |
| Build notes | KE23 records the bell's names "Notifications" and "Notifications, {n} unread", the fallback name "{label} (unavailable)", and the slot notes of `core/top-bar/items/v1` and `planning/board/side/v1` | The `BannerSpec` fields; the item name pattern "{label}, {badge text}" as a general rule; the aside id `core/shell/aside/v1`, which KE23 calls the shell aside | the banner strip task records `BannerSpec`; the `item` kind task records the name pattern; the task that builds piece 2 records the aside id |

Three differences between the approved page and this ADR have no open question. Where the page conflicts with a rule of an accepted ADR, this ADR keeps the rule and names the task that draws it; where the page made a free design choice, this ADR follows the page.

* The sticky strip: this ADR keeps the rule. D2 joins the strips and the top bar in one sticky block and sets the page scroller's `scroll-padding-top` to the block's height plus 8 px (KE19, KE20, the page's question K3). The page's question K4 notes that at 320 px two strips make that block about a third of the screen, and with the banners after "Show n more" open it can grow taller than the screen, so no padding keeps the focused element in view. That fails WCAG 2.4.11, which [ADR 0021][adr-0021] makes part of its target and tests as "focus not obscured" in its keyboard-only flows. The strip therefore sits in the page flow, the page scroller's `scroll-padding-top` stays the top bar's height ([06 web and UX](../plan/06-web-and-ux.md#focus-243-247-2411)), and the task named in the table's banner strip row draws it there.
* The error banner through the polite region: this ADR follows D2. The page gives the strip no live role and sends every banner's text once through the polite region (ST33, KE23). No accepted ADR makes an error banner an alert: [ADR 0021][adr-0021] provides the polite and assertive regions without assigning banners to either, and [ADR 0033][adr-0033] announces the station's Disconnected banner as `role=status`, once on change. An error banner is therefore announced like the others.
* The bell at 320 px: this ADR follows D2. The page puts the bell in the navigation sheet's footer after the help menu (NA3, NA4) instead of a More menu in the top bar. No accepted ADR places a top bar item on a narrow screen, so this ADR, [ADR 0067][adr-0067] and [06 web and UX](../plan/06-web-and-ux.md#shell-layout) put each item there. The task that builds the `item` kind and `core/top-bar/items/v1` draws the item's content opened from the footer.

### Parts of accepted ADRs this decision changes

The files below keep their text. Once this ADR is accepted, it holds over the parts listed here, and the rest of each ADR stands.

#### Changes to ADR 0037

[ADR 0037][adr-0037], plugins:

| Section | Before | After |
|---|---|---|
| Command validators | "It attaches only to a command its owner declares `validatable`, and only from a module whose `dependsOn` includes the owner" | Unchanged, and the module lists each validator in the manifest's `validates` with the command and payload version, which boot step 4 checks |
| Command validators | "Each has a time limit." | Each has a time limit, no longer than the limit the owner declares for the validatable command |
| Command validators | "A veto returns `core.command_rejected` with `rejectedBy`." | A veto returns `core.command_rejected` whose `details` carry `rejectedBy`, the validator's error code, its details and the message the server renders from the validator module's `defineErrors` |
| Command validators | "`CommandValidator` takes the schema from the contracts copy the plugin bundled" | `defineValidator({ id, payload, timeoutMs, check })` takes the schema from the contracts copy the plugin bundled; once a validator reads more than its payload, `check` also receives a `ValidatorContext` from `@northmes/sdk` |
| UI slots | "A contribution carries an id, the slot id, a component, a required `label`, a numeric `order` and a permission. `validateWebModule` rejects a missing label." | The id, slot, label, order and permission are static data in the manifest's `web.contributes`, and the remote supplies the implementation under the same id. The catalog check and `pnpm plugin:check` reject a missing label; `validateWebModule` rejects an implementation without a manifest entry, a manifest entry without an implementation and an implementation whose kind differs from its slot's kind |
| UI slots | "`<Slot>` renders each contribution in `WidgetFrame` as a section with `aria-labelledby`, inside its own error boundary." | `<Slot>` renders by the slot's kind: a `region` or `tab` contribution in `WidgetFrame` as a section with `aria-labelledby`, while in the `field`, `item`, `banner` and `action` kinds the host draws the contribution's data without `WidgetFrame`. Every contribution renders inside its own error boundary |
| UI slots | "Changing a slot's props means adding `v2` and keeping `v1` for one deprecation window." | Unchanged, except that an owner may add optional props within a version; a contribution built against older props ignores them |
| UI slots | "No slot renders a widget (`WidgetFrame` and error boundary) per board block or per row. The one exception is `planning/board/block-fields/v1`" | Every slot declares a kind. A `region` renders in `WidgetFrame` for the selected item only; a `field` returns a value per item that the owner draws, loaded once per slot instance, with an optional hover renderer that may fetch; block fields and the board header are `field` slots |
| UI slots | "A CI check fails when a slot id from the previous release's snapshot disappears." | Unchanged, and the snapshot also records each slot's kind |
| UI slots, release 1 slots | "filled by core, the Pyramid connector and plugins through `BoardFieldSlot`" | filled by core, the Pyramid connector and plugins through `field` contributions; the `field` kind takes the place of `BoardFieldSlot` |
| UI slots, release 1 slots | "one shell aside slot for the AI chat panel" | `core/shell/aside/v1`, kind `region`, at most one docked |
| The example plugins | "`pnpm plugin:check <id>` composes the plugin's SDL against the committed snapshot" | It also prints the plugin's inventory |
| Confirmation (slot tests) | "a contribution without a label fails `validateWebModule`" | A `web.contributes` entry without a label fails the catalog check and `pnpm plugin:check`; `validateWebModule` fails on an implementation without a manifest entry and on one whose kind differs from its slot's kind |

#### Changes to ADR 0019

[ADR 0019][adr-0019], web shell:

| Section | Before | After |
|---|---|---|
| Remote contract | "`defineWebModule({ id, version, northmesRange, permissions, routes(plantRoute), stationRoutes?, nav, widgets, typePolicies? })`" | `widgets` becomes `contributions`, a record keyed by contribution id; `nav` is already gone ([ADR 0062][adr-0062]) |
| Plant switch | "Nav items and widgets filter on the current plant's permissions." | Nav items and contributions filter on the current plant's permissions; a contribution's permission comes from its manifest entry |
| Serving | "`/api/web/modules` lists only enabled, permitted and compatible remotes, each with a SHA-384 hash of its `mf-manifest.json`." | Unchanged, and each module entry carries its contributions from `web.contributes` with id, slot, label, order and permission, so the shell names a contribution whose remote failed |
| Confirmation | "`validateWebModule` unit tests for each error case, including a contribution without `label`" | `validateWebModule` unit tests for each error case, including an implementation whose kind differs from its slot's kind and a manifest entry without an implementation |

#### Changes to ADR 0062

[ADR 0062][adr-0062], web form contracts, URL view state and module link manifests:

| Section | Before | After |
|---|---|---|
| Parts of accepted ADRs (remote contract) | "`defineWebModule({ id, version, northmesRange, permissions, routes(plantRoute), stationRoutes?, widgets, help?, typePolicies? })`" | `widgets` becomes `contributions`, keyed by contribution id |

#### Changes to ADR 0055

[ADR 0055][adr-0055], release 1 scope. Under the scope rule, "An item enters release 1 only by the maintainer's decision, recorded in this ADR's ledger table". Each release 1 piece of this ADR has a release 1 reader in the task that adds it, so the planning session proposes nine rows; they enter the ledger only when Krister Johansson confirms them (M-62).

| Section | Before | After |
|---|---|---|
| Decision outcome (ledger additions) | "Additions from the stress test, which the maintainer still confirms:" and a table of seven additions | The table also holds the nine rows below, which come from this ADR and not from the stress test. No source gives a figure for them, so each is not estimated until the stories of its reader are created, as for the epics that [14 roadmap](../plan/14-roadmap.md#epics-in-dependency-order) lists as not estimated |

| Addition | Estimate (raw days) |
|---|---|
| ADR 0068 piece 1: slot kinds `region` and `field`, `<Slot>` by kind, block fields and the board header as `field` slots | not estimated |
| ADR 0068 piece 2: the shell aside as `core/shell/aside/v1` | not estimated |
| ADR 0068 piece 3: `web.contributes` data, `contributions` by id, `useHost(slot)` with `props`, the matching checks | not estimated |
| ADR 0068 piece 4: `validates` read by boot step 4, with the owner's time limit | not estimated |
| ADR 0068 piece 5: `consumes` read by the sequencer | not estimated |
| ADR 0068 piece 6: veto details with the validator's code, details and rendered message | not estimated |
| ADR 0068 piece 7: the inventory in `pnpm plugin:check` | not estimated |
| ADR 0068 piece 8: slot kinds in the slot id snapshot | not estimated |
| ADR 0068 piece 9: the `northmes-plugin` skill, one recipe per point | not estimated |

### Consequences

* Good, because an owner can redraw its screens and change its internals without breaking plugins, since only declared, versioned points are contract.
* Good, because in the dense kinds the host draws, so accessible names, targets, live regions and overflow are built and tested once.
* Good, because the shell names and places a contribution whose remote failed, from manifest data.
* Good, because a plugin's veto reaches any screen with its message, and no screen imports the plugin's contracts.
* Good, because `pnpm plugin:check` shows what a plugin declares it touches before anyone installs it.
* Good, because each release 1 piece has a reader in the task that adds it, and everything else waits for a named trigger.
* Bad, because no plugin can rewrite another module's input or wrap its drawing; a need for that waits for a later point kind.
* Bad, because each web contribution's id appears in the manifest and in the remote, which the build check has to compare.
* Bad, because the inventory shows declarations, not what full-trust server code does beyond them.
* Bad, because any validator payload change other than a required field added in a minor release adds a payload version that the owner serves for a deprecation window.
* Bad, because each live contribution costs one subscription per open page.
* Bad, because this ADR sits on the walking skeleton's path while M-68 keeps the working default yes.
* Bad, because this ADR keeps the banner strip in the page flow where the approved D2 page draws it in a sticky block, so the task that builds the strip draws it again ([D2 coverage](#d2-coverage)).
* Neutral, because the `item`, `banner`, `tab` and `action` kinds are designed now and built with their first contributors.

### Confirmation

Test file names follow the existing layout and are proposed.

* `apps/server/test/catalog.test.ts` gains: "a validates entry without a registered validator exits 1 naming the module and the command"; "a registered validator without a validates entry exits 1"; "a validator whose timeoutMs is above the owner's limit exits 1"; "a consumes entry naming an event or version that no installed module declares exits 1".
* `packages/web-build/test/remote-check.test.ts` and `packages/web-sdk/test/validate-web-module.test.ts`: "an implementation whose kind differs from its slot's kind fails"; "a manifest entry without an implementation fails"; "an implementation without a manifest entry fails".
* `apps/server/test/rest/web-modules.int.test.ts` gains: "each module entry carries its contributions with id, slot, label, order and permission".
* `apps/web/test/slot.test.tsx`: "a contribution whose remote failed shows a fallback named by its manifest label".
* `apps/server/test/command-bus.test.ts` gains: "a veto's details carry rejectedBy, the code, the validator's details and the rendered message".
* `modules/planning/web/test/board-fields.test.tsx`: "a board whose block-field contribution throws in useValues draws every block without that field and reports one error"; and, in the task that builds `render`'s `time` argument, "a header field's render receives the board's usePlantTime() and prints an instant in the plant's zone".
* In CI, `pnpm plugin:check example-validator` prints the inventory line `validates planning.releaseProductionOrder (payload 1)`.
* The slot snapshot check in CI fails when a slot's kind changes without a new version.

## Pros and cons of the options

The planning session scored the three designs from 1 (poor) to 5 (strong). It did not check the scores against the designs' own documents.

| Criterion | Declarative | Chain | Hybrid |
|---|---|---|---|
| Upgrade stability for on-prem plugins | 5 | 3 | 4 |
| Accessibility | 5 | 3 | 4 |
| Security and permissions | 4 | 4 | 4 |
| Audit and regulated readiness | 4 | 5 | 4 |
| Fit with the accepted ADRs | 4 | 2 | 5 |
| Plugin author experience | 4 | 3 | 4 |
| Closeness to Claude Code's mods | 3 | 5 | 3 |
| Cost under the release 1 scope rule | 4 | 2 | 4 |
| Total | 33 | 27 | 32 |

### Declarative points

* Good, because the host draws the dense kinds, so accessibility and overflow live in one place and an owner can redraw its screen.
* Good, because explicit kinds and versions give the best upgrade story.
* Bad, because the compared draft prefixed permission keys with the kebab-case id, wrote icon names in lowercase and put a plugin in one package; this ADR fixes all three.
* Bad, because it is further from Claude Code's mods than the chain design.

### An owner-marked chain

* Good, because it is the closest to Claude Code's mods and has the best audit trail.
* Bad, because it puts pipeline steps 7 to 9 of [ADR 0012][adr-0012] inside the validator chain's `next`, so plugin code runs after the handler's writes, inside the transaction of every release.
* Bad, because several plugins in one chain need ordering rules between them, which [ADR 0037][adr-0037] rejected, and a chain on commands either wraps the handler or adds nothing to a veto.
* Bad, because it needs a chain runner with time budgets and result checks on both sides before any release 1 feature needs one.

### Hybrid lists with adornments

* Good, because it fits the accepted ADRs best and has the clearest host object.
* Bad, because its lists let a plugin place an item `after` another module's item and adorn the owner's items, which ties plugins to item ids that nobody versions.
* Bad, because its top bar item draws its own control, so accessible names and narrow placement move into each plugin.

### Smaller choices

| Question | Chosen | Left out | Reason |
|---|---|---|---|
| Where a contribution's label, order and permission live | manifest data, with code by id in the remote | inside the remote's `defineWebModule` | the shell needs them before the remote loads and when it fails |
| Observers inside the command transaction | none | an observer step beside validators | it would be a validator that always passes, with the time and failure cost of one |
| Block fields and list columns | one `field` kind | a kind each | both are a value per item, loaded in one batch and drawn by the owner |
| What a banner holds | plain text and at most one link from a link builder | a component | the shell owns live regions, order and reachability |
| Optional fields added to a validator payload | refused; a field is added only as required, in a minor release | allowed like slot props | an older host would leave it out and the validator would pass everything (internal research note 32) |
| Direct grants of one permission to a user | none; a custom role with one permission | a direct grant table | every grant stays in the role list and its audit (M-65) |
| `ValidatorContext` in release 1 | not built | built with the validator point | `example-validator` reads only its payload |
| The test kit (`validatorHarness`, `mountContribution`) in release 1 | not built | built with the examples | the bus tests, the child-process boot, the `plugin-outside` spec and the route suite already cover the examples, and happy-dom cannot check reflow |

## More information

* What the comparison took from other platforms:

  | Source | Taken | Left out |
  |---|---|---|
  | Claude Code's mods | one host object per side; named places with frozen props; placement decided by the host; the observe, deny and answer moves; a check that prints what a plugin touches; types that describe the running host; first-party features built on the same points; an authoring skill; hot reload for web contributions; places that are never extensible | the rewrite move and an answer that replaces the owner's behaviour; `next` chains; a render hook on every element; failing open; tiers of installers; reloading an installed plugin without a restart; plugin state outside its own audited schema |
  | VS Code | contributions as data the host reads before any code runs; fixed menu ids; no DOM access; commands as the API between modules | save participants that fail open within a shared time budget |
  | Shopify | named targets; one fixed result shape per target; a capability list the admin sees and accepts; validation on every surface | a Wasm sandbox; dated API versions |
  | Medusa | zones named by literals with a data prop; one handler per hook; context hooks as answer points; extra input on commands as a later `extensions` input; admin-managed layouts; slot types through declaration merging | compensation as the main consistency tool, because a NorthMES command runs in one transaction |
  | Backstage | extension points owned by the module they extend; a new name for a breaking change; tests on a real host with mocked services | endpoints that stay open until someone writes a policy |
  | Grafana | versioned ids; frozen context; every extension listed in the plugin manifest; a per-plugin limit per place; plugin roles granted to built-in roles; signatures bound to the installations they list | the opt-in frontend sandbox |
  | Sanity | a depth limit on event chains; the lesson that one plugin skipping the default breaks a render chain for the rest | render chains; validation that runs only in the browser |
  | Strapi | permission actions that the plugin declares | lifecycle hooks fired by storage effects; policies that let a request through when they return nothing |

* Related ADRs: [0003][adr-0003] the manifest, [0010][adr-0010] roles and `can()`, [0012][adr-0012] the pipeline and the error model, [0013][adr-0013] system principals and lifecycle classes, [0014][adr-0014] consumers, [0019][adr-0019] remotes, [0021][adr-0021] accessibility, [0022][adr-0022] recipes and the scope rule, [0030][adr-0030] block fields, [0037][adr-0037] plugins, validators and slots, [0038][adr-0038] ranges, [0051][adr-0051] rules 6, 7, 10 and 15, [0055][adr-0055] release 1 scope, [0062][adr-0062] link builders and the `tab` key, [0066][adr-0066] plant-free fields, onboarding steps and the company admin role, [0067][adr-0067] icon names and the top bar slot.
* Proposed ADRs edited in place with this ADR: [0003][adr-0003] (`web.slots` with kinds, `web.contributes` as objects, `validates`, `consumes`, the owner's validator time limit), [0012][adr-0012] (the `details` of `core.command_rejected` and the reserved `ask` verdict), [0014][adr-0014] (`consumes`), [0030][adr-0030] (the `field` kind) and [0067][adr-0067] (the `item` kind for the top bar slot). The changes that [ADR 0066][adr-0066] and [ADR 0067][adr-0067] list for ADR 0003 (the `onboarding` key, core's company admin role and `web.icon`) still apply.
* Open questions in [16 open questions](../plan/16-open-questions.md#design-points-from-the-plan-documents), each with its working default: M-62 the nine ledger rows (yes), M-63 the AI budget banner as the `ai` module's contribution (yes if M-31 gives the module a remote, otherwise the shell draws it from `BannerSpec` data and the slot waits), M-64 top bar items drawn from data (yes), M-65 roles only (yes), M-66 plant-free fields for the notifications module (decided when that module is shaped; until then only core declares them), M-67 the `command.rejected` security event and the validator record at the first regulated sale (yes, they wait), M-68 this ADR before the skeleton's validator story moves to Ready (yes). M-31, M-32, M-39 and M-61 stay open as before.
* Plan: [03 modules and extensibility](../plan/03-modules-and-extensibility.md) (manifest, validators, slots, the examples), [06 web and UX](../plan/06-web-and-ux.md#remotes-in-release-1) (the slot table, the contract, the banner strip), [14 roadmap](../plan/14-roadmap.md) (the M0 row, E02, E02-S04, E04, E06-S14, E08-S02, E13-S05, E14-S03, E16-S02, E18-S04, E21 and E21-S01).
* Revisit when a need arises that validators, consumers, contributed fields and answer points cannot meet, when the first plugin is built outside the repository for a customer, when the public SDK is prepared, and at 1.0.

[adr-0003]: 0003-module-package-shape-and-the-definemodule-manifest.md
[adr-0007]: 0007-tenancy-company-plants-and-the-scope-tree.md
[adr-0008]: 0008-row-level-security-with-transaction-local-scopes.md
[adr-0010]: 0010-identity-with-better-auth-roles-and-permissions-in-core-tables.md
[adr-0012]: 0012-commands-as-the-single-write-path.md
[adr-0013]: 0013-audit-trail-written-in-the-command-transaction.md
[adr-0014]: 0014-outbox-event-log-and-pg-boss-jobs.md
[adr-0016]: 0016-graphql-list-conventions-connections-relations-filter-sort-search-and-group-by.md
[adr-0018]: 0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md
[adr-0019]: 0019-web-shell-with-react-module-federation-remotes.md
[adr-0021]: 0021-accessibility-target-wcag-2-2-aa.md
[adr-0022]: 0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md
[adr-0030]: 0030-a-planning-board-built-in-house.md
[adr-0033]: 0033-online-operator-station-in-the-production-start-module.md
[adr-0034]: 0034-mcp-surface-one-endpoint-a-read-mostly-planning-toolset.md
[adr-0037]: 0037-plugins-drop-in-packages-command-validators-and-ui-slots.md
[adr-0038]: 0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md
[adr-0041]: 0041-test-strategy-tdd-vitest-projects-testcontainers-and-playwright.md
[adr-0049]: 0049-delivery-workflow-handoff-thin-vertical-slices-and-claude-design-per-task.md
[adr-0051]: 0051-regulated-readiness-no-regret-rules.md
[adr-0055]: 0055-release-1-scope-under-option-b-and-the-scope-rule.md
[adr-0056]: 0056-mit-sdk-packages-the-extension-exception-and-the-trademark-policy.md
[adr-0058]: 0058-developer-environment-source-exports-one-stack-script-and-one-gate-command.md
[adr-0062]: 0062-web-form-contracts-url-view-state-and-module-link-manifests.md
[adr-0063]: 0063-agent-skills-from-library-authors-pinned-in-the-repository.md
[adr-0066]: 0066-companies-created-by-the-cli-plant-slugs-unique-per-installation-company-settings-at-settings-and-an-onboarding-wizard-before-a-plant-opens.md
[adr-0067]: 0067-plant-switcher-across-companies-nav-icons-by-lucide-name-and-a-top-bar-slot.md
