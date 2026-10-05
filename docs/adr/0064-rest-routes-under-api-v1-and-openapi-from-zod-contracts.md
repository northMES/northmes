---
status: "accepted"
date: 2026-10-05
decision-makers: Krister Johansson
consulted: Krister Johansson
informed: contributors, coding agents, module and plugin authors
release: "1"
needs-confirmation: ""
---

# REST routes under /api/v1 and OpenAPI from Zod contracts

## Context and problem statement

Core, the modules and the plugins come from separate packages, and each adds Nest controllers to the one route table in `apps/server` ([ADR 0002][adr-0002], [ADR 0037][adr-0037]). Before this decision, the plans placed release 1's few REST routes, which only the shell, the remotes and the stations call, at `/api/web/modules`, `/api/web/client-errors`, `/api/station` and `/api/ai/chat`, left the Pyramid upload's path open, and mounted Better Auth at `/api/auth/*`. The integration REST API for outside systems comes later, with tokens bound to a scope node, OpenAPI generated from the Zod contracts and an oasdiff check in CI ([ADR 0031][adr-0031], [ADR 0017][adr-0017]).

No document said which routes carry a version, how a module's controller gets its path, what the OpenAPI document contains, which module owns an operation id or a component, how a breaking change is caught, or whether plugins may add controllers. Express also serves the first of two controllers registered on the same method and path, without an error.

A review of OpenAPI and URL versioning on 2026-10-05 recommended a version segment for the public API only. On 2026-10-05 Krister Johansson decided that every REST route lives under `/api/v<major>`, the first-party routes included, and that release 1 builds no Swagger tooling. The paths in the plans and in the proposed ADRs were moved to `/api/v1` the same day.

