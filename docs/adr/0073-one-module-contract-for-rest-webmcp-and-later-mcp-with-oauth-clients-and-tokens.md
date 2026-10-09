---
status: "proposed"
date: 2026-10-09
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: Krister Johansson; the WebMCP draft of the W3C Web Machine Learning Community Group; the MCP authorization specification; Better Auth's OAuth provider and api-key documentation
informed: contributors, coding agents, module and plugin authors, pilot IT
release: "1"
needs-confirmation: "maintainer (the optional plant parameter on article routes, the owner field on create and upsert, and core.article:promote as a company permission; personal access tokens bound to one company; the WebMCP toolset of the module whose route is open; planning's three read tools; the names webmcp.enabled and NORTHMES_WEBMCP; the audit surface webmcp and the principal type integration; token lifetimes and rate limit numbers; the ADR 0055 ledger row, its estimate and cut order item 3; the navigator.modelContext fallback)"
---

# One module contract for REST, WebMCP and later MCP, with OAuth clients and tokens

## Context and problem statement

On 2026-10-09 Krister Johansson asked for an API for articles with OAuth and service tokens. He chose REST with OpenAPI as the public family of [ADR 0064][adr-0064]; both OAuth flows now, client credentials for machine to machine and the authorization code flow with PKCE and a consent screen, so that an ERP can connect to NorthMES and act for a signed-in user; both token kinds; and the full article set plus an upsert by article number, so that an ERP can push its articles. For the token kinds he decided that integration tokens are created by a Company admin under Settings, Integrations, are bound to the company or one plant with roles there, are shown once and stored hashed, carry an expiry and a last-used time, can be revoked, and act as their own principal, and that personal access tokens act as the user. He asked for the basics, WebMCP and MCP among them, to be in place as the base for the modules that come later, and set the rule that every surface calls the module's service with no logic in between: a REST create and a GraphQL create of an article both call the article service's create.

The same day a research round put further questions to him, and he decided:

* Agents start with read tools only. Import and write tools wait. He expects agents to ask when an order will be done, what runs next and what is in stock.
* A module's toolset holds at most four tools, a client picks toolsets by URL, core and planning are the default toolsets, and core's search tool is `core_search`.
* An article belongs to the company or to one plant, so a plant admin can create the plant's own articles, and a plant article can be promoted to the company. The REST path is `/api/v1/core/articles`.
* Release 1 ships WebMCP only. The `/mcp` endpoint, OAuth sign-in for MCP clients and the ways to reach an on-prem installation (a LAN bridge, a public URL with an IP allowlist, tunnels) are documented for later and not built now. When `/mcp` comes, MCP clients sign in with OAuth.
* WebMCP is on by default. An installation setting in the database switches it, and an environment variable overrides the setting.

So the subject is the platform base that every later module uses, with articles as its first user. Today a module reaches GraphQL through `defineCommand` and the list kit, while [ADR 0034][adr-0034] plans `defineTool`, a shared runner and `/mcp`, and [ADR 0064][adr-0064] plans public REST routes, OpenAPI and integration tokens for the first outside system. Nothing says how one capability of a module, such as "find articles" or "archive an article", reaches REST, the browser, a later `/mcp` and the in-app assistant without being written four times, nor which credential each surface accepts once OAuth and two token kinds exist.

[ADR 0031][adr-0031] said the integration API comes when an outside system needs it, and the maintainer's request is that trigger. [ADR 0034][adr-0034] deferred WebMCP, and these decisions bring it in while `/mcp` waits. Other decisions of the same days that this ADR builds on: one installation per customer, the web signs in with email only, Company admin holds every installed permission and Plant admin all but the company-level ones, and every write goes through the command bus with a permission check at the row's scope ([ADR 0012][adr-0012]).

Main at 53217f2e has one NestJS backend in `apps/backend` with module code in `apps/backend/src/modules/<id>/{api,core,infrastructure}`, one web app in `apps/web` with module code in `apps/web/src/modules/<id>`, the MIT contracts packages in `modules/<id>/contracts`, `ApiController` in `packages/sdk/src/rest/api-controller.ts`, and Better Auth 1.7.6 pinned exactly with the username, organization, admin, api-key (`@better-auth/api-key` 1.7.6), bearer and jwt plugins. The web holds a bearer session and sends a five-minute JWT minted at `/api/auth/token` on every request. Articles live at plants: `core.createArticle` writes the row at the request's plant, and a unique index on `(scope_id, code_key)` stands in for the exclusion constraint of [ADR 0009][adr-0009]. The catalog pins `@nestjs/swagger` 12.0.2, `zod-openapi` 6.0.2, `@better-auth/oauth-provider` 1.7.6, and `@modelcontextprotocol/server` and `@modelcontextprotocol/client` 2.1.0.

This ADR covers the operation contract in `@northmes/contracts` and `@northmes/sdk`, the shared runner, the REST and WebMCP adapters, the agent toolsets, where an article lives and core's article operations, the credentials (integration tokens, personal access tokens and OAuth 2.1 clients), the credential table per surface, audit, rate limits, the delivery order and the later `/mcp` step.

## Decision drivers

* The maintainer's decisions of 2026-10-09, listed above.
* A module author declares a capability once. Each surface is an adapter, so a fix in the runner reaches every surface, as [ADR 0034][adr-0034] already decided for MCP and the assistant.
* Every write runs through the command bus, which parses the contract, checks the permission at the row's scope, checks `expectedVersion` and writes the audit row ([ADR 0012][adr-0012], [ADR 0013][adr-0013]).
* Zod contracts are the single source of inputs, and of outputs for every surface that publishes a schema ([ADR 0017][adr-0017]).
* A credential works only on the surfaces it was issued for ([ADR 0011][adr-0011]).
* The web app imports only MIT contracts and its own code, so anything the browser registers as a tool must be declared in the contracts package.
* Every tool definition an agent loads takes room in its model's context, so an agent should load only the toolsets it needs.
* Hosted agent clients call MCP servers from their vendor's cloud, so they cannot reach an installation that only the plant network reaches. WebMCP runs in the user's browser, inside that network.
* WebMCP is a Community Group draft, shipped only in Chrome behind a flag or an origin trial, in secure contexts. The page must work the same without it.
* MCP's authorization specification is OAuth 2.1 with PKCE, so the authorization server built for integrations can later serve MCP clients.
* The scope rule of [ADR 0055][adr-0055]: an item enters release 1 by the maintainer's decision, recorded in its ledger, and no manifest key or flag ships without the code that reads it.

## Considered options

* One operation contract per capability, declared in the module's contracts package and bound to a handler in the backend, with adapters for REST, WebMCP, a later `/mcp` and the assistant
* Hand-written surfaces: a public controller per resource, a `defineTool` per tool and a WebMCP registration per screen
* GraphQL as the only contract: REST and tools generated from the GraphQL schema
* A tools-first contract: `defineTool` as in ADR 0034, with REST routes generated from tools

## Decision outcome

Chosen option: "One operation contract per capability", because it puts the data every surface needs (schemas, permission, REST route, tool text and annotations) where both the backend and the web can import it, keeps the handler on the server, and sends every call through one runner and the command bus. The maintainer decided the points listed under Context. The rest below is the planning session's proposal: the contract shape, the routes beyond the article path, the api-key `configId` values and prefixes, the token lifetimes, the OAuth details, the setting names, the numbers and the waves.

### 1. The operation contract

An operation is one capability of a module: a command or a query. A module declares it once.

