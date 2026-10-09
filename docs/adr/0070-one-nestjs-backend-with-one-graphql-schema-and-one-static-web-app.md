---
status: "proposed"
date: 2026-10-09
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: Krister Johansson; internal research note 02; the planning session's design study of main at 4cb2429
informed: NorthMES contributors and coding agents
release: "1"
needs-confirmation: "maintainer (the cost limit that replaces Hive demandControl; the carrier for plant permissions, presentation values and the station mount); pilot IT (browser versions); lawyer (the ADR 0056 bundling clause for plugin web code built into apps/web)"
---

# One NestJS backend with one GraphQL schema and one static web app

## Context and problem statement

[ADR 0015][adr-0015] composes a subgraph per module in an embedded Hive Gateway, against the advice of internal research note 02, and [ADR 0019][adr-0019] loads module web code as Module Federation remotes at run time. On main at 4cb2429 that is 46 files with 2,395 lines, while nothing measured needs a module to scale or ship alone. On 2026-10-08 and 2026-10-09 Krister Johansson chose one backend and one web app. This ADR covers both apps, the module folders and the plugin rules.

## Decision drivers

* One developer with coding agents builds the pilot ([ADR 0002][adr-0002]); custom glue costs build and test time.
* Module boundaries stay enforced without a schema or process per module.
* ADR 0028's pilot budgets, not yet measured, need no per-module request scaling.

## Considered options

* One NestJS backend with one code-first schema on GraphQL Yoga, and one static web app
* HTTP subgraphs behind Hive Gateway, with Module Federation remotes
* The current shape of ADR 0015 and ADR 0019

## Decision outcome

Chosen option: "One NestJS backend with one code-first schema on GraphQL Yoga, and one static web app", because it keeps the module seams with standard pieces, for about 2 to 3 working days of mostly deletion (estimate). Once accepted, it supersedes ADR 0015 and ADR 0019.

### Backend

* `apps/backend` replaces `apps/server`: one NestJS 12 app with the roles of ADR 0002, module code in `apps/backend/src/modules/<id>`.
* `@nestjs/graphql` 14.0.2 code-first builds one schema at `/graphql`, which GraphQL Yoga 5.24.1 serves over HTTP, graphql-ws and SSE. A small driver mounts Yoga until `@graphql-yoga/nestjs` 4.0.0 can be adopted on 2026-10-19.
* A field across modules is a `@ResolveField` calling the owner's public api through `loaderFor`. graphql-js refuses duplicate type names; shared types come only from `@northmes/sdk`.
* Boot exits 1 naming the field when a root field does not start with its module's GraphQL name followed by an upper-case letter.
* Errors use `@nestjs/common`. `DomainError` extends Nest's `HttpException` and carries an `HttpStatus` with its `code`, `fieldErrors` and `details`; code that needs no NorthMES code throws Nest's built-in exceptions such as `NotFoundException`. The one exception filter maps every `HttpException` by its status.
* Kept from ADR 0015: masked errors, the graphql-armor limits, blocked suggestions, no introspection without a session, the permission guard with `@Public()`, the persisted-documents manifest, and GraphQL Inspector on `schema/api.graphql`, the one snapshot under `pnpm gen --check`. Hive `demandControl` goes.

### Modules and boundaries

* Module web code lives in `apps/web/src/modules/<id>`. Module schemas, owner roles, row-level security and the command bus stay; the MIT contracts packages stay separate packages.
* A CI check in `pnpm check` fails when a module imports another module's code other than its public api, which is `public-api.ts` at the module's root.
* Inside `apps/backend/src/modules/<id>`, code splits by direction: `api/` for the inbound GraphQL surface (one folder per entity, its files grouped by kind), `core/` for domain services and command handlers, and `infrastructure/` for the database types and clients of other systems. `core/` never imports `@nestjs/graphql`, and `api/` never touches the database. `migrations/` stays at the module root.
* NorthMES's own modules carry no manifest. `AppModule` imports `CoreModule`, `PlanningModule` and the rest as plain Nest modules in dependency order, they take the backend's version, boot reads their migrations from `src/modules/<id>/migrations`, and the command contract's `validatable` flag ([ADR 0017][adr-0017]) marks the commands a plugin may validate. `defineModule` and the catalog check stay for drop-in plugins ([ADR 0037][adr-0037]).

### Web

