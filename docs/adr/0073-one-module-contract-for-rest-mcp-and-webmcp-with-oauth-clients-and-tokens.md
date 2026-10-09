---
status: "proposed"
date: 2026-10-09
decision-makers: proposed by the planning session, to be confirmed by Krister Johansson
consulted: Krister Johansson; the WebMCP draft of the W3C Web Machine Learning Community Group; Better Auth's OAuth provider and api-key documentation
informed: contributors, coding agents, module and plugin authors, pilot IT
release: "1"
needs-confirmation: "maintainer (article write tools on /mcp and WebMCP, where an agent runs a command as the user; articles under the plant segment of the public path; the audit surface webmcp and the principal type integration; the cap of eight tools per toolset and sixteen in all; token lifetimes and rate limit numbers; the ADR 0055 ledger row and its estimate; the navigator.modelContext fallback)"
---

# One module contract for REST, MCP and WebMCP with OAuth clients and tokens

## Context and problem statement

On 2026-10-09 Krister Johansson asked: "The next thing is if we can create the api for articles, with support for oauth and service token?" He chose REST with OpenAPI as the public family of [ADR 0064][adr-0064], both OAuth flows now (client credentials for machine to machine, and the authorization code flow with PKCE and a consent screen, so an ERP can offer "Connect with NorthMES" and act for a signed-in user), both token kinds (integration tokens that a Company admin creates and personal access tokens that act as the user), and the full article set plus an upsert by article number, so an ERP can push its articles. He then added: "The ide is to have the basic things in place lime webmcp and mcp so we have the base and structure for starting creating the other modules later".

So the subject is the platform base that every later module uses, with articles as its first user. Today a module reaches GraphQL through `defineCommand` and the list kit, while [ADR 0034][adr-0034] plans `defineTool`, a shared runner and `/mcp`, and [ADR 0064][adr-0064] plans public REST routes, OpenAPI and integration tokens for "the first outside system". Nothing says how one capability of a module, such as "find articles" or "archive an article", reaches REST, `/mcp`, the browser and the later in-app assistant without being written four times, nor which credential each surface accepts once OAuth and two token kinds exist.

[ADR 0031][adr-0031] said the integration API comes "when an outside system needs it". The maintainer's request is that trigger. [ADR 0034][adr-0034] deferred WebMCP, and this request brings it in. Other decisions of the same days that this ADR builds on: one installation per customer, the web signs in with email only, Company admin holds every installed permission and Plant admin all but the company-level ones, and every write goes through the command bus with a permission check at the row's scope ([ADR 0012][adr-0012]).

Main at 42fe1ecb has one NestJS backend in `apps/backend` with module code in `apps/backend/src/modules/<id>/{api,core,infrastructure}`, one web app in `apps/web` with module code in `apps/web/src/modules/<id>`, the MIT contracts packages in `modules/<id>/contracts`, `ApiController` in `packages/sdk/src/rest/api-controller.ts`, and Better Auth 1.7.6 pinned exactly with the username, organization, admin, api-key (`@better-auth/api-key` 1.7.6), bearer and jwt plugins. The web holds a bearer session and sends a five-minute JWT minted at `/api/auth/token` on every request. Articles live at plant scope: `core.createArticle` writes the row at the request's plant.

This ADR covers the operation contract in `@northmes/contracts` and `@northmes/sdk`, the shared runner, the REST, MCP and WebMCP adapters, the article operations of core, the credentials (integration tokens, personal access tokens and OAuth 2.1 clients), the credential table per surface, audit, rate limits and the delivery order.

## Decision drivers