* Commands keep `defineCommandContract` in `@northmes/contracts` ([ADR 0017][adr-0017]).
* Reads get `defineQueryContract({ name, input, output, permission })` in `@northmes/contracts`: a module-prefixed name such as `core.getArticle`, a Zod input, a Zod output and one permission key. A query never writes.
* Lists get `defineListQueryContract({ name, list, permission })`, which derives the contract from the module's list declaration instead of a hand-written input. The list declaration's data (node schema, sort fields, filter fields, search fields, `archivable`) lives in the contracts package, as [05 GraphQL and APIs](../plan/05-graphql-and-apis.md#list-conventions) already says, and the backend's `defineList` reads the same object for the GraphQL connection. The derived input has fixed rules on every surface: `first` and `after` with the list kit's cursors; `orderBy` as a list of declared sort fields, each optionally prefixed with `-` for descending (in REST a comma-separated query parameter); one parameter per declared filter field, `<field>` for equality and `<field>[<operator>]` for the list kit's other operators; `search` over the declared search fields; and `includeArchived` for an archivable list. The output is `{ nodes, pageInfo: { hasNextPage, endCursor } }`, the connection without edges. A module writes no list contract by hand.
* `defineOperations({ module, resource, scope, operations })` in `@northmes/contracts` lists, for one resource, each operation with its contract and the surfaces it reaches. `scope` tells the adapters where the operation runs: `plant` needs a plant, `company` takes none, and `companyOrPlant` takes an optional plant and runs at the company without one. Each operation has:
  * `rest`: the method, the path under the module segment, the success status (200, or 201 for an operation that may create, which answers 200 when the row already exists) and, for a list, `maxPageSize` (default 100), or `false`;
  * `tool`: the tool name, title, description, annotations (`readOnlyHint` and `destructiveHint`, which ADR 0034 requires on every tool), effect (`read` or `proposal`, as in ADR 0034) and, for a list, `maxPageSize` (default 25, so that two outside text fields per row stay within ADR 0034's 50 values per call), or `false`. A tool belongs to its module's toolset;
  * `webmcp`: `true` to register the tool in the browser, default `false`.
* The declaration is plain data in the MIT contracts package. It imports no MCP SDK, no Nest and no web code, so the backend, the web app and `northmes openapi print` read the same object.
* The backend binds handlers with `bindOperations(declaration, handlers)` from a new MIT subpath, `@northmes/sdk/operations`. Every handler is a method of the module's service in `core/`. A read method queries through the `ScopedDatabase`; a write method sends its command through the command bus, so the permission check, the version check, the validators and the audit run for every caller, and the command's handler stays the one write path. The maintainer set this rule for every surface on 2026-10-09: the REST controller, the WebMCP tools, the later MCP tools and the GraphQL resolvers call the same service method and hold no logic of their own.

```ts
// modules/core/contracts/src/operations/article.ts (sketch, names proposed)
export const articleOperations = defineOperations({
  module: 'core',
  resource: 'articles',
  scope: 'companyOrPlant',
  operations: {
    find: {
      contract: findArticles, // defineListQueryContract({ name: 'core.findArticles', list: articleList, permission: 'core.article:read' })
      rest: { method: 'GET', path: 'articles', status: 200, maxPageSize: 100 },
      tool: false, // agents find articles through core_search
    },
    get: {
      contract: getArticle,
      rest: { method: 'GET', path: 'articles/{id}', status: 200 },
      tool: {
        name: 'core_get_article',
        title: 'Get an article',
        description: 'One article by id, with its owner, version and last change.',
        annotations: { readOnlyHint: true, destructiveHint: false },
        effect: 'read',
      },
      webmcp: true,
    },
    upsert: {
      contract: upsertArticle,
      rest: { method: 'POST', path: 'commands/upsert-article', status: 201 },
      tool: false,
    },
    // create, update, archive, restore and promote follow the table under section 2
  },
});

// apps/backend/src/modules/core/api/article/article.operations.ts
export const articleOperationsProvider = bindOperations(articleOperations, {
  find: (input, ctx) => ctx.get(ArticleService).find(input),
  get: (input, ctx) => ctx.get(ArticleService).byIdOrThrow(input.id),
  create: (input, ctx) => ctx.get(ArticleService).create(input),
  upsert: (input, ctx) => ctx.get(ArticleService).upsertByCode(input),
  // update, archive, restore and promote call the service in the same way
});
```

The shared runner of [ADR 0034][adr-0034] becomes the operation runner, in the host under `apps/backend/src/operations/`. For every call, from every surface, it:

1. resolves the principal and, when the request names one, the plant through `PrincipalResolver`, and records the surface;
2. parses the input with the contract;
3. checks the operation's permission at the plant, or at the company for a request without one, as a coarse gate (the command bus checks again at the row's scope);
4. for a query, runs the handler in a transaction with the row-level security scope in `SET TRANSACTION READ ONLY`; for a command, sends the parsed input to the command bus;
5. validates the output against the contract's output schema and drops any key outside it;
6. on the tool surfaces (`webmcp` now, `mcp` and `assistant` later), applies [ADR 0034][adr-0034]'s tool output rules: every field the output schema marks as outside text is wrapped as `{ untrusted: true, text }` and capped at 500 characters per value and 50 values per call, and the manifest-driven personal-field redactor runs on the whole output. A contract marks such a field with `outsideText()` from `@northmes/contracts`, a string schema with that mark in its metadata; the tool adapters publish the wrapped shape as the tool's output schema, and REST returns the plain string. Core's article `code` and `name` are marked, because an ERP writes both through the upsert;
7. maps errors once: a `DomainError` keeps its code, status and field errors, anything else becomes `core.internal` with the correlation id ([05 GraphQL and APIs](../plan/05-graphql-and-apis.md#error-model)).

The adapters sit on the runner and only translate:

| Adapter | Where | Turns the runner into |
|---|---|---|
| `toRestRoutes` | host, `apps/backend/src/http/public-api/` | Nest routes in a public `ApiController` per module, the OpenAPI operations and components, and `application/problem+json` errors |
| `toWebMcpTool` | web, `apps/web/src/shell/webmcp/` | `document.modelContext.registerTool` entries whose `execute` posts to the first-party tool route |
| `toMcpTool` | host, `apps/backend/src/mcp/`, later | `@modelcontextprotocol/server` tools, when `/mcp` comes (section 3) |
| `toAgentTool` | the `ai` module, later | AI SDK tools for the in-app assistant ([ADR 0035][adr-0035]) |

GraphQL stays the web app's own API, and its resolvers are thin in the same way: `coreCreateArticle` calls `articleService.create`, as `POST /api/v1/core/commands/create-article` does, and the list field calls `articleService.list`. `defineCommand` keeps registering the command's handler with the bus, and the GraphQL mutation that it generated moves to a resolver in the module's `api/` that calls the service ([Changes to ADR 0012](#changes-to-adr-0012)). The service's write method is where a module adds behaviour around a command, such as resolving an article number for the upsert, so no surface needs its own.

What a new module adds, and nothing else:

1. command and query contracts in `modules/<id>/contracts/src/`, and one `operations/<resource>.ts` per resource with `defineOperations`, with at most four tools across the module;
2. `apps/backend/src/modules/<id>/api/<resource>/<resource>.operations.ts` with `bindOperations`, listed in the module's Nest module;
3. the module's `operations` on its entry in `apps/web/src/modules.ts`, which the WebMCP adapter reads;
4. one conformance test per resource, `operationsConformance(declaration)` from `@northmes/testing`, which checks that every REST operation is served and appears in the OpenAPI document, and that every WebMCP tool runs through the tool route for a user who holds its permission and is refused for one who does not.

[ADR 0064][adr-0064] put a module's public controllers under `modules/<id>/server/rest/v1/` and its schemas under `contracts/src/rest/v1/`. With operations, a module writes no public controller, and its public schemas are its operation contracts in `contracts/src/operations/`. A v2 shape goes in `contracts/src/operations/v2/` when v2 starts.

#### Agent tools and toolsets

* Agents get read tools only (maintainer, 2026-10-09). Every tool that an agent surface registers in release 1 has effect `read`, and the WebMCP tool route refuses any other operation. Import and write tools wait for the maintainer, and so does `planning_propose_changes` on agent surfaces; it stays the in-app assistant's tool, as [ADR 0036][adr-0036] decides.
* A module's tools form one toolset, named by the module id, of at most four tools (maintainer, 2026-10-09). A fifth tool needs an ADR that changes this one. One CI check counts the tools of each module.
* A client picks toolsets by URL, and core and planning are the default toolsets. On WebMCP the URL is the page's own: the web registers core's and planning's toolsets and the toolset of the module whose route is open, so a browser agent sees at most twelve tools (section 4). On `/mcp`, later, it is a query parameter (section 3).
* `core_search` is core's one search tool, across core's entities, so an agent needs no list tool per entity. It is a query operation without a REST route: input `query` (text matched against code and name) and the optional `types`, `first` (at most 25) and `after`; output `nodes` of `{ type, id, code, name, plant }`, where `plant` is the owning plant's slug or null for a company row, and `pageInfo`. In release 1 its one type is `article`, and it reads the company's articles plus the current plant's. Its permission is `core.article:read`; each type that joins later brings its own read permission, and the search leaves out the types the user cannot read at the plant.

Core's toolset:

| Tool | Surfaces | Does |
|---|---|---|
| `core_search` | WebMCP, later `/mcp` | articles by number or name at the company and the current plant, at most 25 per call with a cursor |
| `core_get_article` | WebMCP, later `/mcp` | one article by id, with its owner, version and last change |
| `core_list_plants` | `/mcp`, later | the plants the user can reach ([ADR 0034][adr-0034]); a WebMCP page already has its plant |

Planning's toolset holds four tools when the planning stories that own them land: three of ADR 0034's six read tools, with the others folded into filters, as the `late` filter already is, or left for later, and `planning_propose_changes` for the in-app assistant. The planning session proposes `planning_find_orders`, `planning_get_order` and `planning_machine_schedule`, which answer when an order will be done and what runs next; the planning stories confirm the three.

The tool rules of [ADR 0034][adr-0034] stay: the portable input schema subset, permission-filtered tool lists, local time with offset, and outside text and the redactor, which now run in the runner's step 6.

### 2. Articles and their public REST family

Where an article lives:

* An article belongs to the company or to one plant (maintainer, 2026-10-09; [Changes to ADR 0007](#changes-to-adr-0007)). A Company admin creates company articles, which every plant of the company reads; a Plant admin creates the plant's own articles; and `core.promoteArticle` moves a plant article to the company.
* A plant reads the company's articles and its own, never another plant's. A user with a role at the company reads plant A's articles while working at plant A. A list across plants waits for company mode ([ADR 0007][adr-0007]).
* Codes follow [ADR 0009][adr-0009]: two plants may use the same code, a plant article may not take a company article's code, and a promotion is refused with `core.code_taken` while another plant uses the code. `core.article` gains `company_id`, `scope_span`, the composite foreign key to `core.scope` and ADR 0009's exclusion constraint, which replace the unique index on `(scope_id, code_key)`. Existing articles stay at their plants.
* `core.createArticle` gains `owner`, `company` or `plant`. Its scope hook returns the company node for `company` and the request's plant for `plant`, so the bus checks `core.article:create` where the row is written, and a Plant admin, who holds the permission only at the plant, cannot create a company article. The web's article form defaults to `plant` and offers `company` only to a user who holds `core.article:create` at the company, and the articles screen shows each article's owner.
* `core.promoteArticle` takes `id` and `expectedVersion` and needs `core.article:promote`, a new permission that joins `companyPermissions`, so Plant admin does not hold it. The handler checks it at the company node with `context.require`, because the row moves there, then sets the row's scope and span to the company's. Rows of the plant that reference the article stay valid, since a row may reference a row at an ancestor scope ([ADR 0009][adr-0009]). The articles screen offers Promote on a plant article to a user who holds the permission.

The public API of [ADR 0064][adr-0064] starts with core's articles, at the path the maintainer chose:

| Operation | Contract | Route | Operation id | Tool |
|---|---|---|---|---|
| List | `core.findArticles` (query) | `GET /api/v1/core/articles` | `coreArticles` | none; agents use `core_search` |
| Read | `core.getArticle` (query) | `GET /api/v1/core/articles/{id}` | `coreArticle` | `core_get_article` |
| Create | `core.createArticle` | `POST /api/v1/core/commands/create-article` | `coreCreateArticle` | none |
| Update | `core.updateArticle` | `POST /api/v1/core/commands/update-article` | `coreUpdateArticle` | none |
| Archive | `core.archiveArticle` | `POST /api/v1/core/commands/archive-article` | `coreArchiveArticle` | none |
| Restore | `core.restoreArticle` | `POST /api/v1/core/commands/restore-article` | `coreRestoreArticle` | none |
| Promote | `core.promoteArticle` (new) | `POST /api/v1/core/commands/promote-article` | `corePromoteArticle` | none |
| Upsert by article number | `core.upsertArticle` (new) | `POST /api/v1/core/commands/upsert-article` | `coreUpsertArticle` | none |

* The plant. Every article route takes an optional query parameter `plant`, a plant slug. With it, the request reads the company's articles and that plant's, and a command may change a row at that plant. Without it, the request acts at the company: it reads company articles only and finds no plant article. The server never picks a plant for the caller ([ADR 0007][adr-0007]). Every credential the public API accepts belongs to one company (section 5), which is the company of a request without `plant`. A plant the credential cannot reach is 403 `core.plant_forbidden`, as ADR 0007 decides for the header.
* List. `core.findArticles` is derived from core's article list declaration by the list rules of section 1: `first` (default 25, at most 100), `after` (the opaque cursor of [05 GraphQL and APIs](../plan/05-graphql-and-apis.md#cursors)), `orderBy` (a comma-separated list of `code`, `name` and `updatedAt`, each optionally prefixed with `-`, default `code`), `code` (the declared filter field, exact match), `search` (over code and name) and `includeArchived` (default false). The body is `{ nodes, pageInfo: { hasNextPage, endCursor } }`. A cursor used with another `orderBy` is 400 `core.list.invalid_cursor`.
* Read. The body is the article: `{ id, code, name, plant, version, archivedAt, updatedAt }`, component `CoreArticle`, where `plant` is the owning plant's slug or null for a company article. A missing id, one at a scope the caller cannot read, and a plant article requested without its plant are 404.
* Create. The body is `core.createArticle`'s input: the client's uuidv7 `id`, `code`, `name` and `owner`. `owner` `plant` without the `plant` parameter is 400 with a field error on `owner`. A new row answers 201; a retry with an id that already exists answers 200 with the stored article, which the caller compares ([ADR 0012][adr-0012], [ADR 0064][adr-0064]).
* Update, archive, restore and promote. The body is the contract input with `id` and `expectedVersion`. A stale version is 409 `core.version_conflict`.
* Upsert. `core.upsertArticle` is a command contract with target `none` and the fields `id` (uuidv7), `code`, `name`, `owner` and an optional `expectedVersion`, so the bus loads no row before the handler. It runs [ADR 0012][adr-0012]'s pipeline unchanged up to the handler: step 3 checks the contract's permission, `core.article:create`, at the scope that its scope hook returns for `owner`, as for a create; step 4 opens the audit context; and step 5 has no target version to check. The handler, in step 8, finds the article with this code among the rows the request reads:
  * none: it creates one under `id` at the owner's scope and answers 201. A company create whose code a plant article already uses fails with 409 `core.code_taken`, and a Company admin promotes that article or renames one of the two;
  * one that is active: it calls `context.require('core.article:update', scopeId)` at that row's scope, a new method on the handler context that runs the same `can()` check as step 3 inside the bus, so a denial rolls the command back, leaves no command row and writes the `permission.denied` event. It then writes `name` through the `/data` versioned update helper with `expectedVersion`, or with the row's loaded version when the input has none, so a stale version fails with `core.version_conflict` as ADR 0012 already maps it. An unchanged name writes no field and bumps no version, and the command still writes its one `audit.command` row, as ADR 0012 requires of every successful command. The answer is 200 with the article. `owner` matters only when the handler creates;
  * one that is archived: 409 `core.archived`.
  A caller therefore needs `core.article:create` at the owner's scope even to rename. The ERP sends the same request again after a timeout and gets the same result. Each push of an unchanged article leaves a command row without field changes; a connector that wants fewer rows compares before it sends, as imports do ([ADR 0031][adr-0031]).
* Versions and ETags. Every article response carries `ETag: "<version>"`. A read with a matching `If-None-Match` answers 304. Writes take the version only as `expectedVersion` in the body, the contract's field, so a version has one source. `If-Match` is not read, and the OpenAPI document says so.
* Errors are `application/problem+json` as [05 GraphQL and APIs](../plan/05-graphql-and-apis.md#rest-errors) shows: `type`, `title`, `status`, `detail`, `instance`, `code`, `errors` (the field errors in the shape GraphQL uses) and `correlationId`. M-35 and M-36 (code spelling and the `type` base) are settled before the first public route, as ADR 0064 already requires.
* OpenAPI. `toRestRoutes` gives each route its operation id, its tag `core`, its parameters (here the optional `plant`), its 2xx schema and its problem responses, and the document builder of ADR 0064 converts the contracts with `zod-openapi`. `northmes openapi print` writes `schema/openapi-v1.json`, `pnpm gen --check` covers it, the oasdiff gate compares it with the base branch, and `GET /api/v1/openapi.json` serves the installation's document. The document declares the security schemes of section 5: `bearer` for tokens, and `oauth2` with the client credentials and authorization code flows, each operation listing its permission as the required scope.

### 3. The /mcp endpoint, later

Release 1 builds no `/mcp` endpoint (maintainer, 2026-10-09). The operation declarations keep their `tool` entries, which serve WebMCP now, so the later step adds the `toMcpTool` adapter and a controller and no new declarations. This section records that step.

* The endpoint follows [ADR 0034][adr-0034]: one controller in the backend on `@modelcontextprotocol/server` v2 with `createMcpHandler(factory, { legacy: "stateless" })`, its own `Origin` and `Host` checks, off by default per installation through the installation setting `mcp.enabled` ([ADR 0066][adr-0066]), which arrives with it.
* Toolsets. `/mcp?toolsets=planning,stock` serves the toolsets it names, and `/mcp` without the parameter serves core and planning. A toolset id that the installation does not have is refused.
* `toMcpTool` adds a `plant` argument to the input schema of every tool whose declaration has `scope: 'plant'`, required unless the user reaches exactly one plant, as ADR 0034 requires, and an optional one for `companyOrPlant`.
* Sign-in is OAuth 2.1 (maintainer, 2026-10-09) on the authorization server of section 5, with `/mcp` as its second resource: access tokens with `aud` `NORTHMES_PUBLIC_ORIGIN + '/mcp'` (RFC 8707) from the authorization code flow with PKCE, acting as the user who consented. `/mcp` answers 401 with `WWW-Authenticate` naming `resource_metadata` at `/.well-known/oauth-protected-resource/mcp`, which names the issuer. The OAuth provider plugin replaces the Better Auth MCP plugin that ADR 0034 planned, because that plugin is itself an OAuth provider and cannot run beside a second one. Integration tokens and client credentials clients never reach `/mcp`, because tools act for people.
* Whether ADR 0034's personal access token for MCP (`configId` `mcp`, prefix `nms_mcp_`) also comes, for clients on a LAN that cannot complete an OAuth sign-in, is decided with the endpoint.
* Client registration. A Company admin's registered clients (section 5) work on every tier below. A client ID metadata document needs the authorization server to fetch the client's metadata URL, which an installation without internet access cannot do. Whether `/mcp` also accepts metadata documents or dynamic registration is decided with the first tier an installation uses.

Reach. A hosted client, such as a vendor's web app, a desktop app's custom connectors or a mobile app, calls an MCP server from the vendor's cloud, so it cannot reach an installation that only the plant network reaches, even when the user's own computer can. Three tiers, documented here and not built in release 1:

1. LAN. A client that runs on the user's computer, such as Claude Code, connects to the installation directly. Claude Desktop runs a local bridge as a local MCP server, such as `mcp-remote` or a NorthMES bundle that wraps it, and `mcp-remote` signs in with OAuth through a loopback redirect.
2. Public URL. The installation answers on an HTTPS URL with a publicly trusted certificate, behind an IP allowlist that admits the client vendor's published outbound address ranges. The vendor's hosted OAuth callback is registered as an exact `https` redirect URI, and the issuer and the metadata use `NORTHMES_PUBLIC_ORIGIN`, so they name no internal host.
3. Tunnel. A tunnel client inside the customer's network connects outward to the vendor, such as Anthropic's MCP tunnels or OpenAI's Secure MCP Tunnel, so no inbound port opens.

The trigger for this step is a customer whose agent client needs `/mcp`, together with the tier that customer's installation can offer.

### 4. WebMCP in the web app

WebMCP is release 1's agent surface (maintainer, 2026-10-09). The web app registers the operations marked `webmcp: true`, all of them read tools, so an agent in the user's browser can use the page's tools as the signed-in user. The adapter lives in `apps/web/src/shell/webmcp/`.

* Feature detection. The adapter uses `document.modelContext`, where the draft of 2026-10-09 places the API, and falls back to `navigator.modelContext`, where Chrome exposed it before May 2026. When neither exists, as in every browser without the flag or the origin trial and in an insecure context, the adapter does nothing and the page works as before. A failed registration is logged to the client-error route and never shown to the user.
* Registration. The draft's `registerTool(tool, { signal })` takes `name`, `title`, `description`, `inputSchema`, `execute` and `annotations` (`readOnlyHint`, `untrustedContentHint`, `consequentialHint`). The adapter builds `inputSchema` with `z.toJSONSchema` from the contract, leaves out the `plant` argument because the page has one plant, sets `readOnlyHint`, and sets `untrustedContentHint` on tools whose output schema holds an `outsideText()` field, such as an article's name. The output itself is wrapped by the runner's step 6.
* Toolsets. The adapter registers core's and planning's toolsets and the toolset of the module whose route is open, and swaps that last toolset when the user moves to another module's route.
* Exposure. The adapter never passes the draft's `exposedTo` option, so no document of another origin in the page's tree sees the tools. The draft gates `registerTool`, `getTools` and `executeTool` behind the policy-controlled feature `tools`, whose default allowlist is `'self'`; the shell controller sends `Permissions-Policy: tools=(self)` beside the existing `frame-ancestors 'none'`, so the rule does not rest on the browser's default.
* What is registered. Only tools whose permission the user holds at the current plant, read from the permissions the web already loads for the plant. A user without `core.article:read` at the plant gets neither `core_search` nor `core_get_article`.
* Lifecycle. Each registration gets an `AbortSignal` from one `AbortController` per plant session. A plant switch aborts it, which unregisters every tool, and registers the new plant's set. Sign-out and a 401 abort it too. On the `navigator.modelContext` fallback, where a build may not take a signal, the adapter calls `unregisterTool(name)` when it exists.
* Execution. `execute(input)` posts `{ input }` to the first-party route `POST /api/v1/web/tools/{tool}` with the web's JWT and `x-northmes-plant`. The route runs the same operation runner with surface `webmcp` and serves only operations with effect `read`. The page never calls a handler directly, so the browser gets the same permission checks, row scopes, output validation and error mapping as every other surface. The result is the tool's structured JSON, or the runner's error object.
* The route is first-party: same-image callers, no compatibility promise, no entry in the OpenAPI document. It accepts only the web's JWT.
* The switch. WebMCP is on by default (maintainer, 2026-10-09). The installation setting `webmcp.enabled`, default `true`, joins the installation settings of [ADR 0066][adr-0066] in place of `mcp.enabled`, which arrives with `/mcp`, and `northmes installation set webmcp.enabled false --reason <text>` turns WebMCP off with an audited command. The environment variable `NORTHMES_WEBMCP`, `on` or `off`, overrides the setting whenever it is set, and `northmes installation show` reports the override. The server reads the effective value, the web gets it with the permissions it loads for the plant, and while it is off the web registers no tool and the tool route answers 404.
* A browser agent can also operate the page's own screens as the user, as any browser automation can. Read-only tools and the switch limit what NorthMES offers agents, not what the user's browser can do. The user docs say so, and that a browser agent's model runs outside NorthMES, as they say for MCP clients.

### 5. Credentials

#### Integration tokens

* A Company admin creates them under Settings, Integrations, at `/settings/$companyId/core/integrations`, with the commands `core.createIntegrationToken` and `core.revokeIntegrationToken`. Both need the new permission `core.integration:manage` at company scope, which joins `companyPermissions`, so Plant admin does not hold it.
* Better Auth api-key, `configId` `integration`, prefix `nms_int_`, `references: "organization"` (the company is a Better Auth organization, [ADR 0007][adr-0007]). The core command calls `auth.api` on the server; the api-key HTTP paths stay disabled ([ADR 0011][adr-0011]).
* A token is bound to the company node or one plant node and holds one or more roles at that node. It acts as its own principal, of the new principal type `integration`, never as the person who created it.
* The secret is shown once, in the dialog that creates it, and stored hashed. Expiry is required, at most 365 days, default 90 days. `core.credential` records the name, the binding, the creator, the expiry and `last_used_at`, written at most once a minute per token. The Integrations page lists tokens with these fields and marks those that expire within 14 days.
* Revoke deletes the key at once and keeps the `core.credential` row for the audit trail ([ADR 0010][adr-0010]).

#### Personal access tokens

* A signed-in user creates them for themselves under their profile with `core.createPersonalAccessToken` and revokes them with `core.revokePersonalAccessToken`. A Company admin lists and revokes any token of the company's users.
* Release 1 has one kind, for the public REST API: Better Auth api-key `configId` `pat`, prefix `nms_pat_`. A token references the user and one of the user's companies, chosen when it is created, expires within 90 days and is shown once.
* A personal access token acts as the user. Each call's rights are the token's scopes intersected with a live `can()` ([ADR 0011][adr-0011]).

#### OAuth 2.1 clients

NorthMES runs one OAuth 2.1 authorization server on Better Auth's OAuth provider plugin, `@better-auth/oauth-provider` 1.7.6, with the jwt plugin that main already runs. In release 1 its one resource is the public REST API; `/mcp` becomes its second resource later (section 3). The issuer is `NORTHMES_PUBLIC_ORIGIN` plus Better Auth's base path.

* Registration. A Company admin registers clients under Settings, Integrations, with `core.registerOAuthClient`, `core.updateOAuthClient`, `core.rotateOAuthClientSecret` and `core.disableOAuthClient`, which call `auth.api.adminCreateOAuthClient` and its siblings on the server. A client belongs to the company that registered it. Dynamic client registration and client ID metadata documents stay off (section 3).
* Confidential clients (`client_secret_basic` or `client_secret_post`) may use `client_credentials`. Such a client is bound, like an integration token, to the company or one plant with roles there, and acts as its own principal of type `integration`. Its secret is shown once.
* Confidential and public clients (`token_endpoint_auth_method: "none"`) may use `authorization_code` with S256 PKCE, which OAuth 2.1 requires of both, plus `refresh_token`. Better Auth always requires PKCE of a public client and lets a confidential one skip it, so the registration commands create every client with `require_pkce: true`. The token acts as the user who consented.
* Redirect URIs match exactly, with no wildcard, no fragment and no query that varies. They use `https`, except loopback URIs `http://localhost` and `http://127.0.0.1` with any port, which native and command-line clients need ([ADR 0034][adr-0034], [ADR 0011][adr-0011]).
* The consent screen is a web route, `/oauth/consent`, and Better Auth's `consentPage` and `loginPage` point at the web app's origin. It names the client and the company that registered it, lists the requested scopes as the permission names the role editor shows, and offers Allow and Deny. A user revokes a consent under their profile, in Connected apps. Disabling a client revokes all its grants.
* Scopes are permission keys, such as `core.article:read` and `core.article:update`, plus `offline_access` for a refresh token. A client is registered with the scopes it may request; for a client credentials client these are at most the permissions of its roles. `openid` is off in release 1, because no client signs users in with NorthMES.
* Access tokens are JWTs signed with the jwt plugin's keys, with `aud` `NORTHMES_PUBLIC_ORIGIN + '/api/v1'`, the public REST API (RFC 8707). They live 10 minutes. Because the web's JWT is signed with the same keys, three rules keep the two apart:
  * the provider's `resources` holds exactly the public API's audience, plus `/mcp`'s once `/mcp` comes, and never the bare origin, which is the web's audience; boot exits when it holds anything else;
  * a token request without `resource` is refused, because the provider issues an opaque token when none is named, and every client is linked to the resources it may use;
  * the web guard accepts a JWT only when `aud` equals the origin and `sid` is present, and refuses one that carries `azp` or `client_id`.
* The public REST guard verifies an access token's signature, `iss`, `aud`, expiry and scopes in process, and checks through a cache of at most 60 seconds that the client is enabled and the grant not revoked, which keeps the 60-second bound of a revocation that the web's JWTs have.
* Refresh tokens rotate on every use, and `refreshTokenReuseInterval` is 0, so no window returns a cached response for a spent token. Reusing a spent refresh token revokes the whole grant. A refresh token expires 30 days after its last use. Client credentials get no refresh token.
* Each call's rights are the token's scopes intersected with a live `can()` of its principal: the user for the authorization code flow, the client for client credentials.

#### Credentials by surface

Every bearer credential arrives in `Authorization: Bearer`. The guard reads the prefix: `nms_int_` and `nms_pat_` are verified as api-keys of their `configId`, anything else as a JWT, by its `aud`.

| Surface | Accepts | Rejects |
|---|---|---|
| `/graphql`, `/api/v1/web/*` (including `/api/v1/web/tools/{tool}`) | the web's JWT (`aud` the public origin, with `sid`, without `azp` or `client_id`); the station cookie as [ADR 0011][adr-0011] says | integration tokens, personal access tokens and OAuth access tokens |
| Public REST, `/api/v1/<module-id>/...` | integration tokens; personal access tokens; OAuth access tokens with `aud` `.../api/v1` | the web's JWT, and cookies, which it ignores |
| `GET /api/v1/openapi.json` | the web's JWT, and every credential the public REST row accepts | anonymous requests |
| Better Auth's routes, including `/oauth2/authorize`, `/oauth2/token`, `/oauth2/revoke` and `/jwks` | as Better Auth defines them; the web's bearer session only at `/api/auth/token` and on the consent continuation | the api-key, admin and registration HTTP paths, which stay in `disabledPaths` |
| `/.well-known/oauth-authorization-server` | anonymous; metadata only | |

Integration tokens and client credentials clients reach no agent tool and no GraphQL field, because tools and the web act for people. Until `/mcp` comes, a request to `/mcp` finds no route; when it comes, it accepts only the credentials of section 3, and every other surface rejects them.

### 6. Audit, rate limits and the delivery order

Audit ([ADR 0013][adr-0013]):

* Surfaces `api` (public REST) and the new `webmcp` (the first-party tool route). A command row records the principal, its type (`user` or the new `integration`), the credential id from `core.credential` (the token or the OAuth grant), the OAuth client id when there is one, and the surface.
* Reads write no command row on any surface, so a WebMCP call never writes one while agent tools only read. Each read goes to the structured log with the correlation id, the credential id, the operation name and the surface, as ADR 0034 decides for tool reads.
* A denied call writes one `permission.denied` security event with its surface. Creating, revoking and rotating credentials, registering and disabling clients, and a refresh token reuse that revokes a grant each write a command row or a security event.

Rate limits, counted per credential in the Postgres `ThrottlerStorage` that ADR 0064 requires from the first public route:

* Public REST: 600 reads and 60 writes per minute per credential.
* `/api/v1/web/tools/{tool}`: 120 calls per minute per session.
* The OAuth token endpoint: Better Auth's own limiter, with database storage, at 30 requests per minute per client.
* A refusal is 429 with `core.request.rate_limited` and `Retry-After`; WebMCP gets the same code in the tool error.

Delivery in waves. Each wave is a set of stories that each pass `pnpm check`:

1. Dependencies, landed on main: `@nestjs/swagger` 12.0.2 (#423), `zod-openapi` 6.0.2 (#425), `@better-auth/oauth-provider` 1.7.6 (#427), and `@modelcontextprotocol/server` and `@modelcontextprotocol/client` 2.1.0 (#429), which no release 1 code uses.
2. Where an article lives: `company_id`, `scope_span` and the exclusion constraint on `core.article`, `owner` on `core.createArticle`, `core.promoteArticle` with `core.article:promote` and `corePromoteArticle`, and the owner column, the owner choice and the Promote action in the web.
3. The operation contract: `defineQueryContract`, `defineListQueryContract` with core's article list declaration moved into its contracts package, `outsideText()`, `defineOperations`, `bindOperations`, the runner with its tool output rules and error mapping, `context.require` on the command bus, `operationsConformance`, `core.upsertArticle` and the article operations bound in the backend. GraphQL gains `coreUpsertArticle` from the same command.
4. Public REST and OpenAPI: `toRestRoutes`, the document builder and `northmes openapi print`, `schema/openapi-v1.json`, the oasdiff gate, `GET /api/v1/openapi.json`, the audit surface `api`, the principal type `integration`, integration tokens, personal access tokens, Settings, Integrations, the credential guard and the Postgres throttler.
5. WebMCP with core's toolset: `toWebMcpTool`, the tool route, `core_search` and `core_get_article`, toolsets by route, the CI check on toolset size, `webmcp.enabled` and `NORTHMES_WEBMCP`, the `Permissions-Policy` header, the audit surface `webmcp` and the registration lifecycle.
6. OAuth 2.1 for the public API, starting with the `/token` question under More information: client registration, client credentials, the authorization code flow with PKCE, the consent screen, Connected apps, refresh rotation and the authorization server metadata.
7. Planning's read tools join as the planning stories that own them land ([ADR 0034][adr-0034]), and `toAgentTool` with the assistant ([ADR 0035][adr-0035]).

`/mcp` is no wave of release 1; section 3 describes it.

### Changes to ADR 0007

* The row "Articles, routings | company" of "Where rows live" becomes two rows: articles at company or plant, with a plant article promoted to the company by `core.promoteArticle`; routings at company. Customers stay at company, as ADR 0007 says.
* On article routes, "REST routes take the plant from the path" means the optional `plant` query parameter of section 2. A request without it acts at the company, and the server still never picks a plant for a caller.

### Changes to ADR 0011

* Principal types gain `integration`: an outside system, with an integration token or a client credentials client, surface `api`, `acting_for` none. A person through an OAuth client is principal `user` with the OAuth grant as credential and surface `api`.
* The principal table gains two `user` rows: a person through a browser agent, with the web's JWT as credential, surface `webmcp` and `acting_for` none; and a person through a personal access token of `configId` `pat`, surface `api`.
* The driver "MCP agents act as the user but never commit a change as the user" holds for WebMCP tools too: the tool route runs read operations only.
* The credential table becomes the one under [Credentials by surface](#credentials-by-surface). The rows marked "later" for public routes and `openapi.json` are decided here. The `/mcp` row waits for `/mcp` and then changes as section 3 says.
* "When dynamic client registration arrives with OAuth login for MCP" stays as written: registration stays off, and the redirect URI rules of section 5 apply to registered clients.

### Changes to ADR 0012

* "the SDK generates the mutation field, so a module writes no resolver for it" no longer holds. `defineCommand` registers the command's handler with the bus and keeps deriving the input type from the contract, and the module writes a thin mutation resolver in `api/` that calls its service, which sends the command. The maintainer's rule that every surface calls the service, under section 1, is the reason.
* The handler context gains `context.require(permission, scopeId)`, which a handler calls for a scope that neither the contract's target nor its scope hook names: the row that the upsert by article number finds, and the company node that a promoted article moves to. It runs step 3's `can()` check at that scope; a denial rolls the command back and writes the `permission.denied` event as step 3 does. Steps 3 to 5 stay in their order, and every successful command, a no-op upsert included, still writes exactly one `audit.command` row.

### Changes to ADR 0022

* "Environment variables hold only infrastructure settings and secrets; behaviour-affecting configuration never lives there" gains one exception, by the maintainer's decision of 2026-10-09: `NORTHMES_WEBMCP` overrides the installation setting `webmcp.enabled` (section 4). The setting stays the audited switch, and `/mcp`'s switch stays a setting without an override.

### Changes to ADR 0031

* "No integration REST API in release 1" no longer holds. The public family starts with core's article operations under section 2. Connectors still run in process, and `upsertArticle` is open to connectors as a canonical import command.

### Changes to ADR 0034

* `/mcp` leaves release 1 (maintainer, 2026-10-09). The endpoint, its sign-in, its toolset parameter and `mcp.enabled` wait for the step of section 3. The tool definitions and the runner stay, as ADR 0034's "What waits" already keeps them for the assistant, and serve WebMCP.
* WebMCP leaves "What waits" and ships in release 1 with read tools only. Its switch, `webmcp.enabled`, is on by default, and the environment variable `NORTHMES_WEBMCP` overrides it, while ADR 0034 makes `/mcp`'s switch a setting that is off by default and never an environment variable. `/mcp` keeps that rule.
* "The cap is eight tools" becomes at most four tools per module toolset. A client picks toolsets by URL, and core and planning are the defaults, which takes the client's part of "per-organization toolset toggles" out of "What waits". The CI check counts the tools of each module.
* The release 1 toolset becomes core's `core_search` and `core_get_article`, plus `core_list_plants` with `/mcp`, and planning's three read tools and `planning_propose_changes` as section 1 proposes.
* "Agent writes are proposals that a person commits" stays, and agent surfaces register read tools only until the maintainer opens agent writes. `planning_propose_changes` stays the in-app assistant's tool ([ADR 0036][adr-0036]).
* The tool rule on ERP free text and the personal-field redactor stay as written and run in the operation runner's step 6 for `webmcp`, and for `mcp` and `assistant` when they come; a field is outside text when its contract marks it with `outsideText()`.
* "Every plant-scoped tool takes an explicit `plant` argument" stays for `/mcp`, where `toMcpTool` adds it from the declaration's `scope`. WebMCP tools take the page's plant.
* `defineTool`'s data moves into the operation declaration in the contracts package; the handler is bound in the backend. The shared runner becomes the operation runner and also serves REST and WebMCP.
* "OAuth 2.1 login through Better Auth's MCP plugin, with client ID metadata documents and a dynamic client registration fallback" becomes OAuth 2.1 through the OAuth provider plugin of section 5, with `/mcp` as a second resource. The maintainer chose OAuth sign-in for MCP clients on 2026-10-09, which answers ADR 0034's open confirmation of personal access tokens before OAuth. Client ID metadata documents, dynamic registration and the `mcp` personal access token are decided with `/mcp` (section 3).

### Changes to ADR 0055

* The ledger gains one row: "Platform surfaces of ADR 0073: articles at company or plant with promote, the operation contract, the public REST API for articles with OpenAPI and the oasdiff gate, integration tokens, personal access tokens, OAuth 2.1 clients and WebMCP with read tools", with the planning session's unmeasured estimate of 25 to 41 raw days (wave 2: 2 to 4; wave 3: 4 to 6; wave 4: 8 to 12; wave 5: 3 to 5; wave 6: 8 to 14).
* "The MCP read-mostly planning toolset" becomes planning's read tools on WebMCP. The `/mcp` endpoint, counted at 8 to 13 days, leaves release 1 for "Later platform work and its triggers", with the trigger of section 3.
* "Later platform work and its triggers" loses the integration REST API with scoped tokens, OAuth applications and machine-to-machine auth, and WebMCP, which enter release 1 by the maintainer's decisions of 2026-10-09.
* Cut order item 3 becomes WebMCP (the tool route, the adapter and the setting); the operation runner stays, because REST uses it.

### Changes to ADR 0064

* The public API starts in release 1, with core's articles. "Release 1 has no public route" and the route inventory test's "no route is in the public family" no longer hold.
* A module's public routes come from its operation declarations through `toRestRoutes`, not from hand-written controllers in `server/rest/v1/`, and its public schemas live in `contracts/src/operations/`.
* Lists reuse the cursors, paging, `orderBy`, filters and search of the connection conventions through `defineListQueryContract`, and return `nodes` instead of `edges`.
* A resource whose rows sit at the company or at one plant has no plant segment and takes an optional `plant` query parameter, so articles live at `/api/v1/core/articles` (maintainer, 2026-10-09). "A plant-scoped route takes the plant as a path segment" holds for operations with `scope: 'plant'`.
* The root allowlist gains `/.well-known/oauth-authorization-server`, and `/.well-known/oauth-protected-resource/*` when `/mcp` comes.
* The plant slug schema also refuses `oauth`, because `/oauth/consent` is a web route.
* `openapi.json` and the public routes accept the credentials in the table above, not only integration tokens.

### Changes to ADR 0010 and ADR 0013

* [ADR 0010][adr-0010]: `core.role_assignment` assigns a role to a principal, a user or a `core.credential` row of an integration token or a client credentials client, instead of to a user only, and `can()` walks the scope tree for both.
* [ADR 0013][adr-0013]: the surfaces gain `api` and `webmcp`, the principal types gain `integration`, and a command row records the OAuth client id.

### Consequences

* Good, because a module declares a capability once and gets REST, OpenAPI and a WebMCP tool now, and an MCP tool and an assistant tool later, with the same permission check, output schema and error codes.
* Good, because every write on every surface still runs through the command bus and lands on one audit row with its surface, and agents write nothing, so ADR 0036's rule that AI never commits a change holds unchanged.
* Good, because a toolset of at most four tools, chosen by URL, keeps an agent's context small.
* Good, because WebMCP reaches an installation on a plant LAN with no public URL, since it runs in the user's browser, and adds nothing to a browser without it.
* Good, because a plant admin creates the plant's own articles, the company keeps shared articles at company level, and one command promotes a plant article when other plants need it.
* Good, because an ERP can push articles with one idempotent call per article and needs no idempotency store.
* Good, because one authorization server serves integrations now and MCP clients later, and every credential is bound to the surfaces its prefix or audience names.
* Bad, because release 1 grows by the ledger row above, before the pilot's planning work, less the 8 to 13 days of `/mcp`.
* Bad, because agent clients outside the browser, such as Claude Code, get no NorthMES tools until `/mcp` comes.
* Bad, because WebMCP is on by default, so an installation that never asked for an agent surface has one until its admin turns it off, and a browser agent can still operate the page's screens whatever the switch says.
* Bad, because `NORTHMES_WEBMCP` puts a behaviour switch in the environment, against ADR 0022's rule.
* Bad, because two plants that use the same article number block its promotion until one of them renames, and a company row cannot reference a plant article ([ADR 0009][adr-0009]).
* Bad, because an ERP that pushes its whole catalog writes one command row per article, changed or not.
* Bad, because a plant slug in the `plant` parameter makes a slug rename a breaking change for integrations that read plant articles.
* Bad, because WebMCP is a draft that changed its entry point in May 2026 and may change again, and only Chrome behind a flag can test it by hand.
* Bad, because NorthMES owns the consent screen, the client and token pages and the credential guard.

### Confirmation

* `packages/contracts/test/define-operations.test.ts`: "an operation whose tool name lacks its module prefix throws naming the operation"; "a REST path outside the module segment throws"; "a query contract without an output schema throws".
* `packages/sdk/test/operations/runner.test.ts`: "a query handler that returns an extra key sends a result without it"; "an outsideText field is wrapped as untrusted and capped at 500 characters on the webmcp surface and returned plain on api"; "the personal-field redactor runs on every tool output"; "an unknown error maps to core.internal with the correlation id".
* A CI check fails when a module's tools number more than four.
* `apps/backend/test/operations/conformance.int.test.ts`, through `operationsConformance(articleOperations)`: every article REST operation is served and is in the OpenAPI document; `core_get_article` runs through the tool route for a Plant admin and is refused for a user without `core.article:read`.
* `apps/backend/test/modules/core/article-owner.int.test.ts`: "a Plant admin at HEL creates a plant article and gets core.forbidden creating one with owner company"; "a company article is in the lists of HEL and STO"; "a HEL article is not in STO's list"; "a Company admin promotes a HEL article, which STO then reads"; "a Plant admin gets core.forbidden promoting an article of its plant"; "a promotion while STO has an article with the same code fails with core.code_taken".
* `apps/backend/test/rest/v1-articles.int.test.ts`: "a list without plant returns company articles only, and with plant=hel also HEL's"; "a list with first 2 returns two articles and a cursor that returns the third"; "a create with owner plant and no plant parameter returns 400 with a field error on owner"; "a create retried with the same id returns 200 and the first article"; "an update with a stale expectedVersion returns 409 core.version_conflict as application/problem+json"; "an upsert with a new number returns 201, and with the same number and name returns 200 with the same version and one command row without field changes"; "an upsert with owner company whose code a plant article uses returns 409 core.code_taken"; "an upsert that finds a row at a scope where the caller lacks core.article:update returns 403, leaves no command row and writes permission.denied"; "an upsert on an archived article returns 409 core.archived"; "a read with the ETag in If-None-Match returns 304"; "a token bound to plant A gets 403 core.plant_forbidden with plant=b"; "a write writes one audit.command row with surface api and principal type integration".
* `apps/backend/test/credentials-by-surface.int.test.ts` gains one case per cell of the credential table, for example "an integration token on POST /graphql returns 401", "a pat token on /api/v1/web/tools/core_search returns 401" and "the web's JWT on a public route returns 401".
* `apps/backend/test/oauth/*.int.test.ts`: "client credentials for a client bound to plant A returns a token whose aud is /api/v1 and which lists articles at A"; "an authorization code without a code_verifier is refused"; "a redirect_uri https://attacker.example.test/cb is refused at registration"; "a reused refresh token revokes the grant and the next access token check fails within 60 seconds"; "a scope outside the client's registered scopes is refused"; "a token request without resource is refused"; "boot exits when the provider's resources hold the bare origin"; "a JWT signed with the jwt plugin's keys, with aud the origin, sid and azp, is refused by the web guard".
* `apps/backend/test/rest/web-tools.int.test.ts`: "core_search at HEL returns company and HEL articles and no STO article"; "a tool call writes no command row and logs the operation with surface webmcp"; "the tool route refuses an operation whose effect is not read"; "an integration token on the tool route returns 401"; "the tool route returns 404 while WebMCP is off".
* `apps/backend/test/config/webmcp-switch.int.test.ts`: "WebMCP is on in a new installation"; "northmes installation set webmcp.enabled false turns it off and writes one command row"; "NORTHMES_WEBMCP=off wins over webmcp.enabled true, and on wins over false". `apps/backend/test/web/shell.int.test.ts`: "the shell sends Permissions-Policy tools=(self)".
* `apps/web/test/webmcp/adapter.test.ts`, with a fake `document.modelContext`: "nothing is registered when neither document.modelContext nor navigator.modelContext exists"; "core's and planning's tools are registered on any route, and a third module's only on its own route"; "a user without core.article:read at the plant gets no core_search"; "a plant switch aborts the registrations and registers the new plant's tools"; "sign-out aborts every registration"; "execute posts to /api/v1/web/tools/core_search with the plant header"; "no registration passes exposedTo"; "nothing is registered while WebMCP is off".
* `apps/backend/test/rest/rate-limit.int.test.ts`: "the 61st write in a minute from one token returns 429 core.request.rate_limited with Retry-After".
* The route inventory test lists the article routes in the public family and `/.well-known/oauth-authorization-server` on the root allowlist.

## Pros and cons of the options

### One operation contract per capability

* Good, because the web, the backend and the OpenAPI printer read one MIT declaration.
* Good, because the runner is the only place where input parsing, permission, row scope, output validation and error mapping happen.
* Bad, because it adds two contract helpers and an adapter per surface before the second module uses them.
* Bad, because REST paths and tool texts are written in a contracts package that so far held only schemas.

### Hand-written surfaces

* Good, because each surface can be shaped freely.
* Bad, because every capability is written up to four times, and the permission and error rules drift between them.
* Bad, because the browser cannot reuse a server-side `defineTool` that carries its handler.

### GraphQL as the only contract

* Good, because GraphQL already carries every command.
* Bad, because GraphQL's types are not the published shape of REST or a tool, OpenAPI from a GraphQL schema loses the Zod checks, and the web's GraphQL changes in any minor while public REST carries a promise.

### A tools-first contract

* Good, because it is ADR 0034's `defineTool` as decided.
* Bad, because tool shapes follow model limits (no unions, flat arrays, an explicit plant), which REST does not need, and a REST route per tool gives odd paths.
* Bad, because the handler inside the definition keeps it out of the web app.

### Smaller choices

| Question | Chosen | Left out | Reason |
|---|---|---|---|
| Agent surface in release 1 | WebMCP | `/mcp` with OAuth; both | the maintainer's decision; WebMCP reaches a LAN installation from the user's browser, while hosted MCP clients need a public URL or a tunnel |
| Agent tools | read tools only | article write tools; an import that an agent proposes and a person commits | the maintainer's decision; reads answer the questions agents are expected to ask |
| Tool count | four per module toolset, chosen by URL, core and planning by default | eight per toolset and sixteen in all; every module's tools at once | the maintainer's decision; every tool definition fills the model's context |
| Article owner | the company or one plant, with promote | company articles assigned to plants; plant articles only | hiding unassigned company articles would make row-level security join an assignment table in every module's ancestor walk, and plant articles only would leave the company without shared articles |
| Article path | `/api/v1/core/articles` with an optional `plant` parameter | `/api/v1/core/plants/{plant}/articles` | the maintainer's decision; an article's plant is optional, so it cannot be a required path segment |
| WebMCP switch | on by default, an installation setting with an environment override | off by default like `/mcp` | the maintainer's decision |
| Upsert key | the article number (`code`) among the rows the request reads | an external reference | the ERP knows its article number; core has no external reference column yet |
| Version on writes | `expectedVersion` in the body; `ETag` on reads | `If-Match` | the contract already carries the version, and two sources could disagree |
| WebMCP execution | the first-party route `/api/v1/web/tools/{tool}` through the runner | GraphQL operations per tool in the page; the public REST route with the web's JWT | one runner for every agent surface; the public family keeps people's browser credentials out |
| Token kinds on api-key | `integration` and `pat`, one surface each | one personal token valid on REST and `/mcp` | ADR 0011 binds a credential to the surfaces it was issued for |
| OAuth server | `@better-auth/oauth-provider`, with the public API as its resource and `/mcp` later as a second | Better Auth's MCP plugin; a separate authorization server | the MCP plugin is an OAuth provider for one resource; a separate server is a second deployable |
| Access token lifetime | 10 minutes, with a 60-second revocation check | 5 minutes like the web's JWT; 60 minutes | short enough for a lost token, long enough for a batch of ERP calls, and revocation does not wait for expiry |

## More information

* Related ADRs: [0007][adr-0007] plants and scopes, [0009][adr-0009] codes per scope, [0010][adr-0010] identity and `can()`, [0011][adr-0011] principals and credentials, [0012][adr-0012] commands, [0013][adr-0013] audit, [0017][adr-0017] Zod contracts, [0022][adr-0022] settings, [0031][adr-0031] ERP integration, [0034][adr-0034] MCP, [0035][adr-0035] the assistant, [0036][adr-0036] proposals, [0040][adr-0040] license policy, [0055][adr-0055] scope, [0062][adr-0062] module link manifests (the pattern the operation declaration follows), [0064][adr-0064] REST and OpenAPI, [0066][adr-0066] company and installation settings.
* Plan: [05 GraphQL and APIs](../plan/05-graphql-and-apis.md) (errors, credentials, the public API and the MCP endpoint) and [10 AI and agents](../plan/10-ai-and-agents.md) (the runner, the toolsets and on-prem reachability) follow this ADR once it is accepted.
* WebMCP: https://webmachinelearning.github.io/webmcp/ (Draft Community Group Report). MCP authorization: https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization. Better Auth OAuth provider: https://www.better-auth.com/docs/plugins/oauth-provider. Better Auth API keys: https://www.better-auth.com/docs/plugins/api-key.
* Tool count: https://www.anthropic.com/engineering/writing-tools-for-agents and the toolsets of https://github.com/github/github-mcp-server. Reach: https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp (hosted connectors call from the vendor's cloud), https://platform.claude.com/docs/en/api/ip-addresses (outbound ranges), https://claude.com/docs/connectors/mcp-tunnels/overview, https://developers.openai.com/blog/connect-private-mcp-servers-to-openai-products and https://github.com/geelen/mcp-remote.
* Unverified, to settle in the wave that relies on it:
  * how the provider's own token endpoint coexists with the web's JWT at `/api/auth/token`: Better Auth's OAuth provider documentation puts `/token` in `disabledPaths` and sets the jwt plugin's `disableSettingJwtHeader`, while main mints the web's JWT at that path, so wave 6 starts by proving both work in one instance or by moving the web's JWT to a NorthMES route;
  * whether a token request without `resource` can be refused, rather than answered with an opaque token;
  * whether `@better-auth/oauth-provider` 1.7.6 continues an authorization from a consent page on another origin that sends the web's bearer session instead of a cookie;
  * whether it issues JWT access tokens for a resource with the jwt plugin options main already sets, and how it names the RFC 8414 metadata path for an issuer with a path;
  * whether `@better-auth/api-key` 1.7.6 reads a key from `Authorization: Bearer` through `customAPIKeyGetter` when two `configId` values share the header;
  * which Chrome builds expose `navigator.modelContext` and whether they take a `signal`.
* Open: a `updatedSince` filter for ERP sync; moving a company article back to one plant; which reach tier the pilot customer's network allows, asked before `/mcp` is planned; whether the MCP SDK packages of #429 stay pinned until `/mcp`.
* Revisit when a second module declares operations, when WebMCP changes its entry point or leaves the origin trial, when a customer needs `/mcp`, and before 1.0.

[adr-0007]: 0007-tenancy-company-plants-and-the-scope-tree.md
[adr-0009]: 0009-code-uniqueness-per-scope-with-an-exclusion-constraint.md
[adr-0010]: 0010-identity-with-better-auth-roles-and-permissions-in-core-tables.md
[adr-0011]: 0011-principals-credentials-and-same-origin-rules.md
[adr-0012]: 0012-commands-as-the-single-write-path.md
[adr-0013]: 0013-audit-trail-written-in-the-command-transaction.md
[adr-0017]: 0017-zod-contracts-as-the-single-source-for-inputs.md
[adr-0022]: 0022-shared-building-blocks-packages-the-master-data-kit-settings-and-generators.md
[adr-0031]: 0031-erp-integration-connector-modules-field-ownership-and-pending-changes.md
[adr-0034]: 0034-mcp-surface-one-endpoint-a-read-mostly-planning-toolset.md
[adr-0035]: 0035-ai-provider-port-with-customer-configured-providers.md
[adr-0036]: 0036-agent-proposals-as-planning-records-a-person-commits.md
[adr-0040]: 0040-dependency-license-policy-ci-gate-and-sbom.md
[adr-0055]: 0055-release-1-scope-under-option-b-and-the-scope-rule.md
[adr-0062]: 0062-web-form-contracts-url-view-state-and-module-link-manifests.md
[adr-0064]: 0064-rest-routes-under-api-v1-and-openapi-from-zod-contracts.md
[adr-0066]: 0066-companies-created-by-the-cli-plant-slugs-unique-per-installation-company-settings-at-settings-and-an-onboarding-wizard-before-a-plant-opens.md