* `apps/web` is one Vite React app built to static files. `src/modules.ts` imports each module into one TanStack Router tree with lazy routes, one chunk per module. A runtime `config.json` holds the API URL. Any static host serves the build, and the backend serves no web files; in the pilot's Compose stack Caddy serves it and proxies `/graphql`, `/api` and `/health` to the backend.
* Kept from ADR 0019: mount points `/$plant` and `/station/$stationId`, no SSR, one Tailwind sheet from `@source` lines, the browser floor and the strict CSP.
* The module list and `/modules/<id>/<version>/` go. Plant permissions, presentation values and the station mount need another carrier.

### Plugins

* Server plugins stay drop-in ([ADR 0037][adr-0037]). In release 1 plugin web contributions are built into `apps/web` under [ADR 0068][adr-0068]'s slots, so `example-widget` becomes a build-time example.
* A plugin adds root fields and types prefixed with its GraphQL name. It may add a field to a core type when the name carries that prefix, the field is nullable and it is read-only (output types only); the boot check enforces this. How a drop-in plugin reaches core's type class is untested until the first such field.

### Paths to grow later

* Federation for one module behind a gateway. Guard: the root-field prefix, one owner per type name, and fields across modules only through the owner's public api.
* Module Federation for plugin screens. Guard: plugin web code reaches the shell only through ADR 0068's slots and imports only MIT packages.
* Per-module request scaling. Guard: stateless `api` replicas plus the federation guards.
* An `ingest` role for Data collection. Guard: boot starts modules and endpoints by role (ADR 0002), so a role is a row, not an app.
* A database per module. Guard: no module reads another's tables, and foreign keys cross schemas only where the owner grants `references`.

### Parts of accepted ADRs this decision changes

ADRs 0010, 0017, 0021, 0022, 0023, 0038, 0039, 0043, 0051, 0052 and 0064 change only by this rule: read `apps/server`, remote, subgraph, supergraph and gateway as `apps/backend`, module web code, the module's part of the schema, the schema and Yoga, and drop rules and tests that exist only for remotes, the module list or composition.

#### Changes to ADR 0002

Role `api` serves the one schema and no web files. Boot runs the root-field check instead of the isolation check and composition, and the degrade rules for remote files go.

#### Changes to ADR 0003

Module code moves from packages to the folders above, and an in-repo module has no `northmes.module.ts`. The remote name, static path, per-module `schema.graphql`, isolation check and remote build check go. The manifest's `commands` field goes as well: a command's contract says whether a plugin may validate it ([ADR 0017][adr-0017]), and the longest validator time limit that the `commands` entry carried belongs on the contract once validator time limits are built.

#### Changes to ADR 0010

The web signs in with a bearer session instead of a session cookie, because the web and the API may be on different sites, where browsers block a third-party cookie. Better Auth's bearer plugin hands the session token to the web, which keeps it in the tab's `sessionStorage` and uses it only to mint five-minute JWTs from `/api/auth/token` (the jwt plugin); every API request carries the JWT. A session lives 12 hours and renews after an hour of use, so it works as the web's refresh token. The API answers CORS only for the `webOrigins` in `northmes.config.json` and never with credentials, so the cookie cache and `SameSite=Strict` go. The guard checks the JWT's session and the user's ban through a cache of at most 60 seconds, which keeps the 60-second bound for a ban or a revoked session (#407). Rotating refresh tokens come with Better Auth's OAuth provider plugin, together with the OAuth integration API.