This ADR records that decision and the design the public API follows once its first route arrives. It covers `apps/server`, `@northmes/sdk/rest`, `@northmes/contracts`, the module contracts packages, the catalog and route checks at boot, core's plant slug schema, the Better Auth configuration and the shell's auth client, plugins, the later CI gate and the API reference on docs.northmes.dev. It changes parts of the accepted ADRs 0002, 0007, 0010, 0018, 0019, 0033, 0035, 0037, 0038, 0043, 0052, 0061 and 0062, listed under [Parts of accepted ADRs this decision changes](#parts-of-accepted-adrs-this-decision-changes). Those files keep their text, as the [ADR rules](README.md) require.

## Decision drivers

* Krister Johansson's decision of 2026-10-05: every REST route lives under `/api/v<major>`; probes, protocols and static mounts stay at the root.
* Outside callers need a contract that does not break silently. First-party callers ship in the same image and rely on build matching ([ADR 0038][adr-0038], [ADR 0019][adr-0019]).
* Controllers from separate packages share one route table, and CI never sees a plugin's routes, so boot is the only place that sees every route.
* The scope rule of [ADR 0055][adr-0055]: a platform feature is built when a release needs it, and release 1 has no outside system ([ADR 0031][adr-0031]).
* One schema per command serves the pipeline, GraphQL and REST, with the same field errors on every surface ([ADR 0017][adr-0017], [ADR 0062][adr-0062]).
* Every route resolves its principal through `PrincipalResolver` or is marked `@Public`, and the CSP is strict `'self'` ([ADR 0011][adr-0011], [ADR 0019][adr-0019]).
* Reserved module ids, reserved plant slugs and the rule on plugin controllers cost little before release 1; added later, they break plugins, bookmarks and link manifests.

## Considered options

* Every REST route under `/api/v<major>` in route families, with the path built by one SDK helper
* The public API only under `/api/v1`; first-party routes keep unversioned paths
* Every route under `/api/v1` through Nest's `setGlobalPrefix` and URI versioning
* No version in URLs; a version header

## Decision outcome

Chosen option: "Every REST route under `/api/v<major>` in route families, with the path built by one SDK helper", because Krister Johansson decided that every REST route carries the version, one rule then covers every REST path, the boot route check enforces that rule from the helper's metadata with a short root allowlist, and the compatibility promise stays on the public routes alone. The smaller choices inside it follow the review's recommendations; [Smaller choices](#smaller-choices) lists them with the options left out.

### Route families

Every REST route under `/api/v<major>/` belongs to one of three route families: public, first-party and library. Root routes stay at the root, outside the families.

| Family | Paths | Callers | Promise | In the OpenAPI document |
|---|---|---|---|---|
| Public API | `/api/v<major>/<module-id>/...` | outside systems | compatibility, under the breaking-change gate | yes; the only family in it |
| First-party | `/api/v<major>/web/*`, `/api/v<major>/station` and module routes such as `/api/v<major>/ai/chat` | the shell, the remotes and the stations from the same image | none; a route may change in any lockstep minor | never |
| Library | `/api/v1/auth/*`: Better Auth's `toNodeHandler` with `basePath: "/api/v1/auth"` | the shell's auth client | Better Auth's own | never |
| Root routes (outside the families) | `/health`, `/health/live`, `/health/ready`, `/graphql`, `/mcp`, `/modules/<id>/<version>/*`, `/assets/*` and the SPA paths `/`, `/$plant/...` and `/station/$stationId` | probes, GraphQL and MCP clients, browsers | as their own ADRs decide | never |

* Release 1 has no public route.
* A first-party route of a module sits under the module's id, as `/api/v1/ai/chat` and `/api/v1/pyramid-connector/import-file` do. Host first-party routes use the reserved segments `web` and `station`.
* First-party routes share the version segment and carry no promise. When the public API moves to v2, the first-party routes move to `/api/v2` in the same release, together with the shell.
* Root routes stay at the root because they are probes, protocols or static mounts, not REST API routes.
* `GET /api/v<major>/openapi.json` is a host route outside the families: it accepts a session cookie or an integration token, it is not listed in the document, and the route check allows it by name.
* `openapi.json` never collides with a module segment, because module ids match `[a-z][a-z0-9]*(-[a-z0-9]+)*` ([ADR 0003][adr-0003]).

The paths that move:

| Before | After | Family |
|---|---|---|
| `/api/web/modules` | `/api/v1/web/modules` | first-party |
| `/api/web/client-errors` | `/api/v1/web/client-errors` | first-party |
| `/api/station` | `/api/v1/station` | first-party |
| `/api/ai/chat` | `/api/v1/ai/chat` | first-party |
| the Pyramid XML upload, path not fixed | `/api/v1/pyramid-connector/import-file` | first-party |
| `/api/auth/*` | `/api/v1/auth/*` | library |

Better Auth defaults to `/api/auth`. The server sets `basePath: "/api/v1/auth"`, and the shell's `createAuthClient` passes the same `basePath`. Better Auth lets a path inside `baseURL` override `basePath`, so a `baseURL`, where one is set, is `NORTHMES_PUBLIC_ORIGIN`, which has no path ([ADR 0060][adr-0060]).

### How the path is built

* The server calls neither `app.setGlobalPrefix` nor `app.enableVersioning`.
* `@northmes/sdk/rest` exports `ApiController({ module, family })`, with `family` either `"public"` or `"first-party"`. It applies `@Controller("api/v<major>/<module>")` and records the family and the module segment as metadata. The handler decorators add the rest of the path.
* `@northmes/contracts` exports the current API major, `API_MAJOR`, and a path function, `apiPath`, so the shell, the stations and the remotes build first-party URLs from the value the server uses.

With a global prefix and URI versioning, the exclude list would have to name every root route, and a forgotten entry would move a route without an error. A path string built by the helper has neither problem, and the document shows exactly the path the server serves.

### The boot route check

The isolation check of boot step 8 already computes which classes each module root reaches. It also assigns each controller to the module root that reaches it, or to the host. A route check in step 10 reads the `ApiController` metadata and exits 1, naming the controllers, when:

* a controller path does not start with `api/v<major>/` and is not on the root allowlist, or a controller off the allowlist was not declared through `ApiController`;
* two controllers register the same method and path;
* a public controller's module segment differs from its owner's id;
* a controller is reachable from a plugin root, until the public API exists ([Modules and plugins](#modules-and-plugins));
* from the first public route on, an operation id or a component breaks the rules under [The public API](#the-public-api).

The root allowlist holds the root routes of the families table. A new root route needs a change to this ADR.

### Reserved module ids and plant slugs

* The catalog check (boot step 4) refuses the module ids `web`, `station` and `auth`, because they are first-party and library segments under `/api/v1`.
* The plant slug schema in core's contracts refuses `api`, `graphql`, `mcp`, `health`, `modules`, `assets` and `station`. A plant slug is the first segment of an SPA path, and these words are server paths or the station mount.

### Modules and plugins

* A module puts its public controllers in its `<Id>Module`, the manifest's `server` entry, under `modules/<id>/server/rest/v1/`. Their request and response schemas go in the module's MIT contracts package under `modules/<id>/contracts/src/rest/v1/`. No manifest key is added.
* Plugins add no REST controllers until the public API exists, and the route check refuses any controller reachable from a plugin root. CI never sees a plugin's routes and the route inventory test cannot list them, so boot is the only place that checks them. A restriction added after plugins ship would break them, and plugins already have a subgraph for their own data.
* Once the public API exists, a plugin adds only public routes under `/api/v<major>/<plugin-id>/`. `@nestjs/*` is already host-provided, so a plugin controller resolves the host's `@nestjs/swagger`. The converter runs in the host, so `zod-openapi` does not join `HOST_PROVIDED` ([ADR 0037][adr-0037]).

### The public API

These rules apply from the first public route on.

* There is one OpenAPI document per API major, built in `apps/server` from every module the process loads, with one tag per module. Modules publish no documents of their own. A module's first-party and public routes share `/api/v<major>/<module-id>/`, so the builder takes controllers by family, not by path; for example, `ApiController` applies `@ApiExcludeController()` to every first-party controller.
* The document is OpenAPI 3.1.0. The converter that `@nestjs/swagger` 12 calls for Standard Schema is built on `zod-openapi`. It checks `schema["~standard"].vendor` instead of `instanceof` ([ADR 0062][adr-0062]) and throws on any other vendor, so no OpenAPI 3.0 form lands in the document.
* An operation id starts with the module's GraphQL name followed by an upper-case letter, the rule `NORTHMES_ROOT_FIELD_PREFIX` sets for GraphQL root fields ([05 GraphQL and APIs](../plan/05-graphql-and-apis.md#composition-at-boot)). The helper sets it explicitly, because Nest's default depends on class names, and class names collide across packages.
* Component names come from `.meta({ id })`, and each id has one owning module, as `NORTHMES_TYPE_OWNERSHIP` requires for GraphQL types. Shared components (the problem, the field error, the time scalars, the unit enums and page info) come only from `@northmes/contracts` and must print identically, as `NORTHMES_SDK_TYPE_DRIFT` requires. The converter records a hash per component id and fails when one id converts to two different schemas.
* Writes are command routes: `POST /api/v<major>/<module-id>/commands/<command>`, with the command name in kebab case, the body `contract.input` and an operation id equal to the mutation name, for example `planningReleaseProductionOrder`. The handler passes the body to the command bus, whose first step parses `contract.input` ([ADR 0012][adr-0012], [ADR 0017][adr-0017]). No global validation pipe parses bodies, so each body is parsed once, and REST returns the same `fieldErrors` as GraphQL, as `application/problem+json` ([05 GraphQL and APIs](../plan/05-graphql-and-apis.md#rest-errors)).
* Reads are resource routes, `GET .../<resource>` and `GET .../<resource>/{id}`. Query and path parameters are validated one by one. Each response has a Zod output schema in the contracts package, and a serializer enforces it, so a column outside the schema never leaves the server. Lists reuse the connection and cursor conventions of [05 GraphQL and APIs](../plan/05-graphql-and-apis.md#list-conventions).
* A plant-scoped route takes the plant as a path segment: `/api/v<major>/<module-id>/plants/{plant}/...`. This answers M-37. A token's scope node check can read the plant before the handler runs, the plant shows in the logs, and the document lists it as a required parameter.
* Creates are idempotent through the client uuidv7 `id` that create command inputs already carry, inserted with `on conflict do nothing` ([ADR 0012][adr-0012]). There is no idempotency store and no `Idempotency-Key` header.
* Public routes accept integration tokens bound to a scope node and ignore cookies. The cookie same-origin middleware exempts them, as it exempts `/mcp`, and `/graphql` and `/mcp` reject integration tokens. First-party cookie routes share `/api/v1`, so the middleware and the credential table select public routes by family, not by path prefix. The audit surface of a public route is `api`, and its rate limits are per token, with a Postgres throttler store.

```ts
// modules/planning/server/rest/v1/commands.controller.ts (sketch, names proposed)
@ApiController({ module: "planning", family: "public" })
export class PlanningCommandsV1Controller {
  constructor(private readonly bus: CommandBus) {}

  @Post("commands/release-production-order")
  @PublicApiOperation({ command: releaseProductionOrder, problems: [400, 403, 404, 409] })
  release(@Body({ schema: releaseProductionOrder.input }) body: unknown, @Req() req: Request) {
    return this.bus.execute(releaseProductionOrder, body, req);
  }
}
```

`PublicApiOperation` derives the operation id from the command and applies `@RequirePermission(contract.permission)`.

### Where the document is served

* docs.northmes.dev renders the committed `schema/openapi-v1.json`, which covers the in-repo modules. `pnpm gen` copies it into `apps/docs`, because Docs7 reads only that folder and runs no build ([ADR 0048][adr-0048]).
* Each installation serves `GET /api/v1/openapi.json`, with its plugins' public routes included and `info.version` set to the image version. It answers a signed-in user or an integration token. An anonymous request and an MCP token get 401, as GraphQL refuses anonymous introspection.
* An ordinary Nest controller serves that document and builds it once per boot. `SwaggerModule.setup()` is not used, because its routes bypass the guards, `PrincipalResolver` and the route inventory.
* The image ships no Swagger UI. Developers preview the reference with `docs7 dev`.

### Snapshot and generation

* `pnpm gen` runs `northmes openapi print` right after `northmes schema print`. Like `schema print`, it writes from the fixed list of in-repo modules, never reads `northmes.config.json` and runs with `DATABASE_URL` unset ([ADR 0015][adr-0015]). It writes `schema/openapi-v1.json`.
* The output is deterministic: keys are sorted, dynamic defaults are excluded, and `info.version` is fixed at the API major `"1"`, so a release version bump never changes the file.
* `pnpm gen --check` covers the file, the file is marked `linguist-generated`, and a merge conflict in it is resolved by running `pnpm gen`.
* The example plugins stay out of the snapshot. Later, `pnpm plugin:check <id>` also prints a plugin's public operations and checks its prefix, operation ids and component names against the snapshot.

### The breaking-change gate

* A job inside `ci / gate`, next to `ci / pr title`, runs `oasdiff breaking` with `--fail-on ERR` between the base branch's `schema/openapi-v1.json` and the pull request's. The oasdiff binary is pinned and checked against its checksum, or its action is pinned by digest ([ADR 0050][adr-0050]).
* In 0.x an ERR-level break fails unless the pull request title carries `!`. That is the marker [ADR 0038][adr-0038] already uses for a breaking change and its minor bump, so the break reaches the changelog and no ignore file is needed.
* From 1.0 every break of the public API fails, and a break needs a new major.
* WARN-level findings are reported and do not block. `pnpm openapi:diff` runs the same comparison locally in report mode. The job reads the pull request, so it is not part of `pnpm check`.

### Majors and lifetimes

* A major covers the whole API and is independent of the lockstep product version. Before 1.0 no v2 is needed, because breaks ship in minors marked `!`.
* When v2 starts, every unchanged public operation is served under both majors, and each changed operation gets a v2 controller and v2 schemas under `contracts/src/rest/v2/`. v2 gets its own snapshot, `schema/openapi-v2.json`, and the gate runs per file. v1 operations carry `deprecated: true` and an `x-sunset` date.
* In 0.x, v1 lives one minor release after v2 starts. After 1.0 it lives until the supported minor that last served v1 ends its fix window ([ADR 0038][adr-0038]).
* The first-party routes and the shell move to the new major in the release that starts it.

### Release 1 and the first public route

Release 1 adds no dependency and serves no OpenAPI. It builds:

1. the moved paths, and Better Auth's `basePath` `"/api/v1/auth"` on the server and in the shell's auth client;
2. `ApiController` in `@northmes/sdk/rest`, and the API major and `apiPath` in `@northmes/contracts`;
3. the reserved module ids in the catalog check;
4. the reserved plant slugs in core's plant slug schema;
5. the boot route check;
6. one route inventory test, `apps/server/test/rest/routes.int.test.ts`.

M-35 (the spelling of error codes) and M-36 (the base of the problem `type` URI) are settled before the first release, as already planned, because the public API will publish both.

The rest arrives with the first public route. Its trigger is the first outside system ([ADR 0031][adr-0031], [ADR 0055][adr-0055]) or Data collection's ingestion endpoint:

* `@nestjs/swagger` 12 in `apps/server`, as a peer of `@northmes/sdk` in the `@nestjs/*` catalog group, and `zod-openapi` in `apps/server` only, each in its own pull request at a version older than Renovate's `minimumReleaseAge`;
* `PublicApiOperation` in `@northmes/sdk/rest` and the `Problem` component in `@northmes/contracts`;
* the document builder, the converter, `northmes openapi print`, the committed `schema/openapi-v1.json` and the ownership tests;
* the oasdiff gate;
* `GET /api/v1/openapi.json` and the reference on docs.northmes.dev;
* integration tokens: `configId`, prefix, expiry, the binding to a scope node, the issuing UI, the audit surface `api`, rows in the credential tables, and per-token rate limits.

### Parts of accepted ADRs this decision changes

The files below keep their text. This ADR holds over the parts listed here, and the rest of each ADR stands.

Paths:

| ADR | Sections | Before | After |
|---|---|---|---|
| [0002][adr-0002], modular monolith | Process roles (role `api`); Boot sequence of role `all` (the degrade list); Confirmation (degrade tests) | `/api/web/modules` | `/api/v1/web/modules` |
| [0007][adr-0007], tenancy | Confirmation | `GET /api/web/modules` | `GET /api/v1/web/modules` |
| [0010][adr-0010], identity | Decision outcome (the core auth module) | `toNodeHandler` on `/api/auth/*` | `toNodeHandler` on `/api/v1/auth/*`, with `basePath: "/api/v1/auth"` |
| [0010][adr-0010], identity | Decision outcome (the 401 and 403 rule); Confirmation | `/api/web/modules`, `GET /api/web/modules` | `/api/v1/web/modules`, `GET /api/v1/web/modules` |
| [0018][adr-0018], realtime | Decision outcome (the graphql-ws row "after a reconnect"; the reload dialog) | `/api/web/modules` | `/api/v1/web/modules` |
| [0019][adr-0019], web shell | Decision outcome (Shell and boot; Serving; Plant switch) | `GET /api/web/modules?plant=<slug>`, `/api/web/modules`, `/api/web/modules?plant=<new>` | `GET /api/v1/web/modules?plant=<slug>`, `/api/v1/web/modules`, `/api/v1/web/modules?plant=<new>` |
| [0033][adr-0033], operator station | Station identity and operator sessions | `/api/station` | `/api/v1/station` |
| [0035][adr-0035], AI provider port | The read-only planning assistant | `POST /api/ai/chat` | `POST /api/v1/ai/chat` |
| [0038][adr-0038], versions and releases | One version (the shared web versions check) | `/api/web/modules` | `/api/v1/web/modules` |
| [0043][adr-0043], health endpoints | Context and problem statement; Browser errors reach the server; Confirmation (endpoint tests) | `POST /api/web/client-errors` | `POST /api/v1/web/client-errors` |
| [0052][adr-0052], error telemetry | Decision outcome | `POST /api/web/client-errors` | `POST /api/v1/web/client-errors` |
| [0061][adr-0061], presentation settings | Resolution and delivery; Confirmation (`web-modules.int.test.ts`); More information (the plan 05 entry) | `GET /api/web/modules?plant=<slug>`, `/api/web/modules?plant=p2`, `/api/web/modules` | `GET /api/v1/web/modules?plant=<slug>`, `/api/v1/web/modules?plant=p2`, `/api/v1/web/modules` |
| [0062][adr-0062], web forms and links | Module link manifests; its own list of changes to ADR 0019 | `/api/web/modules` | `/api/v1/web/modules` |

* ADR 0035 also names `https://eu.openrouter.ai/api/v1` and `GET /api/v1/generation`. These are OpenRouter's paths and do not change.
* ADR 0043's `/health`, `/health/live` and `/health/ready` stay at the root, as do `/graphql` ([ADR 0015][adr-0015]), `/mcp` ([ADR 0034][adr-0034]) and `/modules/<id>/<version>/` ([ADR 0019][adr-0019]).
* The station cookie `__Host-nm_station` keeps `Path=/` ([ADR 0033][adr-0033]), so the move of `/api/v1/station` does not touch the cookie.

[ADR 0002][adr-0002], boot sequence of role `all`:

* Step 4 also refuses the module ids `web`, `station` and `auth`.
* Step 8 also assigns each controller to the module root that reaches it, or to the host.
* Step 10 also runs the route check under [The boot route check](#the-boot-route-check).

[ADR 0007][adr-0007], plants:

* A plant slug is unique per company and is none of `api`, `graphql`, `mcp`, `health`, `modules`, `assets` and `station`.
* For public routes, "REST routes take the plant from the path" means the `/plants/{plant}/` segment.

[ADR 0037][adr-0037], plugins:

* Install: a plugin adds no REST controller until the public API exists, and boot refuses a controller reachable from a plugin root. After that, a plugin adds only public routes under `/api/v<major>/<plugin-id>/`.
* What waits until after the pilot gains public API routes from plugins, triggered by the integration API.
* Confirmation gains `apps/server/test/boot/plugin-controller.int.test.ts`.

[ADR 0038][adr-0038], versions and releases:

* API reports and schema diffs gains, with the first public route, the oasdiff gate over `schema/openapi-v1.json`: in 0.x it blocks an ERR-level break unless the pull request title carries `!`, and from 1.0 it blocks every break of the public API. GraphQL Inspector keeps its report-only rule in 0.x.
* Cadence and support: in 0.x, v1 lives one minor release after v2 starts; after 1.0, until the supported minor that last served v1 ends its fix window.

### Consequences

* Good, because every REST path follows one rule, `/api/v<major>/` or the root allowlist, and boot enforces it.
* Good, because two controllers on one method and path stop boot with both names, where Express would serve the first without an error.
* Good, because release 1 adds no dependency and no public surface, and the reserved ids, the reserved slugs and the plugin rule are in place before anything depends on them.
* Good, because a public command route parses the same Zod contract as its mutation and returns the same field errors.
* Good, because the committed snapshot stays the same across plugins and image versions, while the served document lists each installation's plugin routes.
* Bad, because the version segment no longer tells a reader which routes carry the promise: `/api/v1/ai/chat` carries none, while a later public route under `/api/v1/ai/` does. Only the family metadata and the OpenAPI document tell them apart.
* Bad, because the same-origin middleware, the credential table and the document builder select public routes by family, not by path prefix.
* Bad, because the release that starts v2 also moves every first-party path, so a browser tab left open across that upgrade fails on its next REST call until it reloads.
* Bad, because paths in twelve accepted ADRs stay stale in their text; this ADR lists them.
* Bad, because a plugin that needs an upload or a stream cannot add one until the public API exists.
* Bad, because in 0.x the public API still breaks in minors marked `!`, so an integrator on 0.x reads the release notes. The stable promise starts at 1.0.
* Bad, because plant slugs in public paths make a slug rename a breaking change for integrations.
* Bad, because `@nestjs/swagger` brings `swagger-ui-dist` into the image, and the SBOM and the license gate list it although no UI is served.
* Neutral, because no document gives Caddy path routes, so the move needs no proxy change.

### Confirmation

Release 1 carries these tests:

* `packages/sdk/test/rest/api-controller.test.ts`: "ApiController({ module: "web", family: "first-party" }) registers api/v1/web and records family first-party and module web".
* `packages/contracts/test/api-path.test.ts`: "API_MAJOR is 1 and apiPath for web/modules returns /api/v1/web/modules".
* `apps/server/test/catalog.test.ts`: "module ids web, station and auth are each refused as reserved, and the message names the id".
* `modules/core/contracts/test/plant-slug.test.ts`: "slugs api, graphql, mcp, health, modules, assets and station are refused"; "slug hel is accepted".
* `apps/server/test/boot/routes.int.test.ts`, the boot route check:
  * "a controller at api/web/modules makes boot exit 1 naming the class";
  * "a controller declared with plain @Controller off the root allowlist makes boot exit 1 naming the class";
  * "two controllers on POST /api/v1/web/client-errors make boot exit 1 naming both classes";
  * "a public controller with module segment scheduling inside the planning module makes boot exit 1 naming both ids";
  * "the health controller at /health passes as a root route".
* `apps/server/test/boot/plugin-controller.int.test.ts`, which boots the built server in a child process because `createTestApp` takes in-repo modules only ([ADR 0037][adr-0037]): "a fixture plugin whose Nest module reaches a controller makes boot exit 1 naming the plugin id".
* `modules/core/test/auth/base-path.int.test.ts`: "GET /api/v1/auth/get-session without a cookie returns 200 with a null body"; "GET /api/auth/get-session returns 404".
* `apps/web/test/auth-client.test.ts`: "the auth client requests its session from /api/v1/auth/get-session".
* `apps/server/test/rest/routes.int.test.ts`, the route inventory:
  * "every route uses PrincipalResolver or carries @Public";
  * "every route is in exactly one family or on the root allowlist, and is on the release 1 list";
  * "the release 1 list holds /api/v1/web/modules, /api/v1/web/client-errors, /api/v1/station, /api/v1/ai/chat, /api/v1/pyramid-connector/import-file, Better Auth at /api/v1/auth and the root routes";
  * "every route outside the root allowlist starts with /api/v1/";
  * "no route is in the public family";
  * "the health routes sit at the root".
* The existing route tests call the moved paths: `apps/server/test/rest/web-modules.int.test.ts` ([ADR 0061][adr-0061]), `apps/server/test/rest/pyramid-upload.int.test.ts` (E09-S03), the client-errors endpoint tests ([ADR 0043][adr-0043]) and `credentials-by-surface.int.test.ts` ([ADR 0011][adr-0011]).
* `test/meta/forbidden-deps.test.ts` also fails when `@asteasolutions/zod-to-openapi` appears in a workspace `package.json`; [ADR 0017][adr-0017] already rules it out.

These tests arrive with the first public route:

* `packages/sdk/test/rest/api-controller.test.ts`: "ApiController({ module: "planning", family: "public" }) registers api/v1/planning with tag planning"; once v2 starts, "a controller served under majors 1 and 2 registers both paths".
* `apps/server/test/openapi/print.int.test.ts`: "print with DATABASE_URL unset constructs zero pools and equals schema/openapi-v1.json"; "adding a plugin to northmes.config.json leaves the snapshot unchanged"; "a new image version leaves the snapshot unchanged"; "two runs give identical bytes".
* `apps/server/test/openapi/document.test.ts`: "every operationId is unique and starts with its tag's GraphQL name followed by an upper-case letter"; "a command route's operationId equals its mutation name"; "no first-party or library route appears"; "every operation declares a 2xx schema and the Problem responses"; "openapi is 3.1.0 and no schema uses nullable".
* `apps/server/test/openapi/components.test.ts`: "two modules emitting component LossCategory with different shapes fail naming both modules"; "a shared component that differs between two copies of @northmes/contracts fails with the drift message".
* `apps/server/test/rest/v1-commands.int.test.ts`: "a body failing a superRefine returns 400 application/problem+json with the same fieldErrors as the GraphQL mutation"; "an invalid body writes no audit.command row"; "a refinement with a call counter runs once per request"; "a valid body writes one audit.command row with surface api".
* `apps/server/test/rest/v1-reads.int.test.ts`: "a handler that returns an extra column sends a response without it"; "a token bound to plant A gets 403 for plant B in the path".
* `apps/server/test/rest/openapi-json.int.test.ts`: "anonymous GET /api/v1/openapi.json returns 401"; "an MCP personal access token returns 401"; "a session gets the document with info.version equal to the image version"; "a loaded plugin's public route appears in the served document and not in the snapshot".
* `apps/server/test/credentials-by-surface.int.test.ts` gains: "an integration token on POST /graphql returns 401"; "a session cookie on a public route is ignored and returns 401"; "an integration token on /mcp returns 401".
* `test/meta/openapi-diff.test.ts`, which runs the CI script on fixture pairs: "a removed response field under a title without ! exits 1"; "the same change titled feat(planning)!: exits 0"; "an added optional response field exits 0"; "at version 1.0.0 a removed field exits 1 even with !".
* `test/meta/gen.test.ts` gains: "adding a field to a planning v1 response schema makes pnpm gen --check exit 1 and name schema/openapi-v1.json".

## Pros and cons of the options

### Every REST route under `/api/v<major>` in route families, with one SDK helper

* Good, because one rule covers every REST path, and the root allowlist is short and fixed.
* Good, because the major comes from one value, so the shell and the first-party routes move to a new major together.
* Good, because the helper's metadata gives the boot check each controller's family and module without parsing paths.
* Bad, because the version segment on a first-party route promises nothing, so a reader learns which routes are public from the document, not from the path.
* Bad, because it moves paths named in twelve accepted ADRs and in the plans.
* Bad, because a new major also moves first-party routes that did not change.
* Bad, because the same-origin exemption and the document builder cannot select public routes by path prefix.

### The public API only under /api/v1, first-party routes unversioned

This was the review's recommendation.

* Good, because the path tells a reader which contract applies: `/api/v1/` carries the promise, and every other route under `/api/` is first-party.
* Good, because no path named in an accepted ADR moves, and first-party routes never move for a new major.
* Good, because the document builder and the same-origin exemption can select public routes by path prefix.
* Bad, because two path shapes live under `/api/`, and a reader must know that only one of them is versioned.
* Bad, because module ids matching `^v[0-9]+$` must also be reserved, so that no module's first-party routes land on the public prefix.

### Every route under /api/v1 through setGlobalPrefix and URI versioning

* Good, because Nest builds the prefix and the version without a helper.
* Bad, because the exclude list must name every root route, and a forgotten entry moves a route without an error.
* Bad, because `exclude` strips only the prefix, so a health controller under a default version lands at `/v1/health`.

### A version header

* Good, because paths never change between majors.
* Bad, because both majors share one path in the OpenAPI document.
* Bad, because the path no longer shows which version a caller uses.

### Smaller choices

| Question | Chosen | Left out | Reason |
|---|---|---|---|
| How many OpenAPI documents | one per API major, built in `apps/server`, one tag per module | one per module through `include`; both | all modules and plugins share one process and one route table; per-module documents duplicate the shared components and need a second set of collision checks; oasdiff on one file still names the operation and its tag |
| What release 1 builds | this ADR and the cheap checks | the pipeline, integration tokens and one public read route for the pilot; a development Swagger UI over the first-party routes | the scope rule of ADR 0055; release 1 has no outside system, so the document would be empty; first-party shapes change in every minor; no document designs integration tokens yet |
| The gate in 0.x | block an ERR-level break unless the title carries `!`; block every break from 1.0 | report only until 1.0, like GraphQL Inspector; block every break from the first route | the public API's callers are outside systems that a silent break hurts, while GraphQL's clients ship in the image; blocking every break would force a v2 before 1.0, while the product promises nothing in 0.x |
| Plugin controllers | none until the public API exists, then public routes under the plugin id only | any controller, unchecked, as ADR 0037 leaves it; never | see [Modules and plugins](#modules-and-plugins) |
| Serving the document | the snapshot on docs.northmes.dev; `GET /api/v1/openapi.json` for a signed-in user or an integration token; no Swagger UI | Swagger UI at `/api/docs` through `SwaggerModule.setup` behind an installation setting; an anonymous `openapi.json` | the routes of `setup()` bypass the guards, `PrincipalResolver` and the route inventory; swagger-ui is unverified against the strict `'self'` CSP; GraphQL refuses anonymous introspection; only the runtime document shows plugin routes |
| Public writes | command routes with the body `contract.input` | resource routes such as `POST .../production-orders/{id}/release`, with the id in the path | commands are the only write path, and `contract.input` already carries `id` and `expectedVersion`; Zod 4 throws on `.omit()` for a refined object ([ADR 0062][adr-0062]), so a body without the id would need a second schema per command |
| OpenAPI version | 3.1.0 through `zod-openapi` | 3.0.3 through Nest's native Standard Schema converter | Zod's JSON Schema output defaults to draft 2020-12, the dialect of OpenAPI 3.1; a converter that throws on other vendors keeps 3.0 forms out; ADR 0017 already names `zod-openapi` |
| The plant in public paths (M-37) | the `/plants/{plant}/` segment | the `x-northmes-plant` header that GraphQL uses; a query parameter | ADR 0007 already says REST routes take the plant from the path; the scope node check reads it before the handler; it shows in logs and in the document |
| How long v1 lives | one minor in 0.x; after 1.0, until the supported minor that last served v1 ends its fix window | a fixed period, for example six months | it follows the one deprecation window for slot ids ([ADR 0037][adr-0037]) and the one minor for moved link entries ([ADR 0062][adr-0062]), and after 1.0 the support line of ADR 0038 |
| Idempotent creates | the client uuidv7 `id` with `on conflict do nothing` | an `Idempotency-Key` header backed by a store | every create command already has the mechanism ([ADR 0012][adr-0012]); ADR 0031 counts an idempotency store among the costs of an integration API |

## More information

* Changes the accepted ADRs listed under [Parts of accepted ADRs this decision changes](#parts-of-accepted-adrs-this-decision-changes).
* Related ADRs: [0003][adr-0003] module ids, [0011][adr-0011] credentials by surface and the same-origin middleware, [0012][adr-0012] commands, [0015][adr-0015] schema print and `pnpm gen`, [0017][adr-0017] Zod contracts and the REST bullet, [0031][adr-0031] no integration REST API in release 1, [0032][adr-0032] the Pyramid upload, [0034][adr-0034] MCP, [0048][adr-0048] docs on Docs7, [0050][adr-0050] pinned CI tools, [0055][adr-0055] the scope rule, [0059][adr-0059] the ingestion port, [0060][adr-0060] the public origin.
* Plan: [02 architecture](../plan/02-architecture.md#boot-sequence) (boot sequence and [HTTP endpoints](../plan/02-architecture.md#http-endpoints-and-credentials)), [03 modules and extensibility](../plan/03-modules-and-extensibility.md#catalog-checks-at-boot) (catalog checks and [plugins](../plan/03-modules-and-extensibility.md#plugins)), [05 GraphQL and APIs](../plan/05-graphql-and-apis.md#rest-endpoints-in-release-1) (REST endpoints, gates, tests and [open items](../plan/05-graphql-and-apis.md#open-items)), [06 web and UX](../plan/06-web-and-ux.md#shell-routes-and-mount-points) (plant slugs in shell routes), [11 quality and testing](../plan/11-quality-and-testing.md#ci-gates) (CI gates), [12 operations and security](../plan/12-operations-and-security.md#same-origin-and-credential-rules) (credentials), [14 roadmap](../plan/14-roadmap.md) (E02-S01, E02-S03, E02-S04, E02-S05, E05-S03, E05-S05, E05-S07 and E09-S03), [16 open questions](../plan/16-open-questions.md#design-points-from-the-plan-documents) (M-35, M-36, M-37 and M-54 to M-57).
* The OpenAPI and URL versioning review of 2026-10-05 holds the research behind the smaller choices.
* Unverified, to settle before the first public route relies on it:
  * whether the `@nestjs/swagger` scanner works under `NestFactory.create` with `preview: true`; if it does not, `northmes openapi print` needs stub providers or loses the rule that it runs without a database;
  * whether Nest 12 validates `@Body({ schema })` without a global pipe; if it does, bodies are parsed twice and the first failure has Nest's error shape instead of `fieldErrors` (`v1-commands.int.test.ts` pins the behaviour);
  * how Nest merges two components of the same name returned by separate converter calls; the converter's hash check is the guard;
  * whether `@nestjs/swagger` handles a controller path array for two majors; the fallback is two thin controllers over one service;
  * whether Docs7 renders an OpenAPI 3.1 file; check it with `docs7 dev` before the first route, with Mintlify as the fallback host ([ADR 0048][adr-0048]);
  * Zod registries throw when a second schema registers an id that is already present, the global registry included. `zod` is host-provided, and validators take schemas from the contracts copy a plugin bundles ([ADR 0037][adr-0037]), so a plugin that bundles a module's contracts package may register that module's ids a second time and fail at import. This already affects GraphQL. Verify it with `example-validator` before components rely on ids.
* On 2026-10-05 `@nestjs/swagger` 12.0.2 was 12 days old, so its dependency pull request uses an older release or waits for Renovate's `minimumReleaseAge`.
* Open: the owner of the later ingestion endpoint. ADR 0031 and ADR 0055 call it a core REST endpoint, while ADR 0059 gives the ingestion port to Data collection; the owning module's id decides its `/api/v1/<module-id>/` segment. Whether a plant slug can be renamed at all is open for E05-S03. Whether Better Auth's `basePath` moves to `/api/v2/auth` when v2 starts is decided when v2 is planned.
* Revisit when the first outside system or Data collection needs the public API, when a v2 is planned, and before 1.0.

[adr-0002]: 0002-modular-monolith-with-module-owned-schemas-and-process-roles.md
[adr-0003]: 0003-module-package-shape-and-the-definemodule-manifest.md
[adr-0007]: 0007-tenancy-company-plants-and-the-scope-tree.md
[adr-0010]: 0010-identity-with-better-auth-roles-and-permissions-in-core-tables.md
[adr-0011]: 0011-principals-credentials-and-same-origin-rules.md
[adr-0012]: 0012-commands-as-the-single-write-path.md
[adr-0015]: 0015-graphql-federation-inside-one-process-with-an-embedded-hive-gateway.md
[adr-0017]: 0017-zod-contracts-as-the-single-source-for-inputs.md
[adr-0018]: 0018-realtime-subscriptions-over-graphql-ws-fed-by-the-event-tail.md
[adr-0019]: 0019-web-shell-with-react-module-federation-remotes.md
[adr-0031]: 0031-erp-integration-connector-modules-field-ownership-and-pending-changes.md
[adr-0032]: 0032-pyramid-connector-polling-file-mode-and-shadow-write-back.md
[adr-0033]: 0033-online-operator-station-in-the-production-start-module.md
[adr-0034]: 0034-mcp-surface-one-endpoint-a-read-mostly-planning-toolset.md
[adr-0035]: 0035-ai-provider-port-with-customer-configured-providers.md
[adr-0037]: 0037-plugins-drop-in-packages-command-validators-and-ui-slots.md
[adr-0038]: 0038-versions-and-releases-lockstep-0-x-release-please-api-reports.md
[adr-0043]: 0043-health-endpoints-graceful-shutdown-and-the-system-health-page.md
[adr-0048]: 0048-documentation-on-docs7-at-docs-northmes-dev.md
[adr-0050]: 0050-github-organization-rulesets-ci-runners-and-supply-chain.md
[adr-0052]: 0052-error-telemetry-opt-in-and-deferred.md
[adr-0055]: 0055-release-1-scope-under-option-b-and-the-scope-rule.md
[adr-0059]: 0059-time-series-storage-port-with-an-open-default-backend.md
[adr-0060]: 0060-configuration-with-nestjs-config-one-zod-environment-schema-and-secret-files.md
[adr-0061]: 0061-presentation-settings-for-dates-clocks-and-numbers-with-one-pinned-locale.md
[adr-0062]: 0062-web-form-contracts-url-view-state-and-module-link-manifests.md