* The maintainer's request and choices of 2026-10-09, quoted above.
* A module author declares a capability once. Each surface is an adapter, so a fix in the runner reaches every surface, as [ADR 0034][adr-0034] already decided for MCP and the assistant.
* Every write runs through the command bus, which parses the contract, checks the permission at the row's scope, checks `expectedVersion` and writes the audit row ([ADR 0012][adr-0012], [ADR 0013][adr-0013]).
* Zod contracts are the single source of inputs, and of outputs for every surface that publishes a schema ([ADR 0017][adr-0017]).
* A credential works only on the surfaces it was issued for ([ADR 0011][adr-0011]).
* The web app imports only MIT contracts and its own code, so anything the browser registers as a tool must be declared in the contracts package.
* WebMCP is a Community Group draft, shipped only in Chrome behind a flag or an origin trial, in secure contexts. The page must work the same without it.
* MCP's authorization specification is OAuth 2.1 with PKCE, so one authorization server can serve integrations and MCP clients.
* The scope rule of [ADR 0055][adr-0055]: an item enters release 1 by the maintainer's decision, recorded in its ledger, and no manifest key or flag ships without the code that reads it.
* A new dependency is published before 2026-09-25 (Renovate's 14-day window) and passes the license policy of [ADR 0040][adr-0040].

## Considered options

* One operation contract per capability, declared in the module's contracts package and bound to a handler in the backend, with adapters for REST, `/mcp`, WebMCP and the assistant
* Hand-written surfaces: a public controller per resource, a `defineTool` per tool and a WebMCP registration per screen
* GraphQL as the only contract: REST and tools generated from the GraphQL schema
* A tools-first contract: `defineTool` as in ADR 0034, with REST routes generated from tools

## Decision outcome

Chosen option: "One operation contract per capability", because it puts the data every surface needs (schemas, permission, REST route, tool text and annotations) where both the backend and the web can import it, keeps the handler on the server, and sends every call through one runner and the command bus. The maintainer decided the surfaces, the flows, the token kinds and the article set; the contract shape, the paths, the credential rules, the numbers and the waves below are the planning session's proposal.

### 1. The operation contract

An operation is one capability of a module: a command or a query. A module declares it once.

* Commands keep `defineCommandContract` in `@northmes/contracts` ([ADR 0017][adr-0017]).
* Reads get `defineQueryContract({ name, input, output, permission })` in `@northmes/contracts`: a module-prefixed name such as `core.findArticles`, a Zod input, a Zod output and one permission key. A query never writes.
* `defineOperations({ module, resource, operations })` in `@northmes/contracts` lists, for one resource, each operation with its contract and the surfaces it reaches:
  * `rest`: the method, the path under the module segment and the success status, or `false`;
  * `tool`: the tool name, title, description, annotations (`readOnlyHint`, `destructiveHint`, and `consequentialHint` for WebMCP), effect (`read`, `proposal` or `command`) and toolset, or `false`;
  * `webmcp`: `true` to register the tool in the browser, default `false`.
* The declaration is plain data in the MIT contracts package. It imports no MCP SDK, no Nest and no web code, so the backend, the web app and `northmes openapi print` read the same object.
* The backend binds handlers with `bindOperations(declaration, handlers)` from a new MIT subpath, `@northmes/sdk/operations`. A query's handler is a service method; a command's handler is the command provider that `defineCommand` already registers, so the operation adds no second write path.

```ts
// modules/core/contracts/src/operations/article.ts (sketch, names proposed)
export const articleOperations = defineOperations({
  module: 'core',
  resource: 'articles',
  operations: {
    find: {
      contract: findArticles,
      rest: { method: 'GET', path: 'plants/{plant}/articles' },
      tool: { name: 'core_find_articles', effect: 'read', toolset: 'core', description: 'Find articles by number or name at a plant.' },
      webmcp: true,
    },
    upsert: {
      contract: upsertArticle,
      rest: { method: 'POST', path: 'plants/{plant}/commands/upsert-article' },
      tool: { name: 'core_save_article', effect: 'command', toolset: 'core', description: 'Create an article or rename the one with this number.' },
      webmcp: true,
    },
    // get, create, update, archive and restore follow the table under section 2
  },
});

// apps/backend/src/modules/core/api/article/article.operations.ts
export const articleOperationsProvider = bindOperations(articleOperations, {
  find: (input, ctx) => ctx.get(ArticleService).find(input),
  get: (input, ctx) => ctx.get(ArticleService).byIdOrThrow(input.id),
  upsert: upsertArticleCommand,
  // ...
});
```

The shared runner of [ADR 0034][adr-0034] becomes the operation runner, in the host under `apps/backend/src/operations/`. For every call, from every surface, it:

1. resolves the principal and the plant through `PrincipalResolver`, and records the surface;
2. parses the input with the contract;
3. checks the operation's permission at the plant as a coarse gate (the command bus checks again at the row's scope);
4. for a query, runs the handler in a transaction with the row-level security scope in `SET TRANSACTION READ ONLY`; for a command, sends the parsed input to the command bus;
5. validates the output against the contract's output schema and drops any key outside it;
6. maps errors once: a `DomainError` keeps its code, status and field errors, anything else becomes `core.internal` with the correlation id ([05 GraphQL and APIs](../plan/05-graphql-and-apis.md#error-model)).

The adapters sit on the runner and only translate:

| Adapter | Where | Turns the runner into |
|---|---|---|
| `toRestRoutes` | host, `apps/backend/src/http/public-api/` | Nest routes in a public `ApiController` per module, the OpenAPI operations and components, and `application/problem+json` errors |
| `toMcpTool` | host, `apps/backend/src/mcp/` | `@modelcontextprotocol/server` tools with `structuredContent`, the same JSON as text, and `isError` results |
| `toWebMcpTool` | web, `apps/web/src/shell/webmcp/` | `document.modelContext.registerTool` entries whose `execute` posts to the first-party tool route |
| `toAgentTool` | the `ai` module, later | AI SDK tools for the in-app assistant ([ADR 0035][adr-0035]) |

GraphQL stays the web app's own API. Its mutations keep coming from `defineCommand`, and its list fields keep coming from the list kit; a query operation's handler and the GraphQL resolver call the same service method.

What a new module adds, and nothing else:

1. command and query contracts in `modules/<id>/contracts/src/`, and one `operations/<resource>.ts` per resource with `defineOperations`;
2. `apps/backend/src/modules/<id>/api/<resource>/<resource>.operations.ts` with `bindOperations`, listed in the module's Nest module;
3. the module's `operations` on its entry in `apps/web/src/modules.ts`, which the WebMCP adapter reads;
4. one conformance test per resource, `operationsConformance(declaration)` from `@northmes/testing`, which checks that every REST operation is served and appears in the OpenAPI document, every tool appears in `tools/list` for a user who holds its permission and not for one who does not, and every WebMCP tool is registered only for such a user.

[ADR 0064][adr-0064] put a module's public controllers under `modules/<id>/server/rest/v1/` and its schemas under `contracts/src/rest/v1/`. With operations, a module writes no public controller, and its public schemas are its operation contracts in `contracts/src/operations/`. A v2 shape goes in `contracts/src/operations/v2/` when v2 starts.

### 2. The public REST family for articles

The public API of [ADR 0064][adr-0064] starts with core's articles. Articles live at plant scope on main, so the paths carry the plant segment that ADR 0064 requires for plant-scoped routes. The maintainer's "/api/v1/core/articles" therefore becomes `/api/v1/core/plants/{plant}/articles`, with `{plant}` the plant slug.

| Operation | Contract | Route | Operation id | Tool |
|---|---|---|---|---|
| List | `core.findArticles` (query) | `GET /api/v1/core/plants/{plant}/articles` | `coreArticles` | `core_find_articles` |
| Read | `core.getArticle` (query) | `GET /api/v1/core/plants/{plant}/articles/{id}` | `coreArticle` | `core_get_article` |
| Create | `core.createArticle` | `POST /api/v1/core/plants/{plant}/commands/create-article` | `coreCreateArticle` | none |
| Update | `core.updateArticle` | `POST /api/v1/core/plants/{plant}/commands/update-article` | `coreUpdateArticle` | none |
| Archive | `core.archiveArticle` | `POST /api/v1/core/plants/{plant}/commands/archive-article` | `coreArchiveArticle` | `core_archive_article` |
| Restore | `core.restoreArticle` | `POST /api/v1/core/plants/{plant}/commands/restore-article` | `coreRestoreArticle` | `core_restore_article` |
| Upsert by article number | `core.upsertArticle` (new) | `POST /api/v1/core/plants/{plant}/commands/upsert-article` | `coreUpsertArticle` | `core_save_article` |

* List. Query parameters `first` (default 25, at most 100), `after` (the opaque cursor of [05 GraphQL and APIs](../plan/05-graphql-and-apis.md#cursors)), `orderBy` (`code`, `-code`, `name` or `-name`), `code` (exact match), `search` (the list kit's search over code and name) and `includeArchived` (default false). The body is `{ nodes, pageInfo: { hasNextPage, endCursor } }`. A cursor used with another `orderBy` is 400 `core.list.invalid_cursor`.
* Read. The body is the article: `{ id, code, name, version, archivedAt }`, component `CoreArticle`. A missing id, or one at a scope the caller cannot read, is 404.
* Create. The body is `core.createArticle`'s input with the client's uuidv7 `id`. A new row answers 201; a retry with an id that already exists answers 200 with the stored article, which the caller compares ([ADR 0012][adr-0012], [ADR 0064][adr-0064]).
* Update, archive and restore. The body is the contract input with `id` and `expectedVersion`. A stale version is 409 `core.version_conflict`.
* Upsert. `core.upsertArticle` takes `{ id, code, name, expectedVersion? }`. It finds the article with this code at the plant. None: it creates one under `id` (201). One that is active: it renames it if `name` differs, checking `expectedVersion` when given, and answers 200; an unchanged name bumps no version and writes no command row, as imports write only changed rows ([ADR 0031][adr-0031]). One that is archived: 409 `core.archived`. The contract's permission is `core.article:create` at the plant; when the code matches a row, the handler asks the bus for `core.article:update` at that row's scope through a new `context.require(permission, scopeId)` on the handler context, so the check stays in the bus and on the audit row. The ERP sends the same request again after a timeout and gets the same result.
* Versions and ETags. Every article response carries `ETag: "<version>"`. A read with a matching `If-None-Match` answers 304. Writes take the version only as `expectedVersion` in the body, the contract's field, so a version has one source. `If-Match` is not read, and the OpenAPI document says so.
* Errors are `application/problem+json` as [05 GraphQL and APIs](../plan/05-graphql-and-apis.md#rest-errors) shows: `type`, `title`, `status`, `detail`, `instance`, `code`, `errors` (the field errors in the shape GraphQL uses) and `correlationId`. M-35 and M-36 (code spelling and the `type` base) are settled before the first public route, as ADR 0064 already requires.
* OpenAPI. `toRestRoutes` gives each route its operation id, its tag `core`, its 2xx schema and its problem responses, and the document builder of ADR 0064 converts the contracts with `zod-openapi`. `northmes openapi print` writes `schema/openapi-v1.json`, `pnpm gen --check` covers it, the oasdiff gate compares it with the base branch, and `GET /api/v1/openapi.json` serves the installation's document. The document declares the security schemes of section 5: `bearer` for tokens, and `oauth2` with the client credentials and authorization code flows, each operation listing its permission as the required scope.

### 3. The /mcp endpoint and the core toolset

`/mcp` is built as [ADR 0034][adr-0034] decides: one endpoint in the backend on `@modelcontextprotocol/server` v2 with `createMcpHandler(factory, { legacy: "stateless" })`, off by default per installation, with its own `Origin` and `Host` checks. Its tools are the operations with a `tool` entry, through `toMcpTool`.

Core's toolset in release 1:

| Tool | Effect | Annotations | Does |
|---|---|---|---|
| `core_list_plants` | read | read-only | the plants the user can reach (ADR 0034) |
| `core_find_articles` | read | read-only | articles by number or name at a plant, at most 50 per call with a cursor |
| `core_get_article` | read | read-only | one article by id |
| `core_save_article` | command | not read-only, not destructive | the upsert by article number |
| `core_archive_article` | command | destructive | archives an article |
| `core_restore_article` | command | not destructive | restores an archived article |

* `defineTool` of ADR 0034 becomes the `tool` entry of an operation. Its data (name, toolset, schemas, permission, annotations, effect) moves to the contracts package; its handler is the operation's handler, bound in the backend. `@northmes/sdk/mcp` keeps the tool types and the schema lint.
* A new effect, `command`, runs one command through the bus as the user. The command row has surface `mcp`, the user as principal and the token as credential. ADR 0034 knew only `read` and `proposal`. Planning keeps its rule: no planning tool commits a schedule change, and `planning_propose_changes` stays a proposal ([ADR 0036][adr-0036]).
* A tool without a `plant` argument takes it from the call, as ADR 0034 requires: `plant` is required unless the user reaches exactly one plant.
* An agent cannot be asked for a uuidv7, so `toMcpTool` fills `id` with a new one when a `core_save_article` call leaves it out. The upsert is idempotent on the article number, so a retried call does not create a second article.
* Each toolset holds at most eight tools, and the in-repo toolsets together at most sixteen; one CI check counts both. Release 1 then serves core's six tools and planning's seven (ADR 0034's eight less `core_list_plants`, which is core's): thirteen.

### 4. WebMCP in the web app

The web app registers the operations marked `webmcp: true` as WebMCP tools, so an agent in the user's browser can use the page's tools as the signed-in user. The adapter lives in `apps/web/src/shell/webmcp/`.

* Feature detection. The adapter uses `document.modelContext`, where the draft of 2026-10-09 places the API, and falls back to `navigator.modelContext`, where Chrome exposed it before May 2026. When neither exists, as in every browser without the flag or the origin trial and in an insecure context, the adapter does nothing and the page works as before. A failed registration is logged to the client-error route and never shown to the user.
* Registration. The draft's `registerTool(tool, { signal })` takes `name`, `title`, `description`, `inputSchema`, `execute` and `annotations` (`readOnlyHint`, `untrustedContentHint`, `consequentialHint`). The adapter builds `inputSchema` with `z.toJSONSchema` from the contract, leaves out the `plant` argument because the page has one plant, sets `readOnlyHint` for queries and `consequentialHint` for commands, and sets `untrustedContentHint` on tools whose output holds text that outside systems wrote, such as an ERP's article name.
* What is registered. Only tools whose permission the user holds at the current plant, read from the permissions the web already loads for the plant. A user without `core.article:archive` at the plant never sees `core_archive_article` registered.
* Lifecycle. Each registration gets an `AbortSignal` from one `AbortController` per plant session. A plant switch aborts it, which unregisters every tool, and registers the new plant's set. Sign-out and a 401 abort it too. On the `navigator.modelContext` fallback, where a build may not take a signal, the adapter calls `unregisterTool(name)` when it exists.
* Execution. `execute(input)` posts `{ input }` to the first-party route `POST /api/v1/web/tools/{tool}` with the web's JWT and `x-northmes-plant`. The route runs the same operation runner with surface `webmcp`. The page never calls a handler directly, so the browser gets the same permission checks, row scopes, output validation and error mapping as `/mcp`. The result is the tool's structured JSON, or the runner's error object.
* The route is first-party: same-image callers, no compatibility promise, no entry in the OpenAPI document. It accepts only the web's JWT.
* WebMCP needs no installation setting: it exposes nothing that the signed-in user cannot already do in the page. The user docs say that a browser agent's model is outside NorthMES, as they say for MCP clients.

### 5. Credentials

#### Integration tokens

* A Company admin creates them under Settings, Integrations, at `/settings/$companyId/core/integrations`, with the commands `core.createIntegrationToken` and `core.revokeIntegrationToken`. Both need the new permission `core.integration:manage` at company scope, which joins `companyPermissions`, so Plant admin does not hold it.
* Better Auth api-key, `configId` `integration`, prefix `nms_int_`, `references: "organization"` (the company is a Better Auth organization, [ADR 0007][adr-0007]). The core command calls `auth.api` on the server; the api-key HTTP paths stay disabled ([ADR 0011][adr-0011]).
* A token is bound to the company node or one plant node and holds one or more roles at that node. It acts as its own principal, of the new principal type `integration`, never as the person who created it.
* The secret is shown once, in the dialog that creates it, and stored hashed. Expiry is required, at most 365 days, default 90 days. `core.credential` records the name, the binding, the creator, the expiry and `last_used_at`, written at most once a minute per token. The Integrations page lists tokens with these fields and marks those that expire within 14 days.
* Revoke deletes the key at once and keeps the `core.credential` row for the audit trail ([ADR 0010][adr-0010]).

#### Personal access tokens

* A signed-in user creates them for themselves under their profile with `core.createPersonalAccessToken` and revokes them with `core.revokePersonalAccessToken`. A Company admin lists and revokes any token of the company's users.
* Two kinds, each bound to one surface, so the prefix names the surface: `configId` `pat`, prefix `nms_pat_`, for the public REST API, and `configId` `mcp`, prefix `nms_mcp_`, for `/mcp` as ADR 0034 decides. Both reference the user, expire within 90 days and are shown once.
* A personal access token acts as the user. Each call's rights are the token's scopes intersected with a live `can()` ([ADR 0011][adr-0011]).

#### OAuth 2.1 clients

NorthMES runs one OAuth 2.1 authorization server on Better Auth's OAuth provider plugin, `@better-auth/oauth-provider` 1.7.6 (MIT, published 2026-09-24), with the jwt plugin that main already runs. It serves integrations and MCP clients alike. The issuer is `NORTHMES_PUBLIC_ORIGIN` plus Better Auth's base path.

* Registration. A Company admin registers clients under Settings, Integrations, with `core.registerOAuthClient`, `core.updateOAuthClient`, `core.rotateOAuthClientSecret` and `core.disableOAuthClient`, which call `auth.api.adminCreateOAuthClient` and its siblings on the server. Dynamic client registration and client ID metadata documents stay off until the LAN spike of ADR 0034.
* Confidential clients (`client_secret_basic` or `client_secret_post`) may use `client_credentials`. Such a client is bound, like an integration token, to the company or one plant with roles there, and acts as its own principal of type `integration`. Its secret is shown once.
* Confidential and public clients (`token_endpoint_auth_method: "none"`) may use `authorization_code` with S256 PKCE, which OAuth 2.1 requires of both, plus `refresh_token`. The token acts as the user who consented.
* Redirect URIs match exactly, with no wildcard, no fragment and no query that varies. They use `https`, except loopback URIs `http://localhost` and `http://127.0.0.1` with any port, which native and command-line clients need ([ADR 0034][adr-0034], [ADR 0011][adr-0011]).
* The consent screen is a web route, `/oauth/consent`, and Better Auth's `consentPage` and `loginPage` point at the web app's origin. It names the client and the company that registered it, lists the requested scopes as the permission names the role editor shows, and offers Allow and Deny. A user revokes a consent under their profile, in Connected apps. Disabling a client revokes all its grants.
* Scopes are permission keys, such as `core.article:read` and `core.article:update`, plus `offline_access` for a refresh token. A client is registered with the scopes it may request; for a client credentials client these are at most the permissions of its roles. `openid` is off in release 1, because no client signs users in with NorthMES.
* Access tokens are JWTs signed with the jwt plugin's keys, with `aud` the resource: `NORTHMES_PUBLIC_ORIGIN + '/api/v1'` for the public REST API or `NORTHMES_PUBLIC_ORIGIN + '/mcp'` for `/mcp` (RFC 8707). They live 10 minutes. The guard verifies the signature, `iss`, `aud`, expiry and scopes in process, and checks through a cache of at most 60 seconds that the client is enabled and the grant not revoked, which keeps the 60-second bound of a revocation that the web's JWTs have.
* Refresh tokens rotate on every use. Reusing a spent refresh token revokes the whole grant. A refresh token expires 30 days after its last use. Client credentials get no refresh token.
* Each call's rights are the token's scopes intersected with a live `can()` of its principal: the user for the authorization code flow, the client for client credentials.
* MCP clients use the same server. `/mcp` answers 401 with `WWW-Authenticate` naming `resource_metadata` at `/.well-known/oauth-protected-resource/mcp`, which names the issuer. The OAuth path that ADR 0034 planned through Better Auth's MCP plugin is replaced by the OAuth provider plugin with two resources, because the MCP plugin is itself an OAuth provider and cannot run beside a second one. An MCP client registered by a Company admin as a public client with a loopback redirect signs in with the authorization code flow; personal access tokens of `configId` `mcp` keep working for clients that cannot.

#### Credentials by surface

Every bearer credential arrives in `Authorization: Bearer`. The guard reads the prefix: `nms_int_`, `nms_pat_` and `nms_mcp_` are verified as api-keys of their `configId`, anything else as a JWT, by its `aud`.

| Surface | Accepts | Rejects |
|---|---|---|
| `/graphql`, `/api/v1/web/*` (including `/api/v1/web/tools/{tool}`) | the web's JWT (`aud` the public origin, with `sid`); the station cookie as [ADR 0011][adr-0011] says | integration tokens, personal access tokens of both kinds, and OAuth access tokens of any audience |
| Public REST, `/api/v1/<module-id>/...` | integration tokens; personal access tokens of `configId` `pat`; OAuth access tokens with `aud` `.../api/v1` | the web's JWT, cookies (ignored), personal access tokens of `configId` `mcp`, OAuth access tokens with `aud` `.../mcp` |
| `GET /api/v1/openapi.json` | the web's JWT, and every credential the public REST row accepts | anonymous requests, personal access tokens of `configId` `mcp`, OAuth access tokens with `aud` `.../mcp` |
| `/mcp` | personal access tokens of `configId` `mcp`; OAuth access tokens with `aud` `.../mcp` | the web's JWT, cookies (ignored), integration tokens, personal access tokens of `configId` `pat`, OAuth access tokens with `aud` `.../api/v1` |
| Better Auth's routes, including `/oauth2/authorize`, `/oauth2/token`, `/oauth2/revoke` and `/jwks` | as Better Auth defines them; the web's bearer session only at `/api/auth/token` and on the consent continuation | the api-key, admin and registration HTTP paths, which stay in `disabledPaths` |
| `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource/...` | anonymous; metadata only | |

Integration tokens and client credentials clients reach no `/mcp` tool and no GraphQL field, because tools and the web act for people.

### 6. Audit, rate limits and the delivery order

Audit ([ADR 0013][adr-0013]):

* Surfaces `api` (public REST), `mcp` and the new `webmcp` (the first-party tool route). A command row records the principal, its type (`user` or the new `integration`), the credential id from `core.credential` (the token or the OAuth grant), the OAuth client id when there is one, and the surface.
* Reads write no command row on any surface. Each read goes to the structured log with the correlation id, the credential id and the operation name, as ADR 0034 decides for tool reads.
* A denied call writes one `permission.denied` security event with its surface. Creating, revoking and rotating credentials, registering and disabling clients, and a refresh token reuse that revokes a grant each write a command row or a security event.

Rate limits, counted per credential in the Postgres `ThrottlerStorage` that ADR 0064 requires from the first public route:

* Public REST: 600 reads and 60 writes per minute per credential.
* `/mcp`: 120 calls per minute per credential.
* `/api/v1/web/tools/{tool}`: 120 calls per minute per session.
* The OAuth token endpoint: Better Auth's own limiter, with database storage, at 30 requests per minute per client.
* A refusal is 429 with `core.request.rate_limited` and `Retry-After`; MCP and WebMCP get the same code in the tool error.

Delivery in waves. Each wave is a set of stories that each pass `pnpm check`:

1. Dependencies, each in its own pull request, all published before 2026-09-25 and under licenses that ADR 0040 allows: `@nestjs/swagger` 12.0.2 (MIT, 2026-09-23) and `zod-openapi` 6.0.2 (MIT, 2026-08-31) for wave 3; `@modelcontextprotocol/server` 2.1.0 (Apache-2.0, 2026-09-23) and `@modelcontextprotocol/client` 2.1.0 as a dev dependency for wave 4; `@better-auth/oauth-provider` 1.7.6 (MIT, 2026-09-24), pinned with `better-auth`, for wave 6.
2. The operation contract: `defineQueryContract`, `defineOperations`, `bindOperations`, the runner with its error mapping, `context.require` on the command bus, `operationsConformance`, `core.upsertArticle` and the article operations bound in the backend. GraphQL gains `coreUpsertArticle` from the same command.
3. Public REST and OpenAPI: `toRestRoutes`, the document builder and `northmes openapi print`, `schema/openapi-v1.json`, the oasdiff gate, `GET /api/v1/openapi.json`, the audit surface `api`, the principal type `integration`, integration tokens, personal access tokens of `configId` `pat`, Settings, Integrations, the credential guard and the Postgres throttler.
4. `/mcp` as ADR 0034 decides, with core's toolset and personal access tokens of `configId` `mcp`, off by default.
5. WebMCP: `toWebMcpTool`, the tool route, the audit surface `webmcp` and the registration lifecycle.
6. OAuth 2.1: client registration, client credentials, the authorization code flow with PKCE, the consent screen, Connected apps, refresh rotation, the well-known metadata and OAuth access tokens on `/mcp`.
7. Planning's tools join as the planning stories that own them land ([ADR 0034][adr-0034]), and `toAgentTool` with the assistant ([ADR 0035][adr-0035]).

### Changes to ADR 0011

* Principal types gain `integration`: an outside system, with an integration token or a client credentials client, surface `api`, `acting_for` none. A person through an OAuth client is principal `user` with the OAuth grant as credential and surface `api` or `mcp`.
* The credential table becomes the one under [Credentials by surface](#credentials-by-surface). The rows marked "later" for public routes and `openapi.json` are decided here.
* "When dynamic client registration arrives with OAuth login for MCP" stays as written: registration stays off, and the redirect URI rules above apply to registered clients.

### Changes to ADR 0031

* "No integration REST API in release 1" no longer holds. The public family starts with core's article operations under section 2. Connectors still run in process, and `upsertArticle` is open to connectors as a canonical import command.

### Changes to ADR 0034

* "The cap is eight tools" becomes eight tools per toolset and sixteen across the in-repo toolsets, and the CI check counts both. Release 1 serves thirteen tools.
* The toolset gains `core_find_articles`, `core_get_article`, `core_save_article`, `core_archive_article` and `core_restore_article`.
* The tool effect gains `command`, which runs one command as the user with surface `mcp`.
* `defineTool`'s data moves into the operation declaration in the contracts package; the handler is bound in the backend. The shared runner becomes the operation runner and also serves REST and WebMCP.
* "OAuth 2.1 login through Better Auth's MCP plugin, with client ID metadata documents and a dynamic client registration fallback" becomes OAuth 2.1 through the OAuth provider plugin with a Company admin's registered clients; client ID metadata documents and dynamic registration still wait for the LAN spike.
* WebMCP leaves "What waits".

### Changes to ADR 0055

* The ledger gains one row: "Platform surfaces of ADR 0073: the operation contract, the public REST API for articles with OpenAPI and the oasdiff gate, integration tokens, personal access tokens, OAuth 2.1 clients and WebMCP", with the planning session's unmeasured estimate of 22 to 36 raw days (wave 2: 4 to 6; wave 3: 8 to 12; wave 5: 2 to 4; wave 6: 8 to 14). Wave 4 is the `/mcp` endpoint already in the ledger at 8 to 13 days.
* "Later platform work and its triggers" loses the integration REST API with scoped tokens, OAuth applications and machine-to-machine auth, and WebMCP, which enter release 1 by the maintainer's decision of 2026-10-09.
* Cut order item 3, the `/mcp` endpoint, stays; the operation runner stays with it, because REST and WebMCP use it.

### Changes to ADR 0064

* The public API starts in release 1, with core's articles. "Release 1 has no public route" and the route inventory test's "no route is in the public family" no longer hold.
* A module's public routes come from its operation declarations through `toRestRoutes`, not from hand-written controllers in `server/rest/v1/`, and its public schemas live in `contracts/src/operations/`.
* The root allowlist gains `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource/*`.
* The plant slug schema also refuses `oauth`, because `/oauth/consent` is a web route.
* `openapi.json` and the public routes accept the credentials in the table above, not only integration tokens.

### Changes to ADR 0010 and ADR 0013

* [ADR 0010][adr-0010]: `core.role_assignment` assigns a role to a principal, a user or a `core.credential` row of an integration token or a client credentials client, instead of to a user only, and `can()` walks the scope tree for both.
* [ADR 0013][adr-0013]: the surfaces gain `api` and `webmcp`, the principal types gain `integration`, and a command row records the OAuth client id.

### Consequences

* Good, because a module declares a capability once and gets REST, OpenAPI, an MCP tool, a WebMCP tool and later an assistant tool, with the same permission check, output schema and error codes.
* Good, because every write on every surface still runs through the command bus and lands on one audit row with its surface.
* Good, because an ERP can push articles with one idempotent call per article and needs no idempotency store.
* Good, because one authorization server serves integrations and MCP clients, and every credential is bound to the surfaces its prefix or audience names.
* Good, because WebMCP adds nothing to a browser without it.
* Bad, because release 1 grows by the ledger row above, before the pilot's planning work.
* Bad, because agents can run commands on articles as the user, which ADR 0011's rule kept to proposals; the maintainer confirms this.
* Bad, because the plant slug sits in every public path, so moving articles to company scope ([ADR 0007][adr-0007] places them there) or renaming a plant breaks integrations.
* Bad, because WebMCP is a draft that changed its entry point in May 2026 and may change again, and only Chrome behind a flag can test it by hand.
* Bad, because NorthMES owns the consent screen, the client and token pages and the credential guard.

### Confirmation

* `packages/contracts/test/define-operations.test.ts`: "an operation whose tool name lacks its module prefix throws naming the operation"; "a REST path outside the module segment throws"; "a query contract without an output schema throws".
* `packages/sdk/test/operations/runner.test.ts`: "a query handler that returns an extra key sends a result without it"; "an unknown error maps to core.internal with the correlation id".
* `apps/backend/test/operations/conformance.int.test.ts`, through `operationsConformance(articleOperations)`: every article REST operation is served and is in the OpenAPI document; every article tool is in `tools/list` for a Plant admin and missing for a user without its permission.
* `apps/backend/test/rest/v1-articles.int.test.ts`: "a list with first 2 returns two articles and a cursor that returns the third"; "a create retried with the same id returns 200 and the first article"; "an update with a stale expectedVersion returns 409 core.version_conflict as application/problem+json"; "an upsert with a new number returns 201 and with the same number and name returns 200 without a command row"; "an upsert on an archived article returns 409 core.archived"; "a read with the ETag in If-None-Match returns 304"; "a token bound to plant A gets 403 for plant B in the path"; "a write writes one audit.command row with surface api and principal type integration".
* `apps/backend/test/credentials-by-surface.int.test.ts` gains one case per cell of the credential table, for example "an integration token on POST /graphql returns 401", "a pat token on /mcp returns 401", "an OAuth access token with aud /mcp on a public route returns 401" and "the web's JWT on a public route returns 401".
* `apps/backend/test/oauth/*.int.test.ts`: "client credentials for a client bound to plant A returns a token whose aud is /api/v1 and which lists articles at A"; "an authorization code without a code_verifier is refused"; "a redirect_uri https://attacker.example.test/cb is refused at registration"; "a reused refresh token revokes the grant and the next access token check fails within 60 seconds"; "a scope outside the client's registered scopes is refused".
* `apps/backend/test/mcp/core-tools.int.test.ts` with `@modelcontextprotocol/client`: "core_save_article writes one command row with surface mcp"; "a user without core.article:archive gets no core_archive_article in tools/list".
* A CI check fails when a toolset holds more than eight tools or the in-repo toolsets more than sixteen.
* `apps/web/test/webmcp/adapter.test.ts`, with a fake `document.modelContext`: "nothing is registered when neither document.modelContext nor navigator.modelContext exists"; "a user without core.article:archive at the plant gets no core_archive_article"; "a plant switch aborts the registrations and registers the new plant's tools"; "sign-out aborts every registration"; "execute posts to /api/v1/web/tools/core_find_articles with the plant header".
* `apps/backend/test/rest/web-tools.int.test.ts`: "a tool call writes its command row with surface webmcp"; "an integration token on the tool route returns 401".
* `apps/backend/test/rest/rate-limit.int.test.ts`: "the 61st write in a minute from one token returns 429 core.request.rate_limited with Retry-After".
* The route inventory test lists the article routes in the public family and the well-known routes on the root allowlist.

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
| Article path | `/api/v1/core/plants/{plant}/articles` | `/api/v1/core/articles` with the plant from the token | ADR 0064 puts a plant-scoped route's plant in the path; a token bound to the company reaches several plants |
| Upsert key | the article number (`code`) at the plant | an external reference | the ERP knows its article number; core has no external reference column yet |
| Version on writes | `expectedVersion` in the body; `ETag` on reads | `If-Match` | the contract already carries the version, and two sources could disagree |
| WebMCP execution | the first-party route `/api/v1/web/tools/{tool}` through the runner | GraphQL operations per tool in the page; the public REST route with the web's JWT | one runner for every agent surface; the public family keeps people's browser credentials out |
| Token kinds on api-key | `integration`, `pat` and `mcp` configIds, one surface each | one personal token valid on REST and `/mcp` | ADR 0011 binds a credential to the surfaces it was issued for |
| OAuth server | `@better-auth/oauth-provider` with two resources | Better Auth's MCP plugin; a separate authorization server | the MCP plugin is an OAuth provider for one resource; a separate server is a second deployable |
| Access token lifetime | 10 minutes, with a 60-second revocation check | 5 minutes like the web's JWT; 60 minutes | short enough for a lost token, long enough for a batch of ERP calls, and revocation does not wait for expiry |

## More information

* Maintainer quotes, 2026-10-09: "The next thing is if we can create the api for articles, with support for oauth and service token?" and "The ide is to have the basic things in place lime webmcp and mcp so we have the base and structure for starting creating the other modules later".
* Related ADRs: [0007][adr-0007] plants and scopes, [0010][adr-0010] identity and `can()`, [0011][adr-0011] principals and credentials, [0012][adr-0012] commands, [0013][adr-0013] audit, [0017][adr-0017] Zod contracts, [0031][adr-0031] ERP integration, [0034][adr-0034] MCP, [0035][adr-0035] the assistant, [0036][adr-0036] proposals, [0040][adr-0040] license policy, [0055][adr-0055] scope, [0062][adr-0062] module link manifests (the pattern the operation declaration follows), [0064][adr-0064] REST and OpenAPI, [0066][adr-0066] company settings.
* Plan: [05 GraphQL and APIs](../plan/05-graphql-and-apis.md) (errors, credentials, the public API and the MCP endpoint) and [10 AI and agents](../plan/10-ai-and-agents.md) (the runner and the toolset) follow this ADR once it is accepted.
* WebMCP: https://webmachinelearning.github.io/webmcp/ (Draft Community Group Report). MCP authorization: https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization. Better Auth OAuth provider: https://www.better-auth.com/docs/plugins/oauth-provider. Better Auth API keys: https://www.better-auth.com/docs/plugins/api-key.
* Unverified, to settle in the wave that relies on it:
  * whether `@better-auth/oauth-provider` 1.7.6 continues an authorization from a consent page on another origin that sends the web's bearer session instead of a cookie;
  * whether it issues JWT access tokens for two resources from one server with the jwt plugin options main already sets, and how it names the RFC 8414 metadata path for an issuer with a path;
  * whether `@better-auth/api-key` 1.7.6 reads a key from `Authorization: Bearer` through `customAPIKeyGetter` when three `configId` values share the header;
  * which Chrome builds expose `navigator.modelContext` and whether they take a `signal`;
  * whether `@modelcontextprotocol/server` 2.1.0 lets the controller serve `resource_metadata` for an OAuth audience while it also accepts api-key tokens.
* Open: whether articles move to company scope, as ADR 0007's table says, before the first integration uses the path; a `updatedSince` filter for ERP sync; client ID metadata documents for MCP clients after the LAN spike.
* Revisit when a second module declares operations, when WebMCP changes its entry point or leaves the origin trial, and before 1.0.

[adr-0007]: 0007-tenancy-company-plants-and-the-scope-tree.md
[adr-0010]: 0010-identity-with-better-auth-roles-and-permissions-in-core-tables.md
[adr-0011]: 0011-principals-credentials-and-same-origin-rules.md
[adr-0012]: 0012-commands-as-the-single-write-path.md
[adr-0013]: 0013-audit-trail-written-in-the-command-transaction.md
[adr-0017]: 0017-zod-contracts-as-the-single-source-for-inputs.md
[adr-0031]: 0031-erp-integration-connector-modules-field-ownership-and-pending-changes.md
[adr-0034]: 0034-mcp-surface-one-endpoint-a-read-mostly-planning-toolset.md
[adr-0035]: 0035-ai-provider-port-with-customer-configured-providers.md
[adr-0036]: 0036-agent-proposals-as-planning-records-a-person-commits.md
[adr-0040]: 0040-dependency-license-policy-ci-gate-and-sbom.md
[adr-0055]: 0055-release-1-scope-under-option-b-and-the-scope-rule.md
[adr-0062]: 0062-web-form-contracts-url-view-state-and-module-link-manifests.md
[adr-0064]: 0064-rest-routes-under-api-v1-and-openapi-from-zod-contracts.md
[adr-0066]: 0066-companies-created-by-the-cli-plant-slugs-unique-per-installation-company-settings-at-settings-and-an-onboarding-wizard-before-a-plant-opens.md