The web signs in with email and password only (#414); Better Auth's username sign-in path is off, and every user created on the web has an email. People without an email address, such as operators, sign in with their badge at the operator station. The username stays as the user's never-reassigned handle.

#### Changes to ADR 0012

`DomainError` extends `HttpException` from `@nestjs/common` and takes a `status` (`HttpStatus`) instead of `kind`; `defineErrors` declares a status per code. The seven kinds map to 400, 401, 403, 404, 409, 412 and 503, and GraphQL `extensions.code` comes from the status. Code that needs no NorthMES code throws Nest's built-in exceptions, such as `NotFoundException` or `ForbiddenException`, and the filter answers them like a `DomainError` without `errorCode`.

#### Changes to ADR 0016

A reference to another module's entity is a plain field, not a Federation reference. The drift test goes, and `@listSize` pricing waits for a cost limit.

#### Changes to ADR 0018

Yoga sets `x-northmes-build` with the schema hash. The module list reload trigger and the `_entities` fan-out note go.

#### Changes to ADR 0020

Module routes join the one router at build time. Code-based routes and the one Apollo cache stay. GraphQL Code Generator reads the one printed schema instead of a closure schema per web package. Each operation sits in its own `<operation>.graphql.ts` file, as the web naming rules ask, and its typed document is generated next to it as `<operation>.graphql.gen.ts`. Enums are string-literal unions until a shared base-types output can hold const enums once for every operation file, and data masking comes with the first colocated fragment.

#### Changes to ADR 0037

A plugin ships no `web/dist`, and `HOST_PROVIDED` drops `@apollo/subgraph`. The `@requires` field of `example-validator`, which has no story, and the composition in `plugin:check` go.

#### Changes to ADR 0044

Caddy serves the web build with its `config.json` and the strict CSP, and proxies `/graphql`, `/api` and `/health` to `app`. While `app` is down the maintenance page answers the proxied paths, so the stack test checks it on `/health/ready` instead of `GET /`.

#### Changes to ADR 0056

`@northmes/web-build` leaves the MIT list. The bundling clause names it, so its wording for plugin web code built into `apps/web` waits for the lawyer.

#### Changes to ADR 0058

`pnpm dev` runs the Nest watch and one Vite dev server. The per-remote servers and the Rsbuild exit go.

#### Changes to ADR 0061

The plant's presentation values leave the module list; their carrier is open.

#### Changes to ADR 0062

`src/modules.ts` imports `defineWebModule` instead of loading it by URL. Link manifests and the path-literal lint stay; the bundle guards, the Zod copy per remote and the N-1 remote rule go.

### Consequences

* Good, because 2,395 lines leave and about 800 change (estimate), and a field across modules needs no `entityRef` stub.
* Bad, because a plugin with web code needs a web build, which ADR 0037 rejected; ADR 0037 expects no third-party plugin on the pilot.
* Bad, because every replica serves the whole schema, web parts no longer ship per module, and `demandControl` needs a replacement.

### Confirmation

* Boot tests: a module root field without its prefix, and a plugin field on a core type without the plugin's prefix or non-null, each exit 1 naming `Type.field`.
* Boundary fixtures: an import of another module's internal file fails `pnpm check` in both apps; the same import through the public api passes.
* `pnpm gen --check` covers `schema/api.graphql`.
* The four graphql-ws and SSE subscription tests pass on `/graphql`.
* The guard test of plan 05 that refuses a document over `maxCost` stays and runs against the cost limit the maintainer picks; until then the depth and alias limits of graphql-armor are the only document limits.

## Pros and cons of the options

### One NestJS backend with one code-first schema on GraphQL Yoga, and one static web app

* Good, because Yoga serves SSE, the fallback of [ADR 0018][adr-0018], which the Apollo driver's docs do not show.
* Bad, because plugin screens need a build.

### HTTP subgraphs behind Hive Gateway, with Module Federation remotes

* Good, because plugin remotes stay drop-in and requests scale per module.
* Bad, because it keeps composition rules and the Module Federation shell, adds a gateway, and costs about 12 pull requests (estimate).

### The current shape of ADR 0015 and ADR 0019

* Good, because it is on main.
* Bad, because it keeps the 2,395 lines and the five traps ADR 0015 lists for its pinned versions.

## More information

* The index marks ADR 0015 and ADR 0019 superseded by ADR-0070 when this ADR is accepted. Proposed ADRs 0011, 0024, 0031, 0045, 0057, 0066, 0067 and 0068, the plan and the project skills follow.
* Related ADRs: [0002][adr-0002], [0015][adr-0015], [0018][adr-0018], [0019][adr-0019], [0037][adr-0037], [0068][adr-0068], [0071][adr-0071] (jobs).
* Revisit when one module's requests must scale alone, or a customer needs plugin screens without a rebuild.

[adr-0002]: 0002-modular-monolith-with-module-owned-schemas-and-process-roles.md
[adr-0012]: 0012-commands-as-the-single-write-path.md
[adr-0015]: 0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md
[adr-0017]: 0017-zod-contracts-as-the-single-source-for-inputs.md
[adr-0018]: 0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md
[adr-0019]: 0019-web-shell-with-react-module-federation-remotes.md
[adr-0037]: 0037-plugins-drop-in-packages-command-validators-and-ui-slots.md
[adr-0068]: 0068-extension-points-declared-by-their-owners-contributions-as-manifest-data-with-code-by-id-and-a-plugin-inventory.md
[adr-0071]: 0071-jobs-on-bullmq-with-valkey-and-the-postgres-outbox-as-the-record.md
